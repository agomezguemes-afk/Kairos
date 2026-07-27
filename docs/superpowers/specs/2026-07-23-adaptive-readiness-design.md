# Kairos · Adaptive Readiness Engine — Design

**Date:** 2026-07-23
**Status:** Design — pending user review
**Owner:** Álvaro
**Branch:** `feat/night-run`
**Scope:** Replace the training-load-only "Tu estado hoy" heuristic with a real signal-fusion engine — personal HRV/sleep baseline + training load + goal + adherence — and thread its output into the progression engine (weight/reps suggestions), the Kai signal card, and the readiness headline. Gated behind the existing HealthKit native-activation step; ships fully functional today via graceful degradation.

---

## 1 · Vision

"Tu estado hoy" is currently a plausible-looking number computed only from `workoutHistory` — no biometrics, no goal, no sense of whether the user is actually keeping to their plan. Álvaro's explicit correction: it shouldn't be invented, and the fix isn't a nicer score — it's a real, continuously-updating algorithm that processes recovery data (HRV, sleep) alongside the user's stated goal and their day-to-day training behavior, and pushes that fusion into what the app actually *recommends*: how much weight/reps to suggest, what Kai's daily nudge says, and what the headline claims.

This spec covers **Phase 1** only: the fusion engine plus its injection into the *existing* progression/suggestion surfaces. **Phase 2** — automatically changing *which exercises* appear in a session — is explicitly deferred (§9); it needs its own exercise-equivalence data model and its own UX decision about silent vs. confirmed swaps, neither of which exist today.

---

## 2 · Scope

**In:**
- `src/store/healthStore.ts` — new persisted store: rolling biometric sample history + derived personal baseline.
- `src/lib/health/healthkit.ts` — `readHRV()` / `readSleepHours()`, mirroring the existing `readBodyWeight()` never-throws contract.
- `src/lib/readiness/adaptiveEngine.ts` — pure fusion core: baseline computation, recovery z-scoring, goal-weighted response curve, adherence signal, single `AdaptationSignal` output.
- Non-breaking, optional-parameter extension of `suggestNextValues`, `inSessionWeightNudge`, `applyProgression` (all in `src/lib/progression/`).
- `readiness.ts`'s `computeReadiness`/`buildHeadline` consult the fused signal instead of training-load alone.
- One new `KaiSignal` variant (`kind: 'recovery-adjust'`) in `src/features/planner/lib/kaiSignal.ts`.
- Full unit test coverage (baseline edge cases, per-goal curve, fusion, regression guarantees on the 3 progression functions).

**Out (Phase 2, future spec):**
- Automatic exercise substitution ("swap heavy squat for mobility today").
- Automatic rest-timer adjustment.
- Which-workout-to-do-today recommendation across disciplines/blocks.
- Any UI surfacing the raw HRV/sleep numbers themselves (this spec is about *behavior* changing, not a new chart).

**Out (permanently, unless Álvaro asks):**
- Any ML/model training. Everything here is deterministic arithmetic over a personal baseline — explainable and testable, in keeping with the progression engine's existing "no ML, no recommendation engine" pin (see §6.1 for how this spec relates to that pin).

---

## 3 · Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Biometric state | New `healthStore.ts` (Zustand + persist) | Matches existing convention of separate domain stores (`uiStore`, `scheduleStore`, `workoutStore`) rather than growing `workoutStore` further. |
| Baseline model | Personal rolling mean/stddev (14–30 day window), not population thresholds | HRV is only meaningful relative to *your* normal — this is the standard approach (Whoop/Oura). Avoids false "bad recovery" signals for naturally low/high-HRV individuals. |
| Minimum data for confidence | 7 days of samples | Below this, variance estimates are unstable; engine reports `confidence: 'low'` and the consumer falls back to today's existing behavior. |
| Goal source of truth | `UserProfile.primaryGoal` | `workoutStore.userGoal` is a separate, differently-typed field (4 values vs. 6, no overlap guarantee) — flagged as legacy, not read by the new engine. |
| Injection style | Additional **optional** trailing parameter on existing pure functions | Zero breaking changes; omitting it reproduces today's exact output (verified by regression tests, §8). |
| Adherence signal | Derived from data already in `workoutHistory` + `UserProfile.weeklyFrequency` | No new tracking; purely a new pure function over existing shapes. |
| Fusion output | Single scalar `AdaptationSignal` (not separate per-consumer signals) | One number, multiple readers — keeps the mental model simple ("today the app is being more/less conservative"), while `dominant` preserves which input drove it, for honest copy. |

