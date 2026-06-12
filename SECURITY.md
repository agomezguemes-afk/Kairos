# Kairos — Security Audit & Hardening

Autonomous security pass on `feat/security-hardening` (branched from `dev`),
run alongside the live `feat/night-run` session in an isolated worktree.
All changes are **local and reviewed-not-deployed** — merge to `dev` after review.

_Last updated: 2026-06-12._

## Executive summary

Audited the app's real attack surface: the Supabase AI proxy edge function,
the auth/session client, secret handling, RLS, and dependencies. Found and
fixed **six issues**, two of them serious (a bundled API key + paywall bypass,
and plaintext session tokens) and one a real privilege escalation (self-granting
the Pro tier). Two build-time dependency CVEs are documented with remediation.

| # | Finding | Severity | Status |
| - | --- | --- | --- |
| 1 | Direct-Groq API key shipped in bundle → key leak + AI quota/paywall bypass | **High** | ✅ Fixed (`806d25a`) |
| 2 | Supabase session (access+refresh tokens) stored in plaintext AsyncStorage | **High** | ✅ Fixed (`de45423`) |
| 3 | `profiles.subscription_tier` self-editable → free user grants self Pro tier | **High** | ✅ Fixed (`6e49ffe`) |
| 4 | AI proxy trusts client `max_tokens` → cost amplification; leaks upstream errors | **Medium** | ✅ Fixed (`45f5201`) |
| 5 | Streamed AI calls could escape the quota ledger (fire-and-forget insert) | **Low** | ✅ Fixed (`45f5201`) |
| 6 | AI quota check/record TOCTOU → concurrent calls bypass the daily cap | **Medium** | ✅ Fixed (`251bbfd`) |
| 7 | `shell-quote` (critical) + `@xmldom/xmldom` (high) — build-time deps | **Low (not shipped)** | 📋 Documented |
| 8 | `profiles` RLS lived outside version control (unauditable) | **Medium** | ✅ Fixed (`6e49ffe`) |
| 9 | Unbounded CSV import parse → memory-exhaustion DoS on a huge/crafted file | **Medium** | 🧩 Guard shipped; wiring pending |

## Findings

### 1. Bundled Groq key → key leak + paywall bypass — High ✅
`src/lib/ai/client.ts` read `EXPO_PUBLIC_GROQ_API_KEY` unconditionally for a
"dev fallback" direct call to Groq. Any `EXPO_PUBLIC_*` value referenced in code
is **inlined into the JS bundle** by Metro and is trivially extractable from a
shipped app. A release built with that var set would leak the key to every user,
and anyone could then call Groq directly — bypassing the server-side per-tier
24h quota and the Pro paywall entirely.

**Fix:** `src/lib/ai/devFallback.ts` gates the key behind a literal `__DEV__`
check (false in every release build, so the read is dead-code-eliminated and the
key never enters a production bundle). `app.config.ts` additionally fails a
`production` build if the var is set. Production AI now always goes through the
authenticated Supabase `ai-chat` proxy. (+5 tests.)

### 2. Plaintext session tokens — High ✅
The Supabase session was persisted in AsyncStorage (unencrypted). A stolen
refresh token mints new access tokens until revoked, and AsyncStorage is
readable from unencrypted backups / rooted devices.

**Fix:** session now persists in the iOS Keychain / Android Keystore via
`expo-secure-store`, chunked to the Keychain item limit
(`src/lib/storage/secureChunk.ts`, +8 tests). The adapter migrates an existing
plaintext session into the Keychain and scrubs the old copy on first read (no
forced logout), falls back to AsyncStorage on web and on rare Keychain errors.
**Requires a native rebuild** (new config plugin).

### 3. Self-granted Pro tier — High ✅
`profiles.subscription_tier` selects the AI tier (free 30/day Groq vs pro
500/day Anthropic), meant to be flipped only by the RevenueCat webhook. A plain
own-row UPDATE policy would let an authenticated user PATCH their own row to
`pro`, bypassing the paywall.

**Fix:** migration `20260612030000_profiles_rls_hardening.sql` enables/forces
RLS with own-row policies and adds a trigger that forces `subscription_tier` to
`free` on insert and freezes it on update for any non-`service_role` caller.

### 4. Cost amplification + info leak in the AI proxy — Medium ✅
`max_tokens`/`temperature` came straight from the client (a single call could
request a huge completion — the daily-call cap limits frequency, not per-call
cost), there was no prompt-size bound, and upstream error bodies were echoed to
the client.

**Fix:** server clamps output tokens to a per-tier ceiling and temperature to
`[0,2]`; caps body size (512KB), message count (64), and total prompt chars
(200K); returns a generic `upstream_error` (detail logged server-side only).

### 5. Streamed calls escaping the quota ledger — Low ✅
The ledger insert for streamed responses was fire-and-forget and could be
dropped when the isolate recycled. Now awaited before the stream is returned.

### 6. Quota TOCTOU — Medium ✅
The quota count was read, the upstream call made, and the ledger row inserted
**after**. N concurrent requests all read `count < cap` before any insert lands,
so a burst exceeds the daily cap.

**Fix:** migration `20260612031500_ai_quota_atomic_reserve.sql` adds
`ai_quota_reserve()` — count + insert under a per-user `pg_advisory_xact_lock`
so concurrent reservations serialize and the `(cap+1)`-th is denied — plus
`ai_quota_release()` / `ai_quota_finalize()`. The edge function reserves after
body validation, releases the reservation on every failure path (misconfig,
unsupported provider, network/timeout exception, non-2xx), and finalizes the
token count on success — preserving "failed calls don't burn quota" without the
race. **Reviewed-not-applied — needs a DB concurrency test before deploy.**

### 7. Build-time dependency CVEs — Low (not shipped) 📋
`npm audit --omit=dev`: 1 critical (`shell-quote`), 1 high (`@xmldom/xmldom`),
13 moderate. Both critical/high are transitive deps of the Expo/Metro **build
toolchain** — they run on the build machine, not in the shipped app bundle, so
user-facing risk is low. Fixes are available (non-major). Deliberately **not**
auto-applied here to keep the lockfile diff clean for review; remediate with:
`npm audit fix` then re-run `npm run typecheck && npm run test`.

### 8. RLS not in version control — Medium ✅
The `profiles` table's RLS lived only in the Supabase dashboard, so it couldn't
be reviewed or reproduced. Migration `20260612030000` brings it under code
(see #3).

### 9. Unbounded CSV import → DoS — Medium 🧩 (guard shipped, wiring pending)
The Strong/Hevy importer (on `feat/night-run`) parses the chosen file with
`parseCsv(text)` synchronously on the JS thread with **no size or row bound**. A
crafted or accidentally huge file exhausts memory and freezes/crashes the app —
a denial-of-service at an untrusted-input boundary.

**Shipped:** `src/lib/security/inputLimits.ts` — a general-purpose, tested guard
(`assertWithinImportLimits`: ≤5M chars / ≤100k lines, typed `InputTooLargeError`,
+5 tests). It is not wired here because the import code lives on the night-run
branch (editing it would collide). **Wiring (1 line) when import merges to dev:**
call `assertWithinImportLimits(text)` before `parseCsv(text)` in
`src/lib/import/*`, and build records with `Object.create(null)` in
`csvToRecords` so CSV header keys can't shadow object internals.

## Notes for the reviewer
- The two migrations are **reviewed-not-applied** — reconcile with current prod
  policies before applying.
- A2 needs a native rebuild (`npx expo prebuild` / new dev client) because
  `expo-secure-store` is a native module.
- Nothing here was pushed or deployed; no Supabase prod changes were made.
