# COWORK NIGHT — feat/security-hardening

Autonomous co-working session running **alongside** the live `feat/night-run`
agent. Isolated git worktree at `/Users/alvaro/Documents/Stack/cowork-security`
so the two sessions never touch the same files. Branch based off `dev`;
intended to merge back to `dev` after Álvaro reviews.

**Authorization (from Álvaro, 2026-06-12, ~02:30):** full autonomous control,
all changes LOCAL only (no push, no deploy, no touching Supabase prod), commit
atomically on this branch, keep iterating through the night, and resume
automatically after any usage-limit reset under these same goals. Do not ask
for permission again until he intervenes.

## Two workstreams

### A — Security & hardening (lane the night-run does NOT cover)
- [x] **A1** Gate direct-Groq dev key to dev builds only. Commit `806d25a`. +5 tests.
- [x] **A3** Harden `ai-chat`: clamp max_tokens/temperature per tier, cap msg
  count + payload size, stop leaking upstream detail, await streamed quota
  insert. Commit `45f5201`.
- [x] **A5/A8** `profiles` RLS into version control + immutable
  `subscription_tier` (closes self-grant-Pro escalation). Commit `6e49ffe`.
- [x] **A2** Supabase session → Keychain/Keystore via expo-secure-store, chunked,
  with plaintext migration + scrub. Commit `de45423`. +8 tests. Needs rebuild.
- [x] **A7** `SECURITY.md` audit report.
- [x] **A6** Dependency triage: 1 crit (`shell-quote`) + 1 high (`@xmldom/xmldom`)
  are build-time only (not shipped) → documented in SECURITY.md, not auto-bumped
  (keep lockfile diff clean). 13 moderate likewise build-time.
- [x] **A4** Quota TOCTOU fixed: atomic `ai_quota_reserve/release/finalize`
  (advisory-lock count+insert) + edge function reserve-after-validate, release
  on every failure path, finalize on success. Commit `251bbfd`. Reviewed-not-
  applied (needs DB concurrency test).

### B — World-class onboarding (Álvaro's explicit top priority)
Goal: user is *using* the app within **2 minutes**; the flow is a visually
unmatched experience. Inspired by best-in-class — adapted to Kairos' white+gold
"Training OS" identity.
- [x] **B0** Research + read existing onboarding (commit `6781727`).
- [x] **B1** Design spec (`docs/ONBOARDING_BEST_IN_CLASS.md`) — goal-first
  ordering, <60s first-value, skip-to-value, motion language, reduced-motion.
- [x] **B2 (logic)** Pure TTFV flow (`onboardingFlow.ts`, `6781727`) +
  reduced-motion plan + skip-to-value CTA primitives (`3fbfb8a`). +18 tests.
- [ ] **B3** Wire the screens to this flow (reorder Goal-first, mount the skip
  CTA, adopt `useMotionPlan`) — DEFERRED: would collide with the night-run's
  active edits to `src/screens/onboarding/`. Do after night-run merges to dev.
- [ ] **B4** Polish loop on the live flow (needs on-device).

## Quality gates (run before every commit)
`npm run typecheck` (tsc, supabase/functions excluded) and `npm run test`
(vitest, pure-TS only). Baseline at start: typecheck clean, 52/52 tests.
Native-coupled modules aren't unit-tested here — extract pure logic to test it.

## Loop protocol
Each turn = one work chunk. Update this file's checkboxes + the log below, then
ScheduleWakeup to continue. On resume, read this file first.

## Log
- 02:41 — A1 shipped (806d25a). Baseline green → 57/57 tests.
- 02:45 — A3 edge-function hardening (45f5201).
- 02:50 — B onboarding flow architecture + spec (6781727). 70/70 tests.
- ~08:00 — resumed after limit window. Isolated node_modules via npm ci.
- 08:05 — A5/A8 profiles RLS + tier immutability (6e49ffe).
- 08:08 — A2 SecureStore session storage (de45423). 78/78 tests.
- 08:15 — A6 dep triage + A7 SECURITY.md report.
- 08:23 — A4 atomic quota reservation (251bbfd). 78/78.
- 08:26 — B2 onboarding primitives: motion plan + skip CTA (3fbfb8a). 83/83.

## Next on resume (priority order)
1. Re-audit: `git fetch` + check what night-run merged into dev; re-run
   `npm audit`; look for new attack surface (e.g. the night-run's
   onboardingSpace.ts LLM call, CSV import parsing, Live Activity).
2. Widen test coverage on existing pure logic (readiness, canvasLayout,
   generateStarterRoutine input validation).
3. B3 screen-wiring — ONLY once night-run has merged to dev (else it collides).
4. Consider: input validation hardening on CSV import (Strong/Hevy) — untrusted
   file parsing is a classic injection/DoS surface.