---

## 4 · Data model

```ts
// src/lib/health/types.ts (additions)

export interface BiometricSample {
  date: ISODate;               // "2026-07-23", local day the sample belongs to
  hrvMs: number | null;        // HRV (SDNN, ms) — null if not read that day
  sleepHours: number | null;   // total sleep — null if not read that day
}

// src/store/healthStore.ts

interface HealthState {
  samples: BiometricSample[];        // rolling window, newest last, capped at 30
  _hasHydrated: boolean;
  recordSample: (s: BiometricSample) => void;   // upserts by date, trims to 30
  setHydrated: (v: boolean) => void;
}

// src/lib/readiness/adaptiveEngine.ts

export interface BiometricBaseline {
  hrvMean: number | null;
  hrvStdDev: number | null;
  sleepMean: number | null;
  sleepStdDev: number | null;
  sampleCount: number;
  confident: boolean;          // sampleCount >= 7
}

export interface AdaptationSignal {
  /** -1 (strongly deload) .. 0 (neutral) .. +1 (cleared to push) */
  value: number;
  confidence: 'low' | 'medium' | 'high';
  /** Which input most drove the value — for honest, non-generic copy. */
  dominant: 'recovery' | 'load' | 'adherence' | 'neutral';
}
```

`BiometricBaseline` and `AdaptationSignal` are plain data — no class, no hidden state. `healthStore` is the only stateful piece, and it holds nothing but the raw sample log; all scoring is recomputed on read.

---

## 5 · Core algorithm (`adaptiveEngine.ts`)

**5.1 · Baseline** — `computeBiometricBaseline(samples, now)`: mean + population stddev of `hrvMs` and `sleepHours` over the trailing 14 days (configurable), ignoring null entries independently per metric. `confident = sampleCount >= 7` where `sampleCount` is the lesser of the two metrics' non-null counts.

**5.2 · Recovery z-score** — `scoreRecoverySignal(today, baseline)`: for each metric with both a today-value and a confident baseline, compute `(today - mean) / stdDev`, clamp to `[-2, 2]`, normalize to `[-1, 1]`. Average across available metrics (1 or 2). Returns `null` if neither metric has both a sample and a baseline — the caller treats `null` as "no recovery signal today," not as zero (zero would silently claim "average," which is a claim we have no data for).

**5.3 · Goal-weighted response curve** — a lookup table keyed by `FitnessGoal`, each entry `{ down: number; up: number }` multipliers applied asymmetrically to a negative/positive fused value before clamping to `[-1, 1]`:

```ts
const GOAL_RESPONSE: Record<FitnessGoal, { down: number; up: number }> = {
  strength:     { down: 1.3, up: 0.7 },  // protect PRs/CNS — quick to back off, slow to push
  muscle_gain:  { down: 1.2, up: 0.8 },
  endurance:    { down: 1.0, up: 1.0 },
  wellness:     { down: 0.9, up: 0.9 },  // gentle both ways
  weight_loss:  { down: 1.0, up: 1.0 },
  flexibility:  { down: 0.8, up: 0.8 },
};
```
`null` goal (profile incomplete) uses `{ down: 1.0, up: 1.0 }` — neutral, same as today.

**5.4 · Adherence signal** — `scoreAdherence(sessionsLast7Days, weeklyFrequency, history)`: compares actual vs. planned frequency (already computable — `sessionsLast7Days` exists in `readiness.ts`) and recent RPE trend from completed sets. Consistently *under*-training relative to `weeklyFrequency` nudges the fused signal toward "ease back in gently" (not toward blame); consistently *over*-training (more sessions than planned, rising RPE) nudges toward caution, independent of biometrics — this is the "interacción diaria" input Álvaro asked for, and it works even with zero HealthKit data.

