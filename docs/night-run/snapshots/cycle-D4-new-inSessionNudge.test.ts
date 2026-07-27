import { describe, it, expect } from 'vitest';

import { inSessionWeightNudge } from './inSessionNudge';
import { field } from './_fixtures';

const strengthFields = [field('weight'), field('reps')];
const enduranceFields = [field('distance'), field('pace')];

describe('inSessionWeightNudge — intra-session ±2.5 kg advisor', () => {
  it('strength, weight 60, RPE 6 (easy) → +2.5 up to 62.5', () => {
    expect(inSessionWeightNudge(strengthFields, { weight: 60, rpe: 6 })).toEqual({
      deltaKg: 2.5,
      nextWeight: 62.5,
      reason: 'easy',
    });
  });

  it('RPE 7 (easy boundary) → still nudges up', () => {
    const n = inSessionWeightNudge(strengthFields, { weight: 60, rpe: 7 });
    expect(n?.reason).toBe('easy');
    expect(n?.deltaKg).toBe(2.5);
    expect(n?.nextWeight).toBe(62.5);
  });

  it('RPE 10 (maxed) → −2.5 down to 57.5', () => {
    expect(inSessionWeightNudge(strengthFields, { weight: 60, rpe: 10 })).toEqual({
      deltaKg: -2.5,
      nextWeight: 57.5,
      reason: 'hard',
    });
  });

  it('RPE 8 (working range) → null (hold)', () => {
    expect(inSessionWeightNudge(strengthFields, { weight: 60, rpe: 8 })).toBeNull();
  });

  it('RPE null/undefined (unrated) → null', () => {
    expect(inSessionWeightNudge(strengthFields, { weight: 60, rpe: null })).toBeNull();
    expect(inSessionWeightNudge(strengthFields, { weight: 60, rpe: undefined })).toBeNull();
  });

  it('no prior weight → null', () => {
    expect(inSessionWeightNudge(strengthFields, { weight: null, rpe: 6 })).toBeNull();
  });

  it('endurance modality (no weight/reps fields) → null even with easy RPE', () => {
    expect(inSessionWeightNudge(enduranceFields, { weight: 60, rpe: 6 })).toBeNull();
  });

  it('floors at 0: weight 1, RPE 10 → nextWeight 0 (deltaKg still −2.5)', () => {
    expect(inSessionWeightNudge(strengthFields, { weight: 1, rpe: 10 })).toEqual({
      deltaKg: -2.5,
      nextWeight: 0,
      reason: 'hard',
    });
  });
});
