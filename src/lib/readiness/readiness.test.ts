import { describe, it, expect } from 'vitest';
import { computeReadiness } from './readiness';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import type { ReadinessBiometricContext } from './readiness';
import type { BiometricSample } from '../health/types';

const NOW = new Date('2026-06-02T10:00:00Z').getTime();
const DAY = 24 * 3600 * 1000;

function entry(daysAgo: number, opts?: Partial<WorkoutHistoryEntry>): WorkoutHistoryEntry {
  const t = NOW - daysAgo * DAY;
  return {
    id: `e${daysAgo}`,
    blockId: 'b1',
    blockName: 'Test',
    startedAt: t - 3600_000,
    endedAt: t,
    exerciseCount: 1,
    setCount: 3,
    totalVolume: 3000,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'ex1',
        name: 'Banca',
        maxWeight: 80,
        totalVolume: 1920,
        setsCompleted: 3,
      },
    ],
    ...opts,
  };
}

describe('Readiness — Energía', () => {
  it('fresh user (no history) returns optimistic score', () => {
    const r = computeReadiness([], NOW);
    expect(r.energia).toBe(90);
    expect(r.signals.daysSinceLastWorkout).toBeNull();
  });

  it('peaks at 1-2 days rest (sweet spot)', () => {
    const r1 = computeReadiness([entry(1)], NOW);
    const r2 = computeReadiness([entry(2)], NOW);
    expect(r1.energia).toBeGreaterThanOrEqual(95);
    expect(r2.energia).toBeGreaterThanOrEqual(90);
  });

  it('drops when training same day', () => {
    const r = computeReadiness([entry(0)], NOW);
    expect(r.energia).toBeLessThanOrEqual(60);
  });

  it('falls when 7+ days off', () => {
    const r = computeReadiness([entry(10)], NOW);
    expect(r.energia).toBeLessThanOrEqual(45);
  });

  it('penalizes overtraining (5+ sessions in 7 days)', () => {
    const history = [entry(0), entry(1), entry(2), entry(3), entry(4)];
    const r = computeReadiness(history, NOW);
    expect(r.signals.sessionsLast7Days).toBe(5);
    // 0 days since last + overtraining penalty
    expect(r.energia).toBeLessThanOrEqual(50);
  });
});

describe('Readiness — Recuperación', () => {
  it('100% with no recent workouts', () => {
    const r = computeReadiness([entry(5)], NOW); // outside 48h window
    expect(r.recuperacion).toBe(100);
  });

  it('drops when same muscle group worked in last 48h', () => {
    // Banca → chest
    const r = computeReadiness([entry(1)], NOW);
    expect(r.signals.recentMuscleGroups).toContain('chest');
    expect(r.recuperacion).toBeLessThan(100);
  });

  it('floors at 40 even after wall-to-wall day', () => {
    const heavyDay = entry(0, {
      exercises: [
        { exerciseId: '1', name: 'Banca', maxWeight: 80, totalVolume: 1920, setsCompleted: 3 },
        { exerciseId: '2', name: 'Remo', maxWeight: 60, totalVolume: 1440, setsCompleted: 3 },
        {
          exerciseId: '3',
          name: 'Sentadilla',
          maxWeight: 100,
          totalVolume: 2400,
          setsCompleted: 3,
        },
        {
          exerciseId: '4',
          name: 'Press militar',
          maxWeight: 50,
          totalVolume: 1200,
          setsCompleted: 3,
        },
        { exerciseId: '5', name: 'Curl', maxWeight: 20, totalVolume: 480, setsCompleted: 3 },
        { exerciseId: '6', name: 'Plancha', maxWeight: 0, totalVolume: 0, setsCompleted: 3 },
      ],
    });
    const r = computeReadiness([heavyDay], NOW);
    expect(r.recuperacion).toBeGreaterThanOrEqual(40);
  });
});

describe('Readiness — Fuerza', () => {
  it('mild optimism for fresh user', () => {
    expect(computeReadiness([], NOW).fuerza).toBe(70);
  });

  it('boosts with PRs in last 4 weeks', () => {
    // Same exercise (libraryId) at increasing weights = PR detection
    const mkPR = (daysAgo: number, weight: number): WorkoutHistoryEntry =>
      entry(daysAgo, {
        exercises: [
          {
            exerciseId: 'ex1',
            libraryId: 'bench',
            name: 'Banca',
            maxWeight: weight,
            totalVolume: weight * 24,
            setsCompleted: 3,
          },
        ],
      });
    const r = computeReadiness([mkPR(1, 90), mkPR(8, 85), mkPR(15, 80)], NOW);
    expect(r.signals.prsLast4Weeks).toBe(2);
    expect(r.fuerza).toBeGreaterThan(70);
  });

  it('penalizes flat trend across 4 weeks', () => {
    const flat = [
      entry(1, { totalVolume: 3000 }),
      entry(8, { totalVolume: 3000 }),
      entry(15, { totalVolume: 3000 }),
      entry(22, { totalVolume: 3000 }),
    ];
    const r = computeReadiness(flat, NOW);
    expect(r.signals.prsLast4Weeks).toBe(0);
    expect(r.fuerza).toBeLessThanOrEqual(50);
  });
});