> **Amendment (2026-07-27, Álvaro).** A post-implementation review found that the framing above — "works even with zero HealthKit data" — understated the risk: it meant the load+adherence-only path (`confidence: 'medium'`) was already wired into live production behavior (progression nudges, Kai card, headline) with no HealthKit setup at all. Álvaro's explicit decision: gate the adaptation signal so it can never influence any consumer until `confidence === 'high'` (real biometric data, HealthKit active with ≥7 samples). The load+adherence computation described here still runs internally on every `computeReadiness` call — useful for future analysis/debugging — but its result is discarded (`null`) at the `readiness.ts` call site whenever confidence isn't `'high'`, superseding this section's original implication that the load+adherence path is already live.

**5.5 · Fusion** — `computeAdaptationSignal(inputs)`: weighted average of the recovery z-score (weight 0.5 when present), the existing training-load signals from `readiness.ts` (`energia`/`fuerza`/`recuperacion`, weight 0.3), and the adherence signal (weight 0.2), re-normalized over whichever components are actually present (graceful degradation — see §7). The result is passed through the goal curve (§5.3). `confidence` is `'high'` when recovery signal is present and biometric-confident, `'medium'` when only load+adherence are present, `'low'` when even those are thin (e.g. brand-new user). `dominant` is whichever weighted component had the largest absolute contribution.

---

## 6 · Integration seams

**6.1 · Relationship to the progression engine's existing pin.** `suggestNextValues.ts` carries this header comment today: *"Pinned v1 rules (DO NOT exceed — no ML, no recommendation engine)"*. This spec deliberately extends that scope, at Álvaro's explicit request for a deeper adaptive system — but stays inside the *spirit* of the pin: everything remains deterministic, explainable arithmetic (a z-score and a weighted average), not a trained model or opaque recommender. The comment will be updated in the implementation PR to describe the new invariant precisely: *"the RPE nudge itself is unchanged; an optional AdaptationSignal scales/caps it, never replaces the RPE input."*

**6.2 · `suggestNextValues` / `inSessionWeightNudge` / `applyProgression`** each gain one optional trailing parameter:

```ts
export function suggestNextValues(
  fields: FieldDefinition[],
  history: ExerciseHistory,
  adaptation?: AdaptationSignal,
): SuggestedValues
```

Inside, the existing `rpeNudgeKg(rpe)` result is scaled by `adaptation`, applied as a modifier, never as an override:
- If `adaptation.value <= -0.5` (strong deload signal) and the RPE nudge is `+2.5` (an "increase"): the increase is suppressed (held at 0) — a bad-recovery day never produces a bigger ask even if last session's RPE alone said "easy."
- If `adaptation.value <= -0.5` and the RPE nudge is `-2.5` (a "decrease"): unchanged — the two signals agree, no conflict to resolve.
- If `adaptation.value >= 0.5` (cleared to push) and the RPE nudge is `0` (hold): unchanged — the adaptation signal never *invents* an increase the RPE data didn't already support; it can only dampen or block, never manufacture upward movement. This keeps the guarantee simple and conservative: adaptation makes the app more cautious, never more aggressive than the existing RPE-only rule would already be.
- `adaptation` omitted or `undefined` → byte-identical to current behavior.

`inSessionWeightNudge` and `applyProgression` (which calls `suggestNextValues` internally) receive the same optional parameter and forward it unchanged.

**6.3 · `readiness.ts`.** `computeReadiness` gains an optional 3rd parameter `biometrics?: BiometricBaseline & { today: BiometricSample }`. When present, `buildHeadline` consults the fused `AdaptationSignal` (computed internally) instead of only `energia`/`fuerza`/`recuperacion`, and can produce grounded copy like *"Dormiste poco esta semana — hoy toca ir más suave"* keyed off `dominant`. When absent, output is unchanged from today.

**6.4 · Kai signal.** New rule in `kaiSignal()`, inserted before the existing `'no-plan'`/`'first-time'` rules (highest-relevance-first ordering already established): when `adaptationSignal.confidence !== 'low'` and `Math.abs(value) > 0.5`, return `{ id: 'recovery-adjust', tone: value < 0 ? 'focus' : 'progress', message: <grounded in dominant> }`. No action button — this is information, matching the existing `'done'`/`'no-plan'` pattern.

---

## 7 · HealthKit read layer

`src/lib/health/healthkit.ts` gains two functions mirroring `readBodyWeight()`'s exact contract (lazy native require, never throws, resolves `null` on any failure):

