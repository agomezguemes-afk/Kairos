# Adaptive Readiness Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the training-load-only "Tu estado hoy" heuristic with a real signal-fusion engine (personal HRV/sleep baseline + training load + goal + adherence) whose output flows into the progression engine's weight/reps suggestions, the Kai signal card, and the readiness headline — with zero behavior change until Álvaro activates HealthKit natively.

**Architecture:** A new pure module (`src/lib/readiness/adaptiveEngine.ts`) computes a personal biometric baseline (rolling mean/stddev, not population thresholds) and fuses it with the existing training-load signals, a goal-weighted response curve, and a real adherence signal into one `AdaptationSignal`. Three existing pure functions in `src/lib/progression/` gain an **optional trailing parameter** that consumes this signal — omitting it reproduces today's exact behavior, which is enforced by regression tests. A new `healthStore.ts` (Zustand + persist, same shape as the existing `uiStore.ts`) holds the raw sample log; nothing else is stateful.

**Tech Stack:** TypeScript (strict), Zustand + `persist` + AsyncStorage, Vitest for all pure-function tests. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md` — read it before starting if anything below is ambiguous; this plan implements it section-by-section.

## Global Constraints

- Every new numeric-modeling function is deterministic arithmetic (mean/stddev/z-score/weighted-average) — no ML, no trained model, no opaque recommender. This is a deliberate, spec-approved extension of `suggestNextValues.ts`'s existing "no ML, no recommendation engine" pin (spec §6.1) — stays inside its spirit, extends its letter.
- All three progression-engine signature changes (`suggestNextValues`, `inSessionWeightNudge`, `applyProgression`) add the new parameter **only as an optional trailing argument**. Every existing call site (`ActiveWorkoutScreen.tsx:274`, `ActiveWorkoutScreen.tsx:358`, `applyProgression.ts:50`) must compile and behave identically without modification.
- The adaptation signal may only **dampen or block** an RPE-driven weight increase; it must never invent an increase the RPE data didn't already produce (spec §6.2).
- No native code, no `app.json` plugin changes, no `expo prebuild`. Everything ships inert until Álvaro's separate HealthKit activation step.
- `UserProfile.primaryGoal` is the sole goal input; `workoutStore.userGoal` is not read by any new code (spec §3).
- TypeScript strict mode — no `any` in new code except where mirroring the existing lazy-require pattern in `healthkit.ts` (that file already uses `any` for the untyped native module boundary; match it, don't introduce new `any` elsewhere).
- User-facing copy (Kai signal messages, headline strings) is Spanish, matching the existing tone in `readiness.ts`/`kaiSignal.ts`.
- Commit after every task (not every step) — each task is one logical, independently-revertible unit.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/health/types.ts` | Add `BiometricSample` interface |
| `src/lib/health/healthkit.ts` | Add `readHRV()`, `readSleepHours()`; extend `PERMISSIONS.read` |
| `src/lib/health/healthkit.test.ts` | **New** — covers the two new read functions' never-throws contract |
| `src/lib/health/dailySync.ts` | **New** — `syncDailyBiometricSample()`, called once on app launch |
| `src/lib/health/dailySync.test.ts` | **New** |
| `src/store/healthStore.ts` | **New** — rolling sample log, Zustand + persist |
| `src/store/healthStore.test.ts` | **New** |
| `src/lib/readiness/adaptiveEngine.ts` | **New** — baseline, recovery z-score, goal curve, adherence, fusion |
| `src/lib/readiness/adaptiveEngine.test.ts` | **New** |
| `src/lib/progression/suggestNextValues.ts` | Add `applyAdaptationToNudge()`, optional `adaptation` param |
| `src/lib/progression/suggestNextValues.test.ts` | Add regression + new-behavior tests |
| `src/lib/progression/inSessionNudge.ts` | Add optional `adaptation` param |
| `src/lib/progression/inSessionNudge.test.ts` | Add regression + new-behavior tests |
| `src/lib/progression/applyProgression.ts` | Thread optional `adaptation` param through |
| `src/lib/progression/applyProgression.test.ts` | Add regression + new-behavior tests |
| `src/lib/readiness/readiness.ts` | Add `ReadinessBiometricContext`, `adaptation` field on `ReadinessSnapshot`, headline update |
| `src/lib/readiness/readiness.test.ts` | Add tests for the biometric path |
| `src/features/planner/lib/kaiSignal.ts` | Add `recovery-adjust` rule |
| `src/features/planner/lib/kaiSignal.test.ts` | Add tests |
| `App.tsx` | Wire `syncDailyBiometricSample()` into the existing launch `useEffect` |
| `src/lib/readiness/useReadinessSnapshot.ts` | **New** — shared hook assembling live store state into `computeReadiness`, single source of truth for every UI consumer |
| `src/features/planner/components/ReadinessLine.tsx` | Wire to `useReadinessSnapshot` (was calling `computeReadiness` directly with no biometrics) |
| `src/features/planner/TodayPlanner.tsx` | Pass `readinessSnapshot.adaptation` into the `kaiSignal()` call |
| `src/screens/ActiveWorkoutScreen.tsx` | Pass `readinessSnapshot.adaptation` into both `suggestNextValues`/`inSessionWeightNudge` call sites |

**Note on `BiometricSample.date`:** the spec's pseudocode used `ISODate`, but that type lives in `src/types/schedule.ts` (a scheduling-feature type). To keep `src/lib/health/` decoupled from feature-level types, this plan uses a plain `string` (`"YYYY-MM-DD"`) with a doc comment instead — a deliberate simplification over the spec's exact type name, not a behavior change.

**Deliberately out of scope for this plan:** `applyProgression`'s three AI-block-generation call sites (`src/lib/ai/conversation/blockFromBrief.ts:108`, `aiBlockBuilder.ts:122`, `hybridFastPath.ts:72`) are NOT wired to pass an `adaptation` argument — they continue calling with 2 arguments exactly as today. Those modules don't currently receive `UserProfile`/`healthStore` data at the point they call `applyProgression`, and threading that through is a separate, larger change to the AI conversation pipeline. Since Task 9 made the parameter optional, this is a natural, low-risk follow-up once needed — not a gap in this plan's correctness.

---

### Task 1: HRV + sleep reads in the HealthKit layer

**Files:**
- Modify: `src/lib/health/types.ts`
- Modify: `src/lib/health/healthkit.ts`
- Create: `src/lib/health/healthkit.test.ts`

**Interfaces:**
- Produces: `BiometricSample { date: string; hrvMs: number | null; sleepHours: number | null }` (types.ts), `readHRV(): Promise<number | null>`, `readSleepHours(): Promise<number | null>` (healthkit.ts)

- [ ] **Step 1: Add `BiometricSample` to types.ts**

Add to `src/lib/health/types.ts` (end of file):

```ts
/** One day's biometric readout. `date` is a local calendar day, "YYYY-MM-DD". */
export interface BiometricSample {
  date: string;
  hrvMs: number | null;
  sleepHours: number | null;
}
```

- [ ] **Step 2: Extend HealthKit read permissions**

In `src/lib/health/healthkit.ts`, change:

```ts
const PERMISSIONS = {
  permissions: {
    read: ['Weight', 'Height', 'DateOfBirth'],
    write: ['Workout', 'ActiveEnergyBurned'],
  },
};
```

to:

```ts
const PERMISSIONS = {
  permissions: {
    read: ['Weight', 'Height', 'DateOfBirth', 'HeartRateVariability', 'SleepAnalysis'],
    write: ['Workout', 'ActiveEnergyBurned'],
  },
};
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/health/healthkit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readHRV, readSleepHours, isHealthKitAvailable } from './healthkit';

describe('HealthKit — biometric reads (native module absent in test env)', () => {
  it('isHealthKitAvailable is false without the native module', () => {
    expect(isHealthKitAvailable()).toBe(false);
  });

  it('readHRV resolves null, never throws, when native is unavailable', async () => {
    await expect(readHRV()).resolves.toBeNull();
  });

  it('readSleepHours resolves null, never throws, when native is unavailable', async () => {
    await expect(readSleepHours()).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/health/healthkit.test.ts`
Expected: FAIL — `readHRV`/`readSleepHours` are not exported yet.

- [ ] **Step 5: Implement `readHRV` and `readSleepHours`**

Add to `src/lib/health/healthkit.ts`, after `readBodyWeight`:

