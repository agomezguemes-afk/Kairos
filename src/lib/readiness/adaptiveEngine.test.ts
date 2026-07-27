import { describe, it, expect } from 'vitest';
import {
  computeBiometricBaseline,
  scoreRecoverySignal,
  deriveTrainingLoadSignal,
  scoreAdherence,
  computeAdaptationSignal,
} from './adaptiveEngine';
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

describe('scoreRecoverySignal', () => {
  const baseline = {
    hrvMean: 50,
    hrvStdDev: 10,
    sleepMean: 7,
    sleepStdDev: 1,
    sampleCount: 14,
    confident: true,
  };

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
    const empty = {
      hrvMean: null,
      hrvStdDev: null,
      sleepMean: null,
      sleepStdDev: null,
      sampleCount: 0,
      confident: false,
    };
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
    const zeroVariance = {
      hrvMean: 50,
      hrvStdDev: 0,
      sleepMean: 7,
      sleepStdDev: 0,
      sampleCount: 14,
      confident: true,
    };
    const score = scoreRecoverySignal({ hrvMs: 60, sleepHours: 8 }, zeroVariance);
    expect(Number.isFinite(score) || score === null).toBe(true);
  });
});

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
    for (const [sessions, freq] of [
      [0, 5],
      [1, 5],
      [5, 5],
      [10, 5],
      [2, 2],
    ] as const) {
      expect(scoreAdherence(sessions, freq)).toBeLessThanOrEqual(0);
    }
  });
});

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
    const goals = [
      'strength',
      'endurance',
      'weight_loss',
      'wellness',
      'muscle_gain',
      'flexibility',
    ] as const;
    for (const goal of goals) {
      expect(() => computeAdaptationSignal({ ...baseInputs, goal })).not.toThrow();
    }
  });
});
