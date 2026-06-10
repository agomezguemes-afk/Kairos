# NIGHT RUN PLAN — feat/night-run

Generated 2026-06-11 ~01:50. Baseline: typecheck ✅ · lint 0 errors / 183 warnings · vitest 52/52 ✅.
Keep this file updated after every task.

## Phase 0 — Audit & tokens ✅

- [x] Read CLAUDE.md, navigation tree, workoutStore, agent/client (aiService), tokens, onboarding + ActiveWorkout
- [x] Migrate `src/theme/tokens.ts`: gold #D4AF37 canonical, bg #FFFFFF, alt warm #F5F0E8, ink #1A1A2E/#6B7280
- [x] Add `hair.gold` / `hair.goldStrong` (gold borders 0.28/0.40)
- [x] Sweep hardcoded #C9A96E (7 files) — zero references remain
- [x] Delete dead dark-theme `src/types/tokens.ts` (the file the brief flagged; zero importers)
- [x] Write PLAN.md / DECISIONS.md / PROGRESS.md / NIGHT_REPORT.md

### Audit findings (what actually exists vs the brief)

| Brief assumed | Reality |
|---|---|
| tokens.ts is dark-themed | `src/theme/tokens.ts` was already light v3; the dark file was dead `src/types/tokens.ts` (deleted) |
| ActiveWorkout needs ghost values / PR / summary | Already built: previousValues, PreviousRefPill, detectPR + notificationSuccess, WorkoutSummary, swipe nav, rest timer with timestamp math |
| aiService.ts | Real layer: `src/lib/ai/client.ts` (Groq via Supabase proxy + quota) + `agent.ts` (tool loop) + `tools/` registry |
| "applyActions store API" | The store IS the action API; AI tools commit synchronously via `useWorkoutStore.getState()` |
| Onboarding needs building | Two flows exist: `screens/onboarding/OnboardingScreen` (4-page swipe: name/goal/equipment → generateStarterRoutine) + `OnboardingChatScreen` (auth mode) |

## Phase 1 — Kai generative onboarding (ACTIVATION)

Goal: new user → built space + loggable first workout < 2 min.

- [ ] Extend onboarding question set: discipline (have: goal), level, frequency (missing)
- [ ] `src/lib/routines/starterTemplates.ts`: 6 curated templates — strength, running, calisthenics, yoga/mobility, team sport, hybrid (replaces 4-goal ROUTINES in generateStarterRoutine)
- [ ] Level/frequency modulate sets/reps/rest of the chosen template
- [ ] Online path: feed answers to agent pipeline (existing tools) to personalize; hard 10s timeout → fall back to local template (offline-first, never block activation)
- [ ] Land on Home/canvas with "Empieza tu primer entrenamiento" CTA wired to `startWorkout`
- [ ] Unit tests for template builder (every discipline × level produces valid block with sets)

## Phase 2 — Live workout flow (mostly built; close the gaps)

- [ ] Haptics per spec: `impactLight` on set completion snap (currently Medium) — verify all call sites
- [ ] Rest timer: verify background/foreground correctness (timestamp math ✅ in store + RestTimer) — add elapsed-session persistence check
- [ ] Default rest configurable per exercise pre-session (exists in-session via setExerciseRestForCurrent — add to block editor if cheap)
- [ ] Swipe-to-skip exercise: exists (pan gesture) — confirm skip semantics + haptic
- [ ] WorkoutSummary: audit against design system (volume, PRs, duration all present?)
- [ ] Ghost values: confirm cross-block fallback via libraryId (currently same-block only — extend findPreviousReference if cheap)

## Phase 3 — Live Activity / Dynamic Island (scaffold only, no device test)

- [ ] `targets/` widget extension Swift sources: ActivityAttributes {exerciseName, setIndex, setTotal, targetWeight, targetReps, restEndsAt}
- [ ] SwiftUI: Dynamic Island compact/expanded/minimal + Lock Screen banner, `Text(timerInterval:)` countdown
- [ ] iOS 17 App Intents: "Complete set", "+30s rest" (LiveActivityIntent)
- [ ] Expo config plugin registering the extension target (expo-apple-targets pattern)
- [ ] RN bridge module: start/update/end — no-op stub on simulator/Android, wired into store actions
- [ ] Android: foreground service ongoing notification (chronometer + actions) — scaffold
- [ ] `docs/LIVE_ACTIVITY_SETUP.md`: exact manual Xcode/owner steps

## Phase 4 — Data import (Strong + Hevy CSV)

- [ ] `src/lib/import/strongCsv.ts` + `hevyCsv.ts` parsers → common ImportedWorkout IR
- [ ] Map IR → WorkoutHistoryEntry[] (+ optionally a block per routine name): normalized-name matching, weight/reps/RPE, original dates
- [ ] Profile → "Importar datos" entry: file picker (expo-document-picker or paste), preview card (N workouts, N exercises, date range), confirm/cancel
- [ ] Fixtures + vitest for both parsers (quoted fields, locale decimals, missing columns)
- [ ] History cap: raise/handle 100-entry slice for imports (decision logged)

## Phase 5 — Canvas performance pass

- [ ] Find canvas/grid components (HomeTab? BlocksScreen?) — profile re-render paths
- [ ] Selector-based Zustand subscriptions where whole-store is consumed
- [ ] React.memo pure tiles; useCallback handlers passed to lists
- [ ] Gestures: verify worklets, no setState during drag
- [ ] Virtualize lists that can exceed ~20 items
- [ ] Before/after notes per fix in PROGRESS.md

## Polish loop (indefinite)

1. Burn down 183 lint warnings → 0
2. Per-iteration screen audit vs design system (audit:design errors: ~50 files use deprecated token shims)
3. Empty/error/loading states
4. workoutStore action tests (vitest)
5. A11y: labels, ≥44px targets, contrast (new ink/gold pairs)
6. Re-expand this plan with justified subtasks