```ts
/**
 * Read latest HRV (SDNN, ms) from the last 24h. Returns null when
 * unavailable / not authorized / no data. Never throws.
 */
export async function readHRV(): Promise<number | null> {
  const native = getNative();
  if (!native) return null;
  return new Promise<number | null>((resolve) => {
    try {
      const options = {
        startDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      };
      native.getHeartRateVariabilitySamples(options, (err: string | null, results: any[]) => {
        if (err || !Array.isArray(results) || results.length === 0) {
          resolve(null);
          return;
        }
        const latest = results[results.length - 1];
        resolve(typeof latest?.value === 'number' ? latest.value : null);
      });
    } catch (e) {
      if (__DEV__) console.warn('[Kairos/HealthKit] getHeartRateVariabilitySamples threw:', e);
      resolve(null);
    }
  });
}

/**
 * Read total asleep hours for the most recent night (last 24h window).
 * Sums only ASLEEP* segments — INBED includes awake-in-bed time, which
 * would overstate sleep. Returns null when unavailable / no data. Never
 * throws.
 */
export async function readSleepHours(): Promise<number | null> {
  const native = getNative();
  if (!native) return null;
  return new Promise<number | null>((resolve) => {
    try {
      const options = {
        startDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      };
      native.getSleepSamples(options, (err: string | null, results: any[]) => {
        if (err || !Array.isArray(results) || results.length === 0) {
          resolve(null);
          return;
        }
        const asleepStages = new Set(['ASLEEP', 'ASLEEP_CORE', 'ASLEEP_DEEP', 'ASLEEP_REM']);
        const asleepMs = results
          .filter((s) => asleepStages.has(s?.value))
          .reduce((sum, s) => {
            const start = new Date(s.startDate).getTime();
            const end = new Date(s.endDate).getTime();
            return sum + Math.max(0, end - start);
          }, 0);
        resolve(asleepMs > 0 ? asleepMs / 3_600_000 : null);
      });
    } catch (e) {
      if (__DEV__) console.warn('[Kairos/HealthKit] getSleepSamples threw:', e);
      resolve(null);
    }
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/health/healthkit.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/health/types.ts src/lib/health/healthkit.ts src/lib/health/healthkit.test.ts
git commit -m "feat(health): add HRV and sleep reads to the HealthKit layer"
```

---

### Task 2: `healthStore` — rolling biometric sample log

**Files:**
- Create: `src/store/healthStore.ts`
- Create: `src/store/healthStore.test.ts`

**Interfaces:**
- Consumes: `BiometricSample` from `src/lib/health/types.ts` (Task 1)
- Produces: `useHealthStore` (Zustand hook) with state `{ samples: BiometricSample[]; _hasHydrated: boolean }` and action `recordSample(sample: BiometricSample): void`

- [ ] **Step 1: Write the failing tests**

Create `src/store/healthStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useHealthStore } from './healthStore';

function sample(date: string, hrvMs: number | null = 50, sleepHours: number | null = 7) {
  return { date, hrvMs, sleepHours };
}

beforeEach(() => {
  useHealthStore.setState({ samples: [], _hasHydrated: false });
});

describe('healthStore — recordSample', () => {
  it('appends a new sample', () => {
    useHealthStore.getState().recordSample(sample('2026-07-01'));
    expect(useHealthStore.getState().samples).toHaveLength(1);
  });

  it('upserts by date — recording the same day twice replaces, not duplicates', () => {
    useHealthStore.getState().recordSample(sample('2026-07-01', 50, 7));
    useHealthStore.getState().recordSample(sample('2026-07-01', 60, 8));
    const { samples } = useHealthStore.getState();
    expect(samples).toHaveLength(1);
    expect(samples[0].hrvMs).toBe(60);
    expect(samples[0].sleepHours).toBe(8);
  });

  it('keeps samples sorted oldest-first', () => {
    useHealthStore.getState().recordSample(sample('2026-07-03'));
    useHealthStore.getState().recordSample(sample('2026-07-01'));
    useHealthStore.getState().recordSample(sample('2026-07-02'));
    const dates = useHealthStore.getState().samples.map((s) => s.date);
    expect(dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('caps at 30 samples, evicting the oldest', () => {
    for (let i = 1; i <= 35; i++) {
      const d = `2026-01-${String(i).padStart(2, '0')}`;
      useHealthStore.getState().recordSample(sample(i <= 31 ? d : `2026-02-${String(i - 31).padStart(2, '0')}`));
    }
    const { samples } = useHealthStore.getState();
    expect(samples).toHaveLength(30);
    expect(samples[0].date).not.toBe('2026-01-01'); // oldest evicted
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/healthStore.test.ts`
Expected: FAIL — `./healthStore` module does not exist.

- [ ] **Step 3: Implement `healthStore.ts`**

Create `src/store/healthStore.ts`:

```ts
// src/store/healthStore.ts
// Rolling biometric sample log (HRV, sleep) — raw material for the adaptive
// readiness engine's personal baseline (src/lib/readiness/adaptiveEngine.ts).
// Kept apart from workoutStore on purpose, same rationale as uiStore: a
// focused, independently-persisted slice, not domain state.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BiometricSample } from '../lib/health/types';

const MAX_SAMPLES = 30;

interface HealthState {
  /** Rolling window, oldest first, one entry per date, capped at MAX_SAMPLES. */
  samples: BiometricSample[];
  _hasHydrated: boolean;
  /** Upserts by date — re-syncing the same day replaces, never duplicates. */
  recordSample: (sample: BiometricSample) => void;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      samples: [],
      _hasHydrated: false,
      recordSample: (sample) =>
        set((s) => {
          const withoutToday = s.samples.filter((x) => x.date !== sample.date);
          const next = [...withoutToday, sample].sort((a, b) => a.date.localeCompare(b.date));
          return { samples: next.slice(-MAX_SAMPLES) };
        }),
    }),
    {
      name: 'kairos-health',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ samples: s.samples }),
      onRehydrateStorage: () => () => useHealthStore.setState({ _hasHydrated: true }),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/healthStore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/store/healthStore.ts src/store/healthStore.test.ts
git commit -m "feat(health): add healthStore for rolling biometric samples"
```

---

### Task 3: `adaptiveEngine.ts` — personal baseline

**Files:**
- Create: `src/lib/readiness/adaptiveEngine.ts`
- Create: `src/lib/readiness/adaptiveEngine.test.ts`

**Interfaces:**
- Consumes: `BiometricSample` from `src/lib/health/types.ts`
- Produces: `BiometricBaseline { hrvMean: number | null; hrvStdDev: number | null; sleepMean: number | null; sleepStdDev: number | null; sampleCount: number; confident: boolean }`, `computeBiometricBaseline(samples: BiometricSample[], now?: number): BiometricBaseline`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/readiness/adaptiveEngine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeBiometricBaseline } from './adaptiveEngine';
import type { BiometricSample } from '../health/types';

const NOW = new Date('2026-07-24T08:00:00Z').getTime();
const DAY = 24 * 3600 * 1000;

function samplesOverDays(n: number, hrv = 50, sleep = 7): BiometricSample[] {
  const out: BiometricSample[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(NOW - i * DAY).toISOString().slice(0, 10);
    out.push({ date: d, hrvMs: hrv, sleepHours: sleep });
  }
  return out;
}

