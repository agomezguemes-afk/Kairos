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
- [ ] **A4** Fix quota TOCTOU: concurrent calls bypass the cap. Needs an atomic
  reserve RPC (advisory-lock count+insert, refund on failure) + edge change.
  Untestable locally (no DB) — design carefully, flag for DB testing.

### B — World-class onboarding (Álvaro's explicit top priority)
Goal: user is *using* the app within **2 minutes**; the flow is a visually
unmatched experience. Inspired by best-in-class (Duolingo, Cal AI, Superhuman,
Headspace, Rise, Arc) — adapted to Kairos' white+gold "Training OS" identity.
- [ ] **B0** Research market-leading onboarding patterns + read existing
  onboarding code (night-run already built a "Kai generative" onboarding on its
  branch — improve, don't duplicate blindly).
- [ ] **B1** Design the flow + motion language (≤2 min, skip-to-usable path,
  reduced-motion fallback, haptics).
- [ ] **B2** Implement (reuse existing reanimated / gesture-handler / haptics —
  avoid new native deps where possible).
- [ ] **B3** Tests for onboarding state machine + validation.
- [ ] **B4** Polish loop.

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

## Next on resume (priority order)
1. A4 quota TOCTOU atomic reserve (migration + edge), flagged for DB testing.
2. B2: additive onboarding UI primitives that don't collide with night-run's
   screens — a reduced-motion hook + a skip-to-value CTA component (new files),
   wired to onboardingFlow.ts.
3. Re-audit: check what night-run merged; re-run npm audit; widen test coverage.
