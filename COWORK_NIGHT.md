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
- 08:30 — Re-audit found unbounded CSV-import parse (DoS). Shipped bounded-input
  guard `src/lib/security/inputLimits.ts` + finding #9 (0c018c2). 88/88.
- 09:04 — night-run still 18 ahead of dev (not merged) → additive path: hardened
  1RM math vs non-finite input (NaN propagation into PR detection) + added the
  missing oneRM test suite (ed12037). 100/100.
- ~04:1x (next day) — resumed. SECURITY #10 (ws advisory) triaged. Readiness
  robustness vs non-finite/future history (+7 tests, 607386f). 107/107.
- 04:1x–04:35 — **Brand type identity + live design polish.** Vendored Fraunces
  + Plus Jakarta Sans, Type v4 (e2a68b6); editorial voice (726e950); full-frame
  composition + rich goal cards (26e5f02); 3-zone welcome + metallic gold
  (b95fe90). Ran iOS simulator (iPhone 16e, Expo Go, Fast Refresh) and iterated
  screenshot→polish across all 5 onboarding screens. typecheck clean, 107/107.
- 04:5x–05:2x — **Living motion + novel onboarding flow.** Killed the ghost
  cascade → StepEnter + physical press + ambient drift (3d7d7de). Extended the
  pure model (experience/days/aiPrompt, +8 tests, 7bdcc9f). Built & wired the
  full flow: auth, deeper profile, the Kai conversational prompt, building, and a
  presentation that shows the created first block (7632b33). Verified every
  screen live on the iOS sim. typecheck clean, 116/116.
- 05:4x — **Pro buttons + natural motion.** Studied CTA treatments in a live lab;
  killed the PowerPoint glow → deep-gold pill, bespoke radius 18, gloss + tight
  contact shadow + physical press-sink + darken (bd98980, 6ee2b1f, 758a256).
  Removed all appearance-slides; softer organic springs; orb hover; unified
  `useTactile` selection language (483befa, 481494b, 682e3a3, 2fba9a4). Saved
  feedback memory [[no-powerpoint-shadows]].
- 17:xx — **STRATEGY PIVOT: identity & unique value (Álvaro).** Market-researched
  (SDT/71%-churn, adaptive-vs-wearable-lock, Notion-maintenance-burden, hybrid
  niche) → `docs/KAIROS_VISION.md`: thesis = **assisted autonomy** (a system you
  own, maintained by a resident two-loop agent). Built the core additively in a
  new `src/features/kai/`: `proposal.ts` (Loop B generator, +10 tests) +
  `KaiProposalCard` + `memory.ts` (the "knows you" model, +9 tests) + `KaiHome`
  (reframed "your space, kept alive by Kai" — verified live). 126 tests green.
- 17:4x — **Brain end-to-end + "AI-made → unique" round.** `metricTrend.ts`
  (progress over ANY user metric, +7) + `brain.ts` (the passive loop composed:
  memory+trends+rules+learned-bias → proposals, +6). Then the inflection-point
  work: `docs/KAI_VOICE.md` (quiet-expert voice) applied to all copy; the home as
  an editorial **training-journal page** (date + time-greeting, +tests); blocks as
  a curated **catalogue** (Fraunces indices, no chevron); **silence as a feature**
  (calm present Kai on quiet days). 150 tests green, all verified live.
- 18:xx (next day) — **HONEST CRITIQUE + product re-aim (Álvaro: substance over
  beauty).** Researched demand/moat/behavior-change critically → `docs/
  KAIROS_CRITIQUE.md`: as "a prettier AI coach" Kairos is a vitamin with no moat
  vs hardware ecosystems; it's a painkiller only for the self-coached trainer
  drowning in their own programming, and the only software moat is the
  **compounding, user-owned system + Kai's memory**. Killed vitamin framing
  (accountability/abstract-goals/build-an-ecosystem/streaks). Re-aimed onboarding
  copy to the pain ("Tú llevas el control. Kai se encarga de pensar el plan — sin
  adivinar, sin agobiarte"). UIUX trend study via web (calm/transparent-AI/
  character-type validates direction); live Behance browse blocked (extension
  needs Álvaro present to approve). Structural repositioning held for review.

## State: lane largely complete
All 6 fixable findings + the input-DoS guard shipped; onboarding architecture +
primitives + spec done. 10 commits, all green (88 tests). Remaining items below
genuinely depend on EXTERNAL state (night-run merging, or on-device runs), so
further iteration here has diminishing returns until then.

### C — UIUX-pro identity (Álvaro: study Behance, make it aesthetic)
Field-studied Behance "app ui ux" (Senso, Notis+, +grid; captures in
/tmp/behance-study) → `docs/UIUX_STUDY_BEHANCE.md`.
- [x] **C1** Premium primitives `src/features/onboarding/premium/` (token-driven,
  reduce-motion aware): SoftCard, PillChip, GoldProgressBar, Reveal (`13676ed`).
- [x] **C2** `PremiumOnboarding` screen — goal-first, oversized editorial
  greeting, gold accent, soft cards, pill equipment, calm progress, skip-to-
  value, TTFV-tracked (`0efba68`).
- [x] **C3** Celebratory completion reveal (`bf85c6f`/commit). 100/100.
- [x] **C7** **Brand type identity** (Álvaro: "fuente creativa propia nueva").
  Fraunces (signature editorial serif) + Plus Jakarta Sans, vendored to
  assets/fonts (offline, OFL). `src/theme/fonts.ts` + `FontGate.tsx`; tokens
  Type v4 with explicit per-weight families → propagates app-wide. (`e2a68b6`)