describe('Readiness — hostile/corrupt input', () => {
  it('ignores entries with non-finite endedAt instead of propagating NaN', () => {
    const corrupt = entry(1, { endedAt: NaN });
    const r = computeReadiness([corrupt], NOW);
    // Sole entry is corrupt → treated as a fresh user, never NaN.
    expect(r.signals.daysSinceLastWorkout).toBeNull();
    expect(Number.isFinite(r.energia)).toBe(true);
    expect(Number.isFinite(r.fuerza)).toBe(true);
    expect(Number.isFinite(r.recuperacion)).toBe(true);
  });

  it('keeps valid entries when corrupt ones are mixed in', () => {
    const r = computeReadiness([entry(1), entry(2, { endedAt: Infinity })], NOW);
    expect(r.signals.daysSinceLastWorkout).toBe(1);
    expect(Number.isFinite(r.energia)).toBe(true);
  });

  it('treats future-dated entries as trained today, not a score boost', () => {
    const future = entry(0, { endedAt: NOW + 5 * DAY });
    const r = computeReadiness([future], NOW);
    expect(r.signals.daysSinceLastWorkout).toBe(0);
    // Same-day training scores low energy, not the 1-2 day sweet spot.
    expect(r.energia).toBeLessThanOrEqual(60);
  });

  it('non-finite maxWeight never counts as a PR', () => {
    const mk = (daysAgo: number, weight: number): WorkoutHistoryEntry =>
      entry(daysAgo, {
        exercises: [
          {
            exerciseId: 'ex1',
            libraryId: 'bench',
            name: 'Banca',
            maxWeight: weight,
            totalVolume: 1000,
            setsCompleted: 3,
          },
        ],
      });
    const r = computeReadiness([mk(1, NaN), mk(8, 80)], NOW);
    expect(r.signals.prsLast4Weeks).toBe(0);
    expect(Number.isFinite(r.fuerza)).toBe(true);
  });

  it('non-finite totalVolume does not poison the volume trend', () => {
    const history = [
      entry(1, { totalVolume: NaN }),
      entry(3, { totalVolume: 3000 }),
      entry(18, { totalVolume: 3000 }),
    ];
    const r = computeReadiness(history, NOW);
    expect(Number.isFinite(r.fuerza)).toBe(true);
  });

  it('entry with no exercises is harmless', () => {
    const r = computeReadiness([entry(1, { exercises: [] })], NOW);
    expect(r.signals.recentMuscleGroups).toEqual([]);
    expect(r.recuperacion).toBe(100);
  });

  it('all-corrupt history falls back to the fresh-user welcome', () => {
    const r = computeReadiness([entry(1, { endedAt: NaN }), entry(2, { endedAt: -Infinity })], NOW);
    expect(r.headline).toMatch(/Bienvenido/);
  });
});

describe('Readiness — headline', () => {
  it('welcomes a brand new user', () => {
    expect(computeReadiness([], NOW).headline).toMatch(/Bienvenido/);
  });

  it('flags recovery as the bottleneck', () => {
    const r = computeReadiness([entry(1)], NOW); // worked yesterday → chest in 48h
    // recovery should be dragging
    if (r.recuperacion === Math.min(r.energia, r.fuerza, r.recuperacion)) {
      expect(r.headline.toLowerCase()).toMatch(/recuperac|ligera|distinto/);
    }
  });
});

function biometricSamples(n: number, hrv: number, sleep: number, endMs: number): BiometricSample[] {
  const out: BiometricSample[] = [];
  for (let i = 0; i < n; i++) {
    // Tiny alternating jitter so the baseline has nonzero stdDev — real
    // biometric data is never perfectly flat, and adaptiveEngine's
    // zScoreNormalized intentionally returns null on a zero-variance
    // baseline (see adaptiveEngine.test.ts: "never divides by zero when
    // stdDev is 0"). A perfectly uniform fixture would silently drop the
    // recovery signal from the fusion, which defeats the point of these tests.
    const jitter = i % 2 === 0 ? 1 : -1;
    out.push({
      date: new Date(endMs - i * DAY).toISOString().slice(0, 10),
      hrvMs: hrv + jitter,
      sleepHours: sleep + jitter * 0.1,
    });
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

  it('with fewer than 7 days of samples, adaptation is gated to null (not high confidence)', () => {
    const thinBaseline = biometricSamples(3, 50, 7, NOW - DAY);
    const ctx: ReadinessBiometricContext = {
      samples: thinBaseline,
      today: { hrvMs: 50, sleepHours: 7 },
      goal: null,
      weeklyFrequency: null,
    };
    const r = computeReadiness([entry(1)], NOW, ctx);
    expect(r.adaptation).toBeNull();
  });
});