describe('computeBiometricBaseline', () => {
  it('is not confident with zero samples', () => {
    const b = computeBiometricBaseline([], NOW);
    expect(b.confident).toBe(false);
    expect(b.sampleCount).toBe(0);
    expect(b.hrvMean).toBeNull();
    expect(b.sleepMean).toBeNull();
  });

  it('is not confident with 6 samples (below the 7-day minimum)', () => {
    const b = computeBiometricBaseline(samplesOverDays(6), NOW);
    expect(b.confident).toBe(false);
    expect(b.sampleCount).toBe(6);
  });

  it('is confident with exactly 7 samples', () => {
    const b = computeBiometricBaseline(samplesOverDays(7), NOW);
    expect(b.confident).toBe(true);
    expect(b.sampleCount).toBe(7);
  });

  it('computes mean and stddev correctly for a known distribution', () => {
    const samples: BiometricSample[] = [
      { date: '2026-07-18', hrvMs: 40, sleepHours: 6 },
      { date: '2026-07-19', hrvMs: 50, sleepHours: 7 },
      { date: '2026-07-20', hrvMs: 60, sleepHours: 8 },
      { date: '2026-07-21', hrvMs: 50, sleepHours: 7 },
      { date: '2026-07-22', hrvMs: 50, sleepHours: 7 },
      { date: '2026-07-23', hrvMs: 50, sleepHours: 7 },
      { date: '2026-07-24', hrvMs: 50, sleepHours: 7 },
    ];
    const b = computeBiometricBaseline(samples, NOW);
    expect(b.hrvMean).toBeCloseTo(50, 5);
    expect(b.sleepMean).toBeCloseTo(7, 5);
    expect(b.hrvStdDev).toBeGreaterThan(0);
  });

  it('ignores samples outside the 14-day window', () => {
    const old = { date: '2026-01-01', hrvMs: 999, sleepHours: 999 };
    const recent = samplesOverDays(7);
    const b = computeBiometricBaseline([old, ...recent], NOW);
    expect(b.hrvMean).not.toBeGreaterThan(100); // 999 excluded
  });

  it('scores each metric independently — missing HRV does not disqualify sleep', () => {
    const samples: BiometricSample[] = samplesOverDays(7).map((s, i) => ({
      ...s,
      hrvMs: i % 2 === 0 ? null : s.hrvMs, // half the days have no HRV reading
    }));
    const b = computeBiometricBaseline(samples, NOW);
    expect(b.sleepMean).not.toBeNull();
    // sampleCount is the LESSER of the two non-null counts (honest confidence)
    expect(b.sampleCount).toBeLessThan(7);
    expect(b.confident).toBe(false);
  });

  it('non-finite values never poison the mean', () => {
    const samples: BiometricSample[] = [
      ...samplesOverDays(7),
      { date: '2026-07-17', hrvMs: NaN, sleepHours: Infinity },
    ];
    const b = computeBiometricBaseline(samples, NOW);
    expect(Number.isFinite(b.hrvMean)).toBe(true);
    expect(Number.isFinite(b.sleepMean)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the baseline function**

Create `src/lib/readiness/adaptiveEngine.ts`:

```ts
// KAIROS — Adaptive Readiness Engine (Phase 1)
//
// Fuses a personal HRV/sleep baseline with the existing training-load
// signals (readiness.ts), the user's stated goal, and real adherence, into
// a single AdaptationSignal. Every function here is pure, deterministic
// arithmetic (mean/stddev/z-score/weighted average) — no ML, no trained
// model. See docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md.
//
// Deliberately decoupled from readiness.ts (no import in either direction
// except readiness.ts → this module) so there's no circular dependency:
// readiness.ts calls into this engine, this engine never reaches back.

import type { BiometricSample } from '../health/types';

const MS_PER_DAY = 24 * 3600 * 1000;
const BASELINE_WINDOW_DAYS = 14;
const MIN_CONFIDENT_SAMPLES = 7;

export interface BiometricBaseline {
  hrvMean: number | null;
  hrvStdDev: number | null;
  sleepMean: number | null;
  sleepStdDev: number | null;
  /** The LESSER of the two metrics' non-null counts — honest confidence,
   *  never overclaimed when one metric is entirely unmeasured. */
  sampleCount: number;
  confident: boolean;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function finiteNumbers(values: (number | null)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Compute the personal baseline from the trailing BASELINE_WINDOW_DAYS of
 * samples. `now` exposed so tests can pin time.
 */
export function computeBiometricBaseline(
  samples: BiometricSample[],
  now = Date.now(),
): BiometricBaseline {
  const cutoff = now - BASELINE_WINDOW_DAYS * MS_PER_DAY;
  const inWindow = samples.filter((s) => new Date(s.date).getTime() >= cutoff);

  const hrvValues = finiteNumbers(inWindow.map((s) => s.hrvMs));
  const sleepValues = finiteNumbers(inWindow.map((s) => s.sleepHours));

  const hrvMean = hrvValues.length > 0 ? mean(hrvValues) : null;
  const sleepMean = sleepValues.length > 0 ? mean(sleepValues) : null;
  const sampleCount = Math.min(hrvValues.length, sleepValues.length);

  return {
    hrvMean,
    hrvStdDev: hrvMean != null ? stdDev(hrvValues, hrvMean) : null,
    sleepMean,
    sleepStdDev: sleepMean != null ? stdDev(sleepValues, sleepMean) : null,
    sampleCount,
    confident: sampleCount >= MIN_CONFIDENT_SAMPLES,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/readiness/adaptiveEngine.ts src/lib/readiness/adaptiveEngine.test.ts
git commit -m "feat(readiness): add personal biometric baseline computation"
```

---

### Task 4: `adaptiveEngine.ts` — recovery z-score

**Files:**
- Modify: `src/lib/readiness/adaptiveEngine.ts`
- Modify: `src/lib/readiness/adaptiveEngine.test.ts`

**Interfaces:**
- Consumes: `BiometricBaseline` (Task 3)
- Produces: `RecoverySample { hrvMs: number | null; sleepHours: number | null }`, `scoreRecoverySignal(today: RecoverySample, baseline: BiometricBaseline): number | null`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/readiness/adaptiveEngine.test.ts`:

```ts
import { scoreRecoverySignal, computeBiometricBaseline as _cbb } from './adaptiveEngine';
```

(Add `scoreRecoverySignal` to the existing import line from Step 1 of Task 3 instead of a new import line — i.e. change `import { computeBiometricBaseline } from './adaptiveEngine';` to `import { computeBiometricBaseline, scoreRecoverySignal } from './adaptiveEngine';`.)

```ts
describe('scoreRecoverySignal', () => {
  const baseline = { hrvMean: 50, hrvStdDev: 10, sleepMean: 7, sleepStdDev: 1, sampleCount: 14, confident: true };

  it('today at the mean scores ~0', () => {
    const score = scoreRecoverySignal({ hrvMs: 50, sleepHours: 7 }, baseline);
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(0, 1);
  });

  it('today well below the mean scores negative', () => {
    const score = scoreRecoverySignal({ hrvMs: 30, sleepHours: 5 }, baseline);
    expect(score!).toBeLessThan(-0.5);
  });

  it('today well above the mean scores positive', () => {
    const score = scoreRecoverySignal({ hrvMs: 70, sleepHours: 9 }, baseline);
    expect(score!).toBeGreaterThan(0.5);
  });

  it('clamps extreme outliers instead of scoring unbounded', () => {
    const score = scoreRecoverySignal({ hrvMs: 1000, sleepHours: 20 }, baseline);
    expect(score!).toBeLessThanOrEqual(1);
    expect(score!).toBeGreaterThanOrEqual(-1);
  });

  it('returns null when the baseline is not confident enough to have means', () => {
    const empty = { hrvMean: null, hrvStdDev: null, sleepMean: null, sleepStdDev: null, sampleCount: 0, confident: false };
    expect(scoreRecoverySignal({ hrvMs: 50, sleepHours: 7 }, empty)).toBeNull();
  });

  it('returns null (not zero) when today has no readings at all', () => {
    expect(scoreRecoverySignal({ hrvMs: null, sleepHours: null }, baseline)).toBeNull();
  });

  it('averages over whichever metric is available when the other is missing today', () => {
    const hrvOnly = scoreRecoverySignal({ hrvMs: 30, sleepHours: null }, baseline);
    expect(hrvOnly).not.toBeNull();
  });

  it('never divides by zero when stdDev is 0 (perfectly uniform history)', () => {
    const zeroVariance = { hrvMean: 50, hrvStdDev: 0, sleepMean: 7, sleepStdDev: 0, sampleCount: 14, confident: true };
    const score = scoreRecoverySignal({ hrvMs: 60, sleepHours: 8 }, zeroVariance);
    expect(Number.isFinite(score) || score === null).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: FAIL — `scoreRecoverySignal` is not exported yet.

- [ ] **Step 3: Implement `scoreRecoverySignal`**

Append to `src/lib/readiness/adaptiveEngine.ts`:

```ts
const Z_SCORE_CLAMP = 2;

/** null when stdDev is 0 — no variance to compare against, so no signal. */
function zScoreNormalized(value: number, baselineMean: number, baselineStdDev: number): number | null {
  if (baselineStdDev === 0) return null;
  const z = (value - baselineMean) / baselineStdDev;
  const clamped = Math.max(-Z_SCORE_CLAMP, Math.min(Z_SCORE_CLAMP, z));
  return clamped / Z_SCORE_CLAMP; // → [-1, 1]
}

export interface RecoverySample {
  hrvMs: number | null;
  sleepHours: number | null;
}

/**
 * Score today's recovery relative to the personal baseline, in [-1, 1].
 * Returns null when neither metric has both a today-value and a baseline
 * mean/stdDev — missing data must never be reported as "average" (0).
 */
export function scoreRecoverySignal(
  today: RecoverySample,
  baseline: BiometricBaseline,
): number | null {
  const scores: number[] = [];

  if (typeof today.hrvMs === 'number' && baseline.hrvMean != null && baseline.hrvStdDev != null) {
    const z = zScoreNormalized(today.hrvMs, baseline.hrvMean, baseline.hrvStdDev);
    if (z != null) scores.push(z);
  }
  if (
    typeof today.sleepHours === 'number' &&
    baseline.sleepMean != null &&
    baseline.sleepStdDev != null
  ) {
    const z = zScoreNormalized(today.sleepHours, baseline.sleepMean, baseline.sleepStdDev);
    if (z != null) scores.push(z);
  }

  if (scores.length === 0) return null;
  return mean(scores);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: PASS (15 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/readiness/adaptiveEngine.ts src/lib/readiness/adaptiveEngine.test.ts
git commit -m "feat(readiness): add personal-baseline recovery z-scoring"
```

---

### Task 5: `adaptiveEngine.ts` — training-load mapping + adherence signal

**Files:**
- Modify: `src/lib/readiness/adaptiveEngine.ts`
- Modify: `src/lib/readiness/adaptiveEngine.test.ts`

**Interfaces:**
- Produces: `deriveTrainingLoadSignal(energia: number, fuerza: number, recuperacion: number): number`, `scoreAdherence(sessionsLast7Days: number, weeklyFrequency: number | null): number`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/readiness/adaptiveEngine.test.ts` (add `deriveTrainingLoadSignal, scoreAdherence` to the import):

```ts
describe('deriveTrainingLoadSignal', () => {
  it('maps the 0-100 midpoint (50,50,50) to 0', () => {
    expect(deriveTrainingLoadSignal(50, 50, 50)).toBeCloseTo(0, 5);
  });

  it('maps a perfect 100,100,100 to +1', () => {
    expect(deriveTrainingLoadSignal(100, 100, 100)).toBeCloseTo(1, 5);
  });

  it('maps a floor 0,0,0 to -1', () => {
    expect(deriveTrainingLoadSignal(0, 0, 0)).toBeCloseTo(-1, 5);
  });

  it('averages the three dimensions', () => {
    expect(deriveTrainingLoadSignal(100, 50, 0)).toBeCloseTo(0, 5);
  });
});

describe('scoreAdherence', () => {
  it('neutral (0) when no weekly frequency is set', () => {
    expect(scoreAdherence(3, null)).toBe(0);
  });

  it('neutral when sessions match the plan', () => {
    expect(scoreAdherence(3, 3)).toBe(0);
  });

  it('negative (gentle re-entry) when well under the plan', () => {
    expect(scoreAdherence(1, 4)).toBeLessThan(0);
  });

  it('negative (caution) when meaningfully over the plan', () => {
    expect(scoreAdherence(6, 3)).toBeLessThan(0);
  });

  it('never returns a positive value — adherence only ever flags caution or neutral', () => {
    for (const [sessions, freq] of [[0, 5], [1, 5], [5, 5], [10, 5], [2, 2]] as const) {
      expect(scoreAdherence(sessions, freq)).toBeLessThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: FAIL — both functions unexported.

- [ ] **Step 3: Implement both functions**

Append to `src/lib/readiness/adaptiveEngine.ts`:

```ts
/**
 * Maps the existing training-load dimensions (each 0-100, from
 * readiness.ts's energia/fuerza/recuperacion) onto the same [-1, 1] scale
 * the fusion works in. Takes plain numbers, not a ReadinessSnapshot import —
 * keeps this module decoupled from readiness.ts (which depends on this
 * module, not the other way around).
 */
export function deriveTrainingLoadSignal(
  energia: number,
  fuerza: number,
  recuperacion: number,
): number {
  const avg = (energia + fuerza + recuperacion) / 3;
  return Math.max(-1, Math.min(1, (avg - 50) / 50));
}

/**
 * Adherence signal in [-1, 0] from real behavior — no biometrics needed.
 * Under-training relative to weeklyFrequency nudges toward "ease back in
 * gently"; over-training nudges toward caution. Adherence never pushes the
 * fused signal positive on its own — it only ever flags a reason for
 * caution or neutrality, matching the "never invent a push" rule (spec §6.2).
 */
export function scoreAdherence(sessionsLast7Days: number, weeklyFrequency: number | null): number {
  if (weeklyFrequency == null || weeklyFrequency <= 0) return 0;
  const ratio = sessionsLast7Days / weeklyFrequency;
  if (ratio < 0.5) return -0.6;
  if (ratio < 0.85) return -0.2;
  if (ratio <= 1.3) return 0;
  return -0.4;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: PASS (24 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/readiness/adaptiveEngine.ts src/lib/readiness/adaptiveEngine.test.ts
git commit -m "feat(readiness): add training-load mapping and adherence signal"
```

---

### Task 6: `adaptiveEngine.ts` — goal-weighted fusion

**Files:**
- Modify: `src/lib/readiness/adaptiveEngine.ts`
- Modify: `src/lib/readiness/adaptiveEngine.test.ts`

**Interfaces:**
- Consumes: `FitnessGoal` from `src/types/profile.ts`
- Produces: `AdaptationSignal { value: number; confidence: 'low' | 'medium' | 'high'; dominant: 'recovery' | 'load' | 'adherence' | 'neutral' }`, `AdaptationInputs`, `computeAdaptationSignal(inputs: AdaptationInputs): AdaptationSignal`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/readiness/adaptiveEngine.test.ts` (add `computeAdaptationSignal` to the import):

```ts
describe('computeAdaptationSignal', () => {
  const baseInputs = {
    recoverySignal: null as number | null,
    recoveryConfident: false,
    trainingLoadSignal: 0,
    hasTrainingHistory: true,
    adherenceSignal: 0,
    goal: null,
  };

  it('neutral inputs produce a value near 0', () => {
    const s = computeAdaptationSignal(baseInputs);
    expect(s.value).toBeCloseTo(0, 1);
  });

  it('confidence is "low" for a brand-new user with no history and no recovery signal', () => {
    const s = computeAdaptationSignal({ ...baseInputs, hasTrainingHistory: false });
    expect(s.confidence).toBe('low');
  });

  it('confidence is "medium" with training history but no confident recovery signal', () => {
    const s = computeAdaptationSignal(baseInputs);
    expect(s.confidence).toBe('medium');
  });

  it('confidence is "high" when a confident recovery signal is present', () => {
    const s = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -0.8,
      recoveryConfident: true,
    });
    expect(s.confidence).toBe('high');
  });

  it('strongly negative recovery drives the fused value negative and is marked dominant', () => {
    const s = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -1,
      recoveryConfident: true,
    });
    expect(s.value).toBeLessThan(-0.3);
    expect(s.dominant).toBe('recovery');
  });

  it('strength goal amplifies a negative signal more than it amplifies a positive one', () => {
    const negative = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -0.8,
      recoveryConfident: true,
      goal: 'strength',
    });
    const negativeNeutralGoal = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -0.8,
      recoveryConfident: true,
      goal: null,
    });
    expect(negative.value).toBeLessThan(negativeNeutralGoal.value);
  });

  it('wellness goal dampens both directions relative to a neutral goal', () => {
    const wellness = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -0.8,
      recoveryConfident: true,
      goal: 'wellness',
    });
    const neutral = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -0.8,
      recoveryConfident: true,
      goal: null,
    });
    expect(Math.abs(wellness.value)).toBeLessThan(Math.abs(neutral.value));
  });

  it('output value is always clamped to [-1, 1]', () => {
    const s = computeAdaptationSignal({
      ...baseInputs,
      recoverySignal: -1,
      recoveryConfident: true,
      trainingLoadSignal: -1,
      adherenceSignal: -0.6,
      goal: 'strength',
    });
    expect(s.value).toBeGreaterThanOrEqual(-1);
    expect(s.value).toBeLessThanOrEqual(1);
  });

  it('dominant is "adherence" when adherence is the only non-zero component', () => {
    const s = computeAdaptationSignal({ ...baseInputs, adherenceSignal: -0.6 });
    expect(s.dominant).toBe('adherence');
  });

  it('every FitnessGoal value resolves without throwing', () => {
    const goals = ['strength', 'endurance', 'weight_loss', 'wellness', 'muscle_gain', 'flexibility'] as const;
    for (const goal of goals) {
      expect(() => computeAdaptationSignal({ ...baseInputs, goal })).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: FAIL — `computeAdaptationSignal` unexported.

- [ ] **Step 3: Implement the goal curve and fusion**

Append to `src/lib/readiness/adaptiveEngine.ts`:

```ts
import type { FitnessGoal } from '../../types/profile';

interface GoalResponseCurve {
  down: number;
  up: number;
}

/** Asymmetric response per goal: `down` scales a negative (deload) signal,
 *  `up` scales a positive (push) signal. Strength/muscle_gain react faster
 *  to back off than to push (protect PRs/CNS); wellness/flexibility are
 *  gentler both ways. */
const GOAL_RESPONSE: Record<FitnessGoal, GoalResponseCurve> = {
  strength: { down: 1.3, up: 0.7 },
  muscle_gain: { down: 1.2, up: 0.8 },
  endurance: { down: 1.0, up: 1.0 },
  wellness: { down: 0.9, up: 0.9 },
  weight_loss: { down: 1.0, up: 1.0 },
  flexibility: { down: 0.8, up: 0.8 },
};

const NEUTRAL_CURVE: GoalResponseCurve = { down: 1.0, up: 1.0 };

function applyGoalCurve(value: number, goal: FitnessGoal | null): number {
  const curve = goal ? GOAL_RESPONSE[goal] : NEUTRAL_CURVE;
  const scaled = value < 0 ? value * curve.down : value * curve.up;
  return Math.max(-1, Math.min(1, scaled));
}

const FUSION_WEIGHTS = { recovery: 0.5, load: 0.3, adherence: 0.2 } as const;

export interface AdaptationInputs {
  recoverySignal: number | null;
  recoveryConfident: boolean;
  trainingLoadSignal: number;
  /** False only for a brand-new user with zero workout history. */
  hasTrainingHistory: boolean;
  adherenceSignal: number;
  goal: FitnessGoal | null;
}

export interface AdaptationSignal {
  /** -1 (strongly deload) .. 0 (neutral) .. +1 (cleared to push) */
  value: number;
  confidence: 'low' | 'medium' | 'high';
  /** Which input most drove the value — for grounded, non-generic copy. */
  dominant: 'recovery' | 'load' | 'adherence' | 'neutral';
}

/** Fuses recovery + training load + adherence into one signal, then applies
 *  the goal-weighted response curve. See spec §5.5 for the full rationale. */
export function computeAdaptationSignal(inputs: AdaptationInputs): AdaptationSignal {
  type ComponentKey = 'recovery' | 'load' | 'adherence';
  const components: { key: ComponentKey; value: number; weight: number }[] = [];

  if (inputs.recoverySignal != null && inputs.recoveryConfident) {
    components.push({ key: 'recovery', value: inputs.recoverySignal, weight: FUSION_WEIGHTS.recovery });
  }
  components.push({ key: 'load', value: inputs.trainingLoadSignal, weight: FUSION_WEIGHTS.load });
  components.push({ key: 'adherence', value: inputs.adherenceSignal, weight: FUSION_WEIGHTS.adherence });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const fused = components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight;
  const value = applyGoalCurve(fused, inputs.goal);

  const dominant = components.reduce<{ key: AdaptationSignal['dominant']; contribution: number }>(
    (best, c) => {
      const contribution = Math.abs(c.value * c.weight);
      return contribution > best.contribution ? { key: c.key, contribution } : best;
    },
    { key: 'neutral', contribution: 0 },
  ).key;

  const confidence: AdaptationSignal['confidence'] =
    inputs.recoverySignal != null && inputs.recoveryConfident
      ? 'high'
      : inputs.hasTrainingHistory
        ? 'medium'
        : 'low';

  return { value, confidence, dominant };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/readiness/adaptiveEngine.test.ts`
Expected: PASS (34 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/readiness/adaptiveEngine.ts src/lib/readiness/adaptiveEngine.test.ts
git commit -m "feat(readiness): add goal-weighted adaptation signal fusion"
```

---

### Task 7: `suggestNextValues` — optional adaptation parameter

**Files:**
- Modify: `src/lib/progression/suggestNextValues.ts`
- Modify: `src/lib/progression/suggestNextValues.test.ts`

**Interfaces:**
- Consumes: `AdaptationSignal` from `src/lib/readiness/adaptiveEngine.ts` (Task 6)
- Produces: `applyAdaptationToNudge(nudgeKg: number, adaptation?: AdaptationSignal): number`; `suggestNextValues` gains a 3rd optional parameter

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/progression/suggestNextValues.test.ts` (add `applyAdaptationToNudge` to the import):

```ts
import type { AdaptationSignal } from '../readiness/adaptiveEngine';

function adaptation(value: number, overrides: Partial<AdaptationSignal> = {}): AdaptationSignal {
  return { value, confidence: 'high', dominant: 'recovery', ...overrides };
}

describe('applyAdaptationToNudge — never invents a push, only dampens', () => {
  it('undefined adaptation → nudge unchanged', () => {
    expect(applyAdaptationToNudge(2.5, undefined)).toBe(2.5);
    expect(applyAdaptationToNudge(-2.5, undefined)).toBe(-2.5);
    expect(applyAdaptationToNudge(0, undefined)).toBe(0);
  });

  it('strong deload signal suppresses a positive (increase) nudge', () => {
    expect(applyAdaptationToNudge(2.5, adaptation(-0.8))).toBe(0);
  });

  it('strong deload signal leaves a negative (decrease) nudge untouched', () => {
    expect(applyAdaptationToNudge(-2.5, adaptation(-0.8))).toBe(-2.5);
  });

  it('strong positive signal never manufactures an increase from a hold (0)', () => {
    expect(applyAdaptationToNudge(0, adaptation(0.9))).toBe(0);
  });

  it('mild negative signal (above the -0.5 threshold) does not suppress the increase', () => {
    expect(applyAdaptationToNudge(2.5, adaptation(-0.3))).toBe(2.5);
  });

  it('exactly -0.5 suppresses (boundary is inclusive)', () => {
    expect(applyAdaptationToNudge(2.5, adaptation(-0.5))).toBe(0);
  });
});

describe('suggestNextValues — regression: identical output when adaptation is omitted', () => {
  it('easy last set (RPE 6) → +2.5 exactly as before, with no 3rd argument', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 60, reps: 8 }, rpe: 6 }] }]),
    );
    expect(s.values['weight']).toBe(62.5);
    expect(s.basis['weight']).toBe('nudge-up');
  });
});

describe('suggestNextValues — with adaptation signal', () => {
  it('deload signal suppresses an RPE-driven increase', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 60, reps: 8 }, rpe: 6 }] }]),
      adaptation(-0.8),
    );
    expect(s.values['weight']).toBe(60); // increase suppressed, held at last weight
    expect(s.basis['weight']).toBe('carry-forward');
  });

  it('deload signal does not touch an RPE-driven decrease', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 100, reps: 3 }, rpe: 10 }] }]),
      adaptation(-0.8),
    );
    expect(s.values['weight']).toBe(97.5);
    expect(s.basis['weight']).toBe('nudge-down');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/progression/suggestNextValues.test.ts`
Expected: FAIL — `applyAdaptationToNudge` unexported, 3rd argument not accepted.

- [ ] **Step 3: Implement**

In `src/lib/progression/suggestNextValues.ts`, add the import and the new function, then thread it through:

```ts
import type { AdaptationSignal } from '../readiness/adaptiveEngine';
```

```ts
/**
 * Adaptation can only dampen or block an RPE-driven increase when recovery
 * is poor — it never invents an increase the RPE data didn't already
 * support. See docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md §6.2.
 */
export function applyAdaptationToNudge(nudgeKg: number, adaptation?: AdaptationSignal): number {
  if (!adaptation) return nudgeKg;
  if (nudgeKg > 0 && adaptation.value <= -0.5) return 0;
  return nudgeKg;
}
```

Change the signature and the one call site inside the function body:

```ts
export function suggestNextValues(
  fields: FieldDefinition[],
  history: ExerciseHistory,
  adaptation?: AdaptationSignal,
): SuggestedValues {
```

```ts
    if (field.id === 'weight' && nudgesWeight) {
      const nudge = applyAdaptationToNudge(rpeNudgeKg(ref.rpe), adaptation);
      const next = Math.max(0, last + nudge);
      values[field.id] = next;
      basis[field.id] = nudge > 0 ? 'nudge-up' : nudge < 0 ? 'nudge-down' : 'carry-forward';
    } else {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/progression/suggestNextValues.test.ts`
Expected: PASS (all prior tests + new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progression/suggestNextValues.ts src/lib/progression/suggestNextValues.test.ts
git commit -m "feat(progression): thread optional adaptation signal into suggestNextValues"
```

---

### Task 8: `inSessionWeightNudge` — optional adaptation parameter

**Files:**
- Modify: `src/lib/progression/inSessionNudge.ts`
- Modify: `src/lib/progression/inSessionNudge.test.ts`

**Interfaces:**
- Consumes: `applyAdaptationToNudge` (Task 7), `AdaptationSignal` (Task 6)
- Produces: `inSessionWeightNudge` gains a 3rd optional parameter

- [ ] **Step 1: Read the existing test file to match its exact fixture style**

Run: `cat src/lib/progression/inSessionNudge.test.ts`

(No code shown here — read the file directly; it uses the same `field()` fixture as `suggestNextValues.test.ts`. Match its existing `describe`/`it` structure when adding the block below.)

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/progression/inSessionNudge.test.ts`:

```ts
import type { AdaptationSignal } from '../readiness/adaptiveEngine';

function adaptation(value: number): AdaptationSignal {
  return { value, confidence: 'high', dominant: 'recovery' };
}

describe('inSessionWeightNudge — regression: identical output when adaptation is omitted', () => {
  it('easy prior set (RPE 6) → +2.5, no 3rd argument', () => {
    const n = inSessionWeightNudge([field('weight')], { weight: 60, rpe: 6 });
    expect(n?.deltaKg).toBe(2.5);
  });
});

describe('inSessionWeightNudge — with adaptation signal', () => {
  it('deload signal suppresses an easy-set increase, returning null (no actionable nudge)', () => {
    const n = inSessionWeightNudge([field('weight')], { weight: 60, rpe: 6 }, adaptation(-0.8));
    expect(n).toBeNull();
  });

  it('deload signal does not touch a hard-set decrease', () => {
    const n = inSessionWeightNudge([field('weight')], { weight: 100, rpe: 10 }, adaptation(-0.8));
    expect(n?.deltaKg).toBe(-2.5);
    expect(n?.reason).toBe('hard');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/progression/inSessionNudge.test.ts`
Expected: FAIL — 3rd argument not accepted.

- [ ] **Step 4: Implement**

In `src/lib/progression/inSessionNudge.ts`:

```ts
import { rpeNudgeKg, applyAdaptationToNudge } from './suggestNextValues';
import { classifyModality } from './modality';
import type { AdaptationSignal } from '../readiness/adaptiveEngine';
```

```ts
export function inSessionWeightNudge(
  fields: FieldDefinition[],
  priorSet: { weight: number | null; rpe: number | null | undefined },
  adaptation?: AdaptationSignal,
): InSessionNudge | null {
  const modality = classifyModality(fields);
  if (modality !== 'strength' && modality !== 'hybrid') return null;
  if (typeof priorSet.weight !== 'number') return null;
  const delta = applyAdaptationToNudge(rpeNudgeKg(priorSet.rpe ?? undefined), adaptation);
  if (delta === 0) return null;
  return {
    deltaKg: delta,
    nextWeight: Math.max(0, priorSet.weight + delta),
    reason: delta > 0 ? 'easy' : 'hard',
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/progression/inSessionNudge.test.ts`
Expected: PASS (all prior tests + new ones)

- [ ] **Step 6: Commit**

```bash
git add src/lib/progression/inSessionNudge.ts src/lib/progression/inSessionNudge.test.ts
git commit -m "feat(progression): thread optional adaptation signal into inSessionWeightNudge"
```

---

### Task 9: `applyProgression` — thread adaptation through block generation

**Files:**
- Modify: `src/lib/progression/applyProgression.ts`
- Modify: `src/lib/progression/applyProgression.test.ts`

**Interfaces:**
- Consumes: `AdaptationSignal` (Task 6), the updated `suggestNextValues` (Task 7)
- Produces: `applyProgression` gains a 3rd optional parameter

- [ ] **Step 1: Write the failing test**

Append to `src/lib/progression/applyProgression.test.ts` (add `AdaptationSignal` import):

```ts
import type { AdaptationSignal } from '../readiness/adaptiveEngine';

describe('applyProgression — with adaptation signal', () => {
  it('deload signal suppresses an increase when pre-filling a new block', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla con barra' });
    const block = blockWith([squat]);
    const history = [
      entry([exSummary('Sentadilla con barra', [pset({ weight: 60, reps: 8 }, { rpe: 6 })])]),
    ];
    const adaptation: AdaptationSignal = { value: -0.8, confidence: 'high', dominant: 'recovery' };

    const enriched = applyProgression(block, history, adaptation);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    for (const s of ex!.sets) {
      expect(s.values['weight']).toBe(60); // increase suppressed
    }
  });

  it('omitting adaptation reproduces the exact pre-change output (regression)', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla con barra' });
    const block = blockWith([squat]);
    const history = [
      entry([exSummary('Sentadilla con barra', [pset({ weight: 60, reps: 8 }, { rpe: 6 })])]),
    ];
    const enriched = applyProgression(block, history);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(ex!.sets[0].values['weight']).toBe(62.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/progression/applyProgression.test.ts`
Expected: FAIL — 3rd argument not accepted.

- [ ] **Step 3: Implement**

In `src/lib/progression/applyProgression.ts`:

```ts
import type { AdaptationSignal } from '../readiness/adaptiveEngine';
```

```ts
function enrichExercise(
  exercise: ExerciseCard,
  history: WorkoutHistoryEntry[],
  adaptation?: AdaptationSignal,
): ExerciseCard {
  const hist = readExerciseHistory(history, {
    name: exercise.name,
    libraryId: exercise.libraryId,
  });
  const suggestion = suggestNextValues(exercise.fields, hist, adaptation);
  const suggested = suggestion.values;
  if (Object.keys(suggested).length === 0) return exercise;
  // ... rest unchanged
}

export function applyProgression(
  block: WorkoutBlock,
  history: WorkoutHistoryEntry[],
  adaptation?: AdaptationSignal,
): WorkoutBlock {
  if (history.length === 0) return block;

  let changed = false;
  const content: ContentNode[] = block.content.map((node) => {
    if (node.type !== 'exercise') return node;
    const enriched = enrichExercise(node.data.exercise, history, adaptation);
    if (enriched === node.data.exercise) return node;
    changed = true;
    return { ...node, data: { ...node.data, exercise: enriched } };
  });

  if (!changed) return block;
  return { ...block, content, updated_at: new Date().toISOString() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/progression/applyProgression.test.ts`
Expected: PASS (all prior tests + new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progression/applyProgression.ts src/lib/progression/applyProgression.test.ts
git commit -m "feat(progression): thread optional adaptation signal into applyProgression"
```

---

### Task 10: `readiness.ts` — consult the fused signal

**Files:**
- Modify: `src/lib/readiness/readiness.ts`
- Modify: `src/lib/readiness/readiness.test.ts`

**Interfaces:**
- Consumes: `computeBiometricBaseline`, `scoreRecoverySignal`, `deriveTrainingLoadSignal`, `scoreAdherence`, `computeAdaptationSignal`, `AdaptationSignal` (Tasks 3-6), `BiometricSample` (Task 1), `FitnessGoal` (existing)
- Produces: `ReadinessBiometricContext`; `ReadinessSnapshot.adaptation: AdaptationSignal | null`; `computeReadiness` gains a 3rd optional parameter

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/readiness/readiness.test.ts`:

```ts
import type { ReadinessBiometricContext } from './readiness';
import type { BiometricSample } from '../health/types';

function biometricSamples(n: number, hrv: number, sleep: number, endMs: number): BiometricSample[] {
  const out: BiometricSample[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ date: new Date(endMs - i * DAY).toISOString().slice(0, 10), hrvMs: hrv, sleepHours: sleep });
  }
  return out;
}

describe('Readiness — biometric context (optional 3rd argument)', () => {
  it('omitting biometrics leaves adaptation null and all scores unchanged', () => {
    const r = computeReadiness([entry(1)], NOW);
    expect(r.adaptation).toBeNull();
  });

  it('with a confident baseline and a bad-recovery today, adaptation is negative and dominant=recovery', () => {
    const goodBaseline = biometricSamples(10, 50, 7, NOW - DAY);
    const ctx: ReadinessBiometricContext = {
      samples: goodBaseline,
      today: { hrvMs: 25, sleepHours: 4 }, // well below baseline
      goal: 'strength',
      weeklyFrequency: 4,
    };
    const r = computeReadiness([entry(1)], NOW, ctx);
    expect(r.adaptation).not.toBeNull();
    expect(r.adaptation!.value).toBeLessThan(0);
  });

  it('headline reflects a strong negative recovery signal when it is dominant', () => {
    const goodBaseline = biometricSamples(10, 50, 7, NOW - DAY);
    const ctx: ReadinessBiometricContext = {
      samples: goodBaseline,
      today: { hrvMs: 15, sleepHours: 3 },
      goal: 'wellness',
      weeklyFrequency: 3,
    };
    const r = computeReadiness([entry(1)], NOW, ctx);
    if (r.adaptation!.dominant === 'recovery' && r.adaptation!.value <= -0.5) {
      expect(r.headline.toLowerCase()).toMatch(/recuperaci/);
    }
  });

  it('with fewer than 7 days of samples, adaptation falls back to load+adherence only (medium confidence)', () => {
    const thinBaseline = biometricSamples(3, 50, 7, NOW - DAY);
    const ctx: ReadinessBiometricContext = {
      samples: thinBaseline,
      today: { hrvMs: 50, sleepHours: 7 },
      goal: null,
      weeklyFrequency: null,
    };
    const r = computeReadiness([entry(1)], NOW, ctx);
    expect(r.adaptation!.confidence).not.toBe('high');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/readiness/readiness.test.ts`
Expected: FAIL — `adaptation` field / 3rd argument don't exist.

- [ ] **Step 3: Implement**

In `src/lib/readiness/readiness.ts`, add imports:

```ts
import type { BiometricSample } from '../health/types';
import type { FitnessGoal } from '../../types/profile';
import {
  computeBiometricBaseline,
  scoreRecoverySignal,
  deriveTrainingLoadSignal,
  scoreAdherence,
  computeAdaptationSignal,
  type AdaptationSignal,
} from './adaptiveEngine';
```

Add the context interface and extend `ReadinessSnapshot`:

```ts
export interface ReadinessBiometricContext {
  /** Rolling sample history from healthStore. */
  samples: BiometricSample[];
  today: { hrvMs: number | null; sleepHours: number | null };
  goal: FitnessGoal | null;
  weeklyFrequency: number | null;
}
```

```ts
export interface ReadinessSnapshot {
  energia: number;
  fuerza: number;
  recuperacion: number;
  headline: string;
  signals: ReadinessSignals;
  /** null when no biometric context was supplied — today's exact behavior. */
  adaptation: AdaptationSignal | null;
}
```

Update `computeReadiness` and add the private helper:

```ts
export function computeReadiness(
  history: WorkoutHistoryEntry[],
  now = Date.now(),
  biometrics?: ReadinessBiometricContext,
): ReadinessSnapshot {
  const clean = history.filter((h) => Number.isFinite(h.endedAt));
  const signals = collectSignals(clean, now);

  const energia = scoreEnergia(signals);
  const fuerza = scoreFuerza(signals, clean, now);
  const recuperacion = scoreRecuperacion(signals);

  const adaptation = biometrics
    ? resolveAdaptationSignal(biometrics, signals, { energia, fuerza, recuperacion }, now)
    : null;

  return {
    energia,
    fuerza,
    recuperacion,
    headline: buildHeadline({ energia, fuerza, recuperacion }, signals, adaptation),
    signals,
    adaptation,
  };
}

function resolveAdaptationSignal(
  ctx: ReadinessBiometricContext,
  signals: ReadinessSignals,
  scores: { energia: number; fuerza: number; recuperacion: number },
  now: number,
): AdaptationSignal {
  const baseline = computeBiometricBaseline(ctx.samples, now);
  const recoverySignal = scoreRecoverySignal(ctx.today, baseline);
  const trainingLoadSignal = deriveTrainingLoadSignal(scores.energia, scores.fuerza, scores.recuperacion);
  const adherenceSignal = scoreAdherence(signals.sessionsLast7Days, ctx.weeklyFrequency);
  return computeAdaptationSignal({
    recoverySignal,
    recoveryConfident: baseline.confident,
    trainingLoadSignal,
    hasTrainingHistory: signals.daysSinceLastWorkout !== null,
    adherenceSignal,
    goal: ctx.goal,
  });
}
```

Update `buildHeadline`'s signature and add the grounded-recovery branch at the top (before the existing `min`/`max` logic):

```ts
function buildHeadline(
  scores: { energia: number; fuerza: number; recuperacion: number },
  s: ReadinessSignals,
  adaptation: AdaptationSignal | null,
): string {
  if (s.daysSinceLastWorkout === null) {
    return 'Bienvenido. Tu sistema empieza con tu primer entrenamiento.';
  }

  // Grounded biometric signal outranks the training-load-only read when it's
  // confident and strong — real recovery data beats a training-only guess.
  if (adaptation && adaptation.confidence !== 'low' && adaptation.dominant === 'recovery') {
    if (adaptation.value <= -0.5) return 'Tu recuperación real está baja hoy. Sesión más suave.';
    if (adaptation.value >= 0.5) return 'Buena recuperación real. Puedes ir fuerte hoy.';
  }

  const min = Math.min(scores.energia, scores.fuerza, scores.recuperacion);
  const max = Math.max(scores.energia, scores.fuerza, scores.recuperacion);
  // ... rest of the function is UNCHANGED
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/readiness/readiness.test.ts`
Expected: PASS (all prior tests + new ones)

- [ ] **Step 5: Commit**

```bash
git add src/lib/readiness/readiness.ts src/lib/readiness/readiness.test.ts
git commit -m "feat(readiness): consult the fused adaptation signal in computeReadiness"
```

---

### Task 11: Kai signal — `recovery-adjust` rule

**Files:**
- Modify: `src/features/planner/lib/kaiSignal.ts`
- Create: `src/features/planner/lib/kaiSignal.test.ts` (confirmed not to exist yet — this is a new file, not a modification)

**Interfaces:**
- Consumes: `AdaptationSignal`-shaped data (Task 6) — only the 3 fields Kai needs, to avoid a cross-feature import of the full type
- Produces: `KaiInputs.adaptation` (new optional field), one new rule returning `id: 'recovery-adjust'`

- [ ] **Step 1: Write the failing tests**

Create `src/features/planner/lib/kaiSignal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { kaiSignal, type KaiInputs } from './kaiSignal';

const BASE: KaiInputs = {
  selectedDate: '2026-07-24',
  isToday: true,
  isPast: false,
  resolved: null,
  streak: 0,
  blocksCount: 1,
  hasActiveWorkout: false,
  lastSession: null,
};

describe('kaiSignal — recovery-adjust rule', () => {
  it('fires when adaptation is confident and strongly negative', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: -0.7, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('recovery-adjust');
    expect(signal?.tone).toBe('focus');
  });

  it('fires with a progress tone when adaptation is strongly positive', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: 0.8, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('recovery-adjust');
    expect(signal?.tone).toBe('progress');
  });

  it('does not fire below the 0.5 magnitude threshold', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: 0.3, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).not.toBe('recovery-adjust');
  });

  it('does not fire when confidence is low, even if the value is strong', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: -0.9, confidence: 'low', dominant: 'recovery' },
    });
    expect(signal?.id).not.toBe('recovery-adjust');
  });

  it('does not shadow the higher-priority "resume" rule', () => {
    const signal = kaiSignal({
      ...BASE,
      hasActiveWorkout: true,
      adaptation: { value: -0.9, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('resume');
  });

  it('does not shadow the higher-priority "done" rule', () => {
    const signal = kaiSignal({
      ...BASE,
      resolved: { status: 'completed' } as KaiInputs['resolved'],
      adaptation: { value: -0.9, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('done');
  });

  it('omitting adaptation entirely falls through to the existing rules unchanged', () => {
    const signal = kaiSignal(BASE);
    expect(signal?.id).toBe('no-plan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/planner/lib/kaiSignal.test.ts`
Expected: FAIL — `adaptation` field / rule don't exist yet.

- [ ] **Step 3: Implement**

In `src/features/planner/lib/kaiSignal.ts`, add the input field:

```ts
export interface KaiInputs {
  selectedDate: string;
  isToday: boolean;
  isPast: boolean;
  resolved: ResolvedAssignment | null;
  streak: number;
  blocksCount: number;
  hasActiveWorkout: boolean;
  lastSession: { setCount: number; targetSetCount: number } | null;
  /** From the readiness engine's fused signal. Optional — undefined/null
   *  when no biometric context is available, in which case this rule
   *  never fires and every existing rule is unaffected. */
  adaptation?: { value: number; confidence: 'low' | 'medium' | 'high'; dominant: 'recovery' | 'load' | 'adherence' | 'neutral' } | null;
}
```

Insert the new rule right after the `done` check and before the `streak` check:

```ts
  if (i.isToday && i.resolved?.status === 'completed') {
    return {
      id: 'done',
      tone: 'celebrate',
      message: 'Sesión completada.',
    };
  }

  if (
    i.isToday &&
    i.adaptation &&
    i.adaptation.confidence !== 'low' &&
    Math.abs(i.adaptation.value) > 0.5
  ) {
    const isLow = i.adaptation.value < 0;
    return {
      id: 'recovery-adjust',
      tone: isLow ? 'focus' : 'progress',
      message: recoveryAdjustMessage(i.adaptation.dominant, isLow ? 'low' : 'high'),
    };
  }

  if (i.isToday && !i.resolved && i.streak >= 3) {
```

Add the message helper near the bottom of the file, alongside `kaiSignal`:

```ts
function recoveryAdjustMessage(
  dominant: 'recovery' | 'load' | 'adherence' | 'neutral',
  direction: 'low' | 'high',
): string {
  if (direction === 'low') {
    if (dominant === 'recovery') return 'Tu recuperación real está baja. Hoy toca ir más suave.';
    if (dominant === 'adherence') return 'Llevas unos días irregulares. Retoma con calma.';
    return 'Carga acumulada alta. Considera bajar intensidad hoy.';
  }
  if (dominant === 'recovery') return 'Buena recuperación real. Hoy puedes exigirte.';
  return 'Buen momento para empujar un poco más.';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/planner/lib/kaiSignal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/lib/kaiSignal.ts src/features/planner/lib/kaiSignal.test.ts
git commit -m "feat(kai): add recovery-adjust signal grounded in real biometric data"
```

---

### Task 12: Daily biometric sample sync

**Files:**
- Create: `src/lib/health/dailySync.ts`
- Create: `src/lib/health/dailySync.test.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `readHRV`, `readSleepHours`, `isHealthKitAvailable` (Task 1), `useHealthStore` (Task 2)
- Produces: `syncDailyBiometricSample(): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/health/dailySync.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { syncDailyBiometricSample } from './dailySync';
import { useHealthStore } from '../../store/healthStore';

beforeEach(() => {
  useHealthStore.setState({ samples: [], _hasHydrated: false });
});

describe('syncDailyBiometricSample', () => {
  it('does nothing when HealthKit is unavailable (native module absent in test env)', async () => {
    await syncDailyBiometricSample();
    expect(useHealthStore.getState().samples).toHaveLength(0);
  });

  it('never throws', async () => {
    await expect(syncDailyBiometricSample()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/health/dailySync.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/health/dailySync.ts`:

```ts
// KAIROS — Daily biometric sample sync.
//
// Called once per app launch (App.tsx). No AppState foreground-listener
// infra exists in this codebase yet, and adding one is out of scope for
// Phase 1 (YAGNI) — once-per-launch is good enough to keep the rolling
// baseline current for a daily-use fitness app.

import { readHRV, readSleepHours, isHealthKitAvailable } from './healthkit';
import { useHealthStore } from '../../store/healthStore';

function todayISODate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function syncDailyBiometricSample(): Promise<void> {
  if (!isHealthKitAvailable()) return;
  const [hrvMs, sleepHours] = await Promise.all([readHRV(), readSleepHours()]);
  if (hrvMs == null && sleepHours == null) return;
  useHealthStore.getState().recordSample({ date: todayISODate(), hrvMs, sleepHours });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/health/dailySync.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into App.tsx**

In `App.tsx`, add the import:

```ts
import { syncDailyBiometricSample } from './src/lib/health/dailySync';
```

Add the call inside the existing launch effect:

```tsx
  useEffect(() => {
    // Restore existing Supabase session from AsyncStorage and load profile
    initialize();
    // DEV demo data (no-op in release / when SEED_SYNTHETIC is off)
    seedSyntheticData();
    // Rolling HRV/sleep sample for the adaptive readiness engine — no-op
    // until HealthKit is natively activated and the user has granted read
    // permission.
    syncDailyBiometricSample();
    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const unsubscribe = startAuthListener();
    return unsubscribe;
  }, [initialize]);
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/health/dailySync.ts src/lib/health/dailySync.test.ts App.tsx
git commit -m "feat(health): wire daily biometric sample sync into app launch"
```

---

### Task 13: `useReadinessSnapshot` — shared hook wiring live store state into the engine

**Files:**
- Create: `src/lib/readiness/useReadinessSnapshot.ts`

**Interfaces:**
- Consumes: `useWorkoutStore` (existing), `useHealthStore` (Task 2), `useUserProfile` (existing, `src/context/UserProfileContext.tsx`), `computeReadiness`/`ReadinessSnapshot` (Task 10)
- Produces: `useReadinessSnapshot(): ReadinessSnapshot` — single assembly point for "today's readiness + adaptation", consumed by Tasks 14-16

**Note on testing:** this file is a thin React-hook wiring layer with no independent logic of its own — it assembles already-tested pure functions (Tasks 3, 6, 10) from already-tested stores. It has no dedicated test file, matching the existing convention in `src/features/planner/hooks/` (`useDayCardState.ts`, `useMomentumPhrase.ts`, `useScheduleForRange.ts`, `useScheduleForDate.ts` — none of which have `.test.ts` files, since RN component/hook testing in this codebase happens via on-device verification, not RTL). Verify this task with `tsc --noEmit`; verify its actual behavior on-device in Tasks 14-16, where it's first consumed.

- [ ] **Step 1: Implement the hook**

Create `src/lib/readiness/useReadinessSnapshot.ts`:

```ts
// src/lib/readiness/useReadinessSnapshot.ts
//
// Single source of truth for "today's readiness + adaptation signal",
// assembled from live store state. Every consumer (ReadinessLine's headline,
// TodayPlanner's Kai signal, ActiveWorkoutScreen's progression suggestions)
// uses this hook instead of independently rebuilding a
// ReadinessBiometricContext — one assembly point, one behavior, no drift
// between surfaces.

import { useMemo } from 'react';
import { useWorkoutStore } from '../../store/workoutStore';
import { useHealthStore } from '../../store/healthStore';
import { useUserProfile } from '../../context/UserProfileContext';
import { computeReadiness, type ReadinessSnapshot } from './readiness';

function todayISODate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function useReadinessSnapshot(): ReadinessSnapshot {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const samples = useHealthStore((s) => s.samples);
  const { profile } = useUserProfile();

  return useMemo(() => {
    const today = todayISODate();
    const todaySample = samples.find((s) => s.date === today);
    return computeReadiness(history, Date.now(), {
      samples,
      today: { hrvMs: todaySample?.hrvMs ?? null, sleepHours: todaySample?.sleepHours ?? null },
      goal: profile.primaryGoal,
      weeklyFrequency: profile.weeklyFrequency,
    });
  }, [history, samples, profile.primaryGoal, profile.weeklyFrequency]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/readiness/useReadinessSnapshot.ts
git commit -m "feat(readiness): add useReadinessSnapshot shared hook"
```

---

### Task 14: Wire `ReadinessLine.tsx` to the shared hook

**Files:**
- Modify: `src/features/planner/components/ReadinessLine.tsx`

**Interfaces:**
- Consumes: `useReadinessSnapshot` (Task 13)

- [ ] **Step 1: Replace the direct `computeReadiness` call**

In `src/features/planner/components/ReadinessLine.tsx`, replace:

```tsx
import { Colors, Type, Spacing } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { computeReadiness } from '../../../lib/readiness/readiness';

function ReadinessLineImpl() {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const snapshot = useMemo(() => computeReadiness(history), [history]);
```

with:

```tsx
import { Colors, Type, Spacing } from '../../../theme/tokens';
import { useReadinessSnapshot } from '../../../lib/readiness/useReadinessSnapshot';

function ReadinessLineImpl() {
  const snapshot = useReadinessSnapshot();
```

(`useMemo` from `'react'` is still used lower in the file for `figures` — only remove the now-unused `useWorkoutStore`/`computeReadiness` imports.)

- [ ] **Step 2: Manual verification (no automated test for this component)**

Run: `npx tsc --noEmit` — expect no errors (confirms `snapshot` is typed correctly with no unused-import issues).

Then, in the running simulator, open the Home tab: "Tu estado hoy" must render exactly as before — adaptation is null with no HealthKit data yet, so `buildHeadline`'s new branch never fires. This is a refactor, not a behavior change, until biometrics exist.

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/components/ReadinessLine.tsx
git commit -m "refactor(readiness): wire ReadinessLine through the shared snapshot hook"
```

---

### Task 15: Wire the Kai signal card to the fused adaptation signal

**Files:**
- Modify: `src/features/planner/TodayPlanner.tsx`

**Interfaces:**
- Consumes: `useReadinessSnapshot` (Task 13), `KaiInputs.adaptation` (Task 11)

- [ ] **Step 1: Add the hook and thread its output into `kaiSignal()`**

In `src/features/planner/TodayPlanner.tsx`, add the import:

```ts
import { useReadinessSnapshot } from '../../lib/readiness/useReadinessSnapshot';
```

Add the hook call near the other store hooks (right after `const { streak } = useGamification();`):

```ts
  const { streak } = useGamification();
  const readinessSnapshot = useReadinessSnapshot();
```

Update the `kaiSignal` call:

```tsx
  const signal: KaiSignal | null = useMemo(
    () =>
      kaiSignal({
        selectedDate,
        isToday: dayState.isToday,
        isPast: dayState.isPast,
        resolved: dayState.resolved,
        streak: streak.current,
        blocksCount: blocks.length,
        hasActiveWorkout: !!activeWorkout,
        lastSession,
        adaptation: readinessSnapshot.adaptation,
      }),
    [
      selectedDate,
      dayState,
      streak,
      blocks.length,
      activeWorkout,
      lastSession,
      readinessSnapshot.adaptation,
    ],
  );
```

- [ ] **Step 2: Manual verification**

Run: `npx tsc --noEmit` — expect no errors.

In the running simulator: the Kai card must render exactly as before (adaptation is null pre-HealthKit, so the new rule never fires and every existing rule's priority order is untouched — confirmed by Task 11's "does not shadow" tests).

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/TodayPlanner.tsx
git commit -m "feat(kai): wire the fused adaptation signal into the Kai signal card"
```

---

### Task 16: Wire in-session progression suggestions to the fused adaptation signal

**Files:**
- Modify: `src/screens/ActiveWorkoutScreen.tsx`

**Interfaces:**
- Consumes: `useReadinessSnapshot` (Task 13), the updated `suggestNextValues`/`inSessionWeightNudge` (Tasks 7-8)

- [ ] **Step 1: Add the hook and pass `adaptation` to both call sites**

In `src/screens/ActiveWorkoutScreen.tsx`, add the import:

```ts
import { useReadinessSnapshot } from '../lib/readiness/useReadinessSnapshot';
```

Add the hook call near the other store hooks at the top of the component body (alongside the existing `useWorkoutStore`/`useScheduleStore` calls):

```ts
  const readinessSnapshot = useReadinessSnapshot();
```

Update the in-session nudge call:

```tsx
  const inSessionNudge = useMemo(
    () =>
      exercise && priorCompletedSet
        ? inSessionWeightNudge(
            exercise.fields,
            priorCompletedSet,
            readinessSnapshot.adaptation ?? undefined,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exercise keyed by identity; fields don't change mid-session
    [exercise?.id, priorCompletedSet, readinessSnapshot.adaptation],
  );
```

Update the between-sessions suggestion call:

```tsx
  const suggestion = useMemo(() => {
    if (!exercise) return null;
    const hist = readExerciseHistory(workoutHistory, {
      name: exercise.name,
      libraryId: exercise.libraryId,
    });
    return suggestNextValues(exercise.fields, hist, readinessSnapshot.adaptation ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, workoutHistory.length, completedInSession, readinessSnapshot.adaptation]);
```

(The hook returns `AdaptationSignal | null`; both progression functions declare the parameter as `AdaptationSignal | undefined` to match the codebase's optional-parameter convention, so `?? undefined` bridges the two — both `null` and `undefined` hit the same `if (!adaptation) return ...` guard.)

- [ ] **Step 2: Manual verification**

Run: `npx tsc --noEmit` — expect no errors.

In the running simulator: start a session, complete 2-3 sets — the giant target and "Sugerido" caption must behave exactly as before (adaptation is null pre-HealthKit, so `applyAdaptationToNudge` is a no-op per Task 7's regression tests). This is the highest-stakes wiring in the plan — it touches the just-shipped Modo Sesión scoreboard — so confirm the golden path (HECHO, target, suggestion caption, rest timer) before moving on, per CLAUDE.md's on-device testing discipline.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ActiveWorkoutScreen.tsx
git commit -m "feat(progression): wire in-session suggestions to the fused adaptation signal"
```

---

### Task 17: Update the progression engine's pinned-rules comment + full regression sweep

**Files:**
- Modify: `src/lib/progression/suggestNextValues.ts` (comment only)

**Interfaces:** None — documentation + verification only.

- [ ] **Step 1: Update the header comment**

In `src/lib/progression/suggestNextValues.ts`, change:

```ts
// KAIROS — Progression engine: suggest the next session's values.
//
// Pinned v1 rules (DO NOT exceed — no ML, no recommendation engine):
//   - strength (weight field): carry forward the last weight + an RPE nudge of
//     ±2.5 kg. Easy last time → up; maxed out → down; in range or unrated → hold.
//   - endurance (pace/distance/calories) & everything else: carry forward the
//     last value, no nudge.
```

to:

```ts
// KAIROS — Progression engine: suggest the next session's values.
//
// Pinned v1 rules (DO NOT exceed — no ML, no recommendation engine):
//   - strength (weight field): carry forward the last weight + an RPE nudge of
//     ±2.5 kg. Easy last time → up; maxed out → down; in range or unrated → hold.
//   - endurance (pace/distance/calories) & everything else: carry forward the
//     last value, no nudge.
//
// Extended (Phase 1 adaptive readiness, see docs/superpowers/specs/
// 2026-07-23-adaptive-readiness-design.md): an optional AdaptationSignal can
// scale/cap the RPE nudge — it never replaces it, never invents a nudge the
// RPE data didn't produce, and is still pure deterministic arithmetic (no
// ML). The RPE nudge itself is unchanged.
```

- [ ] **Step 2: Run the complete test suite**

Run: `npx vitest run`
Expected: All tests pass, including every pre-existing suite untouched by this plan (confirms zero regressions across the whole codebase, not just the files this plan touched).

- [ ] **Step 3: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors — confirms every optional-parameter addition is call-site-compatible everywhere in the codebase, not just at the 3 call sites checked manually during design.

- [ ] **Step 4: Commit**

```bash
git add src/lib/progression/suggestNextValues.ts
git commit -m "docs(progression): document the adaptive-signal extension to the v1 pin"
```

---

## Summary

17 tasks. Tasks 1-12 build and unit-test the fully-isolated engine (`src/lib/`, `src/store/`, `src/features/planner/lib/kaiSignal.ts`, `App.tsx`) — no UI touched, no native code touched. Tasks 13-16 wire that engine into the three places it actually needs to show up (`ReadinessLine.tsx`'s headline, `TodayPlanner.tsx`'s Kai card, `ActiveWorkoutScreen.tsx`'s weight/reps suggestions) through one shared hook, so the feature is genuinely live in the app rather than dead plumbing. Task 17 documents the extended pin and runs a whole-suite regression sweep.

Every progression-engine signature change is additive and optional, verified by regression tests at each step. Until Álvaro completes the separate HealthKit native-activation step (`docs/superpowers/specs/healthkit-integration.md`), `adaptation` is always `null` and every consumer's behavior is byte-identical to today — except `scoreAdherence`/`deriveTrainingLoadSignal`, which start contributing to the readiness headline and Kai card immediately (Task 14/15), since those signals need no biometrics at all. AI-block-generation's `applyProgression` call sites are deliberately left unwired (see File Structure note) as a natural, separate follow-up.