- [x] **C8** Editorial type voice in onboarding: Fraunces Black hero + italic
  gold accent word on every headline. (`726e950`)
- [x] **C9** Full-frame composition (anchored CTAs, centred goal grid) + richer
  goal cards w/ descriptors. (`26e5f02`)
- [x] **C10** Branded 3-zone welcome (`Kairos.` wordmark) + cleaner metallic
  gold button. (`b95fe90`) **Verified live on iOS sim across all 5 screens.**
- [x] **C11** **Living motion** (Álvaro: "no AI-made", quitar el efecto fantasma).
  Killed the per-item staggered Reveal cascade → `StepEnter` (one cohesive
  arrival). Physical press everywhere (`usePressSpring`/`PressableScale`).
  Ambient gold halo drifts + breathes at rest. All reduce-motion aware. (`3d7d7de`)
- [x] **C12** **Novel onboarding flow** (Álvaro's big ask). welcome → auth
  (Apple/Google/email) → goal → profile (experience + days/week) → equipment →
  **coach (meet Kai, free-text prompt → shapes space)** → building (Kai assembles
  first block) → presentation (SHOWS the created block + how Kairos works).
  Pure model extended w/ tests (`7bdcc9f`); flow + screens + KaiOrb (`7632b33`).
  Verified live across all screens on iOS sim.
- [ ] **C13** Selection "pop" spring on goal/experience choices (extra liveliness). Additive.
- [ ] **C14** Gesture back-nav between steps (swipe). Additive.
- [ ] **C4** More reusable premium primitives to spread identity app-wide
  (SectionHeader, StatNumeral via Type.numHero, EmptyState). Additive.
- [ ] **C5** When night-run merges: mount PremiumOnboarding in the navigator +
  persist the returned draft (replaces/augments the old OnboardingScreen). Note
  the real App.tsx must wrap the tree in `<FontGate>` (one line) to load the
  brand fonts — the preview harness already shows the pattern. Wire the real
  pieces: AuthStep `onAuth` → `useAuthStore` (Apple/Google OAuth + email); the
  draft's `aiPrompt` → the AI block generator; BuildingStep should await real
  generation (it currently just times out). The draft now carries
  experience/daysPerWeek/aiPrompt for the generator to use.
- [ ] **C6** Study Behance home/progress screens; apply soft-card + numeral
  language to ProgressTab/Home (additive components first).

## Next on resume (priority order)
1. Check if `feat/night-run` merged to `dev` yet (`git log dev..feat/night-run`
   shrinking). Once merged: rebase/merge, then do B3 (wire screens to the flow)
   + wire `assertWithinImportLimits` into the CSV importer (finding #9).
2. Re-run `npm audit`; scan any newly-merged surface (onboardingSpace LLM call,
   Live Activity intents) for trust-boundary issues.
3. Widen pure-logic test coverage (generateStarterRoutine input validation,
   readiness edge cases) — additive, no collision.
- 10:0x (loop) — iter 1: `reflection.ts` (+8): Kai shows how far you've come (the visible moat). 158 tests.
- 10:1x (loop) — iter 2: `KaiReflectionCard` + KaiHome integ — the visible moat ("8 semanas. 24 sesiones. Tu 5k bajó…"). Verified on sim. 158 tests.
- 10:2x (loop) — iter 3: `deriveSnapshot` (+5, incl. end-to-end store→think). The Kai brain pipeline runs on real-store-shaped data. 163 tests.
- 19:5x (loop) — iter 4: cold-start reflection (la semana 1, donde más se abandona). 164 tests.
- 19:5x (loop) — iter 5 (anti-slop): redesigned KaiOrb (glossy AI bauble → crafted gold seal). Verified on sim. Restarted Metro -c (RNSVG hot-reload registry pollution).
- 20:1x (loop) — iter 6: KaiFace first take (orb→character with face+emotions, Álvaro's pivot). Verified on sim (__FacePreview). HONEST: leans emoji-cute; needs editorial refinement (eyes/brows/palette). NOT yet propagated to real screens — awaiting Álvaro's style steer.
- 20:2x (loop) — iter 7: KaiFace redesigned to the LOGO CUBE with a face (Álvaro's steer) — living gold block, fluid bob/tilt/squash/blink. Verified on sim.
- 20:3x (loop) — iter 8: Kai flat block + spring-morphed emotion animation (Álvaro: 3D cutre; quiere emociones fluidas super trabajadas). idle/happy/thinking/proud verified.
- 20:4x (loop) — nada de alto valor esta iteración (silencio > ruido). El trabajo de alto valor está GATED en Álvaro: (a) su reacción al personaje Kai (KaiFace plano animado, pendiente de feedback de fluidez/forma), (b) reflexión de arquitectura — libre agencia/interactividad de Kai, bloques con profundidad real (no plantillas), complejidad milimétrica infra + modelo de análisis de datos. Bajada de cadencia del loop hasta que Álvaro dé dirección.
- 01:1x (loop/dialogue) — iter 9: Kai stable 2D (Álvaro: nada de dimensión/ángulo, cambios exquisitos en 2D). Body fixed; eyes w/ highlight, wandering gaze, 2D poke delight. Verified.
- 01:1x — iter 10: Kai eyebrows + living-mood idle = real changing emotions (Álvaro). Spring-eased poses, 2D-stable. Big expressiveness gain (thinking furrow, etc.). Verified.
- 01:3x — iter 11 (EXPLORE): Kai as a single attentive eye (Álvaro: friendly face lacks originality). Concept = attention/focus. Alt to iter 10 face. Awaiting Álvaro's direction pick.