```ts
export async function readHRV(): Promise<number | null>       // ms, latest daily average
export async function readSleepHours(): Promise<number | null> // hours, most recent night
```

A new daily task (wired into app foreground/launch, not a background job — no native scheduling infra exists or is being added) calls both, plus reads today's date, and calls `healthStore.getState().recordSample({ date: todayISO(), hrvMs, sleepHours })`. If `isHealthKitAvailable()` is false (native not yet activated, or permissions denied), both resolve `null` and no sample is recorded — the store simply stays empty, which is the same as "no biometrics" everywhere else in this design.

---

## 8 · Degradation & error handling

Every layer is independently null-safe — there is no code path that treats missing data as a false "neutral" claim:

- **No HealthKit activation at all** (today's actual state): `healthStore.samples` stays empty forever → `computeBiometricBaseline` returns `confident: false` → `scoreRecoverySignal` returns `null` → fusion re-normalizes over load + adherence only → `confidence: 'medium'` at best. Progression functions behave exactly as they do today whenever the caller doesn't have a signal to pass (and until HealthKit is active, no caller will).
- **Partial data** (e.g., Watch captured sleep but not HRV that night): each metric scored independently; fusion re-normalizes over whatever's non-null.
- **New user, <7 days of samples**: `confident: false`, same fallback as "no HealthKit" above.
- **Corrupt/NaN sample** (defensive, matches the existing `Number.isFinite(h.endedAt)` guard in `readiness.ts`): filtered out before baseline computation, never propagates NaN into a score.

---

## 9 · Non-goals / Phase 2 pointer

Deliberately not designed here (per §2's Out list): automatic exercise substitution. The investigation for this spec confirmed the building blocks that *would* make it feasible — `ExerciseCard.muscle_groups` and `ExerciseLibraryEntry.muscleGroups` are already structured (not name-inferred), and `activeWorkout.exercises` is already a non-destructive per-session clone of the block template (confirmed: `appendActiveExercise`/`removeActiveExercise` never write back to `state.blocks`) — so a "swap for today only" mechanism has an architecturally clean home when it's designed. What's missing and needs its own spec: an equipment/difficulty/intensity tagging model (today's library only has `discipline` + `muscleGroups`), and a product decision on silent-swap-with-badge vs. suggest-with-confirmation (the latter respects User Sovereignty from CLAUDE.md; the former is closer to Álvaro's literal wording — worth a dedicated brainstorm).

---

## 10 · Testing plan

All new code is pure functions — no store mocking needed for the engine itself (`healthStore` tested separately, thin).

- **`adaptiveEngine.test.ts`**: baseline with 0/1/6/7/30 samples (confidence boundary); z-score with today above/below/at mean, with zero stddev (guard divide-by-zero → treat as no signal, not Infinity); all 6 `FitnessGoal` values through the response curve including `null` goal; fusion with all-present / recovery-missing / load-only / adherence-only input combinations; `dominant` correctly attributed in a tie-break case.
- **Regression tests** (critical, per CLAUDE.md's "every commit compiles and runs" + no-regression discipline): call `suggestNextValues`, `inSessionWeightNudge`, `applyProgression` with the new parameter omitted entirely and assert output is deep-equal to a snapshot taken from the current (pre-change) test suite — this is the hard guarantee that Phase 1 cannot regress tonight's already-shipped progression work.
- **Integration-shaped case**: strength-goal user, poor sleep + low HRV (z-score ≈ -1.5), last set RPE=6 (would normally nudge +2.5) → assert final suggested weight equals the carried-forward value (nudge suppressed), not +2.5.
- **`healthStore.test.ts`**: upsert-by-date semantics, 30-sample cap/eviction, hydration flag.
- **`kaiSignal.test.ts`**: new `recovery-adjust` rule fires only above the confidence/magnitude threshold and doesn't shadow higher-priority existing rules (`resume`, `done`).

---

## 11 · Rollout

Same gating as the existing HealthKit scaffold (`docs/superpowers/specs/healthkit-integration.md`): everything in this spec ships as inert, fully-tested code paths that produce today's exact behavior until Álvaro runs the one-time native activation (`npx expo install react-native-health` + plugin config + `expo prebuild --clean && expo run:ios`). No native code is touched by this work; nothing here requires a rebuild to merge safely.
