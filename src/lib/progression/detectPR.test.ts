import { describe, it, expect } from 'vitest';

import { detectPR } from './detectPR';
import type { ExerciseHistory, HistoricalSession } from './types';

function hist(sessions: HistoricalSession[]): ExerciseHistory {
  return { key: 'ex', sessions };
}

describe('detectPR — higher-is-better fields', () => {
  const history = hist([
    { performedAt: 2, sets: [{ values: { weight: 100, reps: 5 } }] },
    {
      performedAt: 1,
      sets: [{ values: { weight: 95, reps: 5 } }, { values: { weight: 90, reps: 8 } }],
    },
  ]);

  it('a heavier weight is a PR with the right delta', () => {
    const pr = detectPR({ field: 'weight', value: 102.5, history });
    expect(pr).toMatchObject({
      field: 'weight',
      direction: 'higher',
      previousBest: 100,
      delta: 2.5,
    });
  });

  it('equalling the best is NOT a PR', () => {
    expect(detectPR({ field: 'weight', value: 100, history })).toBeNull();
  });

  it('below the best is not a PR', () => {
    expect(detectPR({ field: 'weight', value: 97.5, history })).toBeNull();
  });

  it('reps PR uses the max reps ever recorded (8), not the latest', () => {
    expect(detectPR({ field: 'reps', value: 9, history })).toMatchObject({
      previousBest: 8,
      delta: 1,
    });
    expect(detectPR({ field: 'reps', value: 8, history })).toBeNull();
  });
});

describe('detectPR — lower-is-better (pace)', () => {
  const history = hist([
    { performedAt: 1, sets: [{ values: { pace: 5.0 } }, { values: { pace: 4.8 } }] },
  ]);

  it('a faster pace beats the fastest prior', () => {
    const pr = detectPR({ field: 'pace', value: 4.6, history });
    expect(pr).toMatchObject({ direction: 'lower', previousBest: 4.8, delta: 0.2 });
  });

  it('a slower pace is not a PR', () => {
    expect(detectPR({ field: 'pace', value: 5.2, history })).toBeNull();
  });
});

describe('detectPR — endurance volume fields', () => {
  const history = hist([{ performedAt: 1, sets: [{ values: { distance: 5, calories: 200 } }] }]);

  it('farther distance is a PR', () => {
    expect(detectPR({ field: 'distance', value: 6, history })).toMatchObject({ delta: 1 });
  });
  it('more calories is a PR', () => {
    expect(detectPR({ field: 'calories', value: 250, history })).toMatchObject({ delta: 50 });
  });
});

describe('detectPR — guards', () => {
  const history = hist([{ performedAt: 1, sets: [{ values: { weight: 60, reps: 8 } }] }]);

  it('first-ever performance (no prior history) is not a PR', () => {
    expect(detectPR({ field: 'weight', value: 999, history: hist([]) })).toBeNull();
  });

  it('non-tracking field returns null', () => {
    expect(detectPR({ field: 'heartRate', value: 220, history })).toBeNull();
    expect(detectPR({ field: 'duration', value: 9999, history })).toBeNull();
  });

  it('invalid values (≤0, NaN) return null', () => {
    expect(detectPR({ field: 'weight', value: 0, history })).toBeNull();
    expect(detectPR({ field: 'weight', value: -10, history })).toBeNull();
    expect(detectPR({ field: 'weight', value: Number.NaN, history })).toBeNull();
  });

  it('ignores non-positive historical values when computing the best', () => {
    const h = hist([
      { performedAt: 1, sets: [{ values: { weight: 0 } }, { values: { weight: 50 } }] },
    ]);
    expect(detectPR({ field: 'weight', value: 55, history: h })).toMatchObject({
      previousBest: 50,
    });
  });
});
