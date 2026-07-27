import { describe, it, expect } from 'vitest';

import { suggestNextValues, rpeNudgeKg, applyAdaptationToNudge } from './suggestNextValues';
import type { ExerciseHistory, HistoricalSession } from './types';
import { field } from './_fixtures';
import type { AdaptationSignal } from '../readiness/adaptiveEngine';

function adaptation(value: number, overrides: Partial<AdaptationSignal> = {}): AdaptationSignal {
  return { value, confidence: 'high', dominant: 'recovery', ...overrides };
}

function hist(sessions: HistoricalSession[]): ExerciseHistory {
  return { key: 'ex', sessions };
}

const STRENGTH = [field('weight'), field('reps'), field('rir')];
const ENDURANCE = [field('distance'), field('duration'), field('pace')];

describe('rpeNudgeKg — the ±2.5 kg autoregulation rule', () => {
  it('unrated → 0 (hold)', () => {
    expect(rpeNudgeKg(undefined)).toBe(0);
  });
  it('RPE ≤ 7 → +2.5 (was easy)', () => {
    expect(rpeNudgeKg(6)).toBe(2.5);
    expect(rpeNudgeKg(7)).toBe(2.5);
  });
  it('RPE in the working range (8, 9) → 0 (hold)', () => {
    expect(rpeNudgeKg(8)).toBe(0);
    expect(rpeNudgeKg(9)).toBe(0);
    expect(rpeNudgeKg(9.5)).toBe(0);
  });
  it('RPE ≥ 10 → −2.5 (maxed out)', () => {
    expect(rpeNudgeKg(10)).toBe(-2.5);
  });
});

describe('suggestNextValues — strength', () => {
  it('carry-forward weight + reps when no RPE', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 60, reps: 8 } }] }]),
    );
    expect(s.modality).toBe('strength');
    expect(s.values).toEqual({ weight: 60, reps: 8 });
    expect(s.basis['weight']).toBe('carry-forward');
    expect(s.basis['reps']).toBe('carry-forward');
  });

  it('easy last set (RPE 6) → weight +2.5, reps unchanged', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 60, reps: 8 }, rpe: 6 }] }]),
    );
    expect(s.values['weight']).toBe(62.5);
    expect(s.basis['weight']).toBe('nudge-up');
    expect(s.values['reps']).toBe(8); // reps are never nudged
    expect(s.basis['reps']).toBe('carry-forward');
  });

  it('maxed last set (RPE 10) → weight −2.5', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 100, reps: 3 }, rpe: 10 }] }]),
    );
    expect(s.values['weight']).toBe(97.5);
    expect(s.basis['weight']).toBe('nudge-down');
  });

  it('in-range RPE (8) → hold', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 80, reps: 5 }, rpe: 8 }] }]),
    );
    expect(s.values['weight']).toBe(80);
    expect(s.basis['weight']).toBe('carry-forward');
  });

  it('weight nudge never goes below 0', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 1, reps: 12 }, rpe: 10 }] }]),
    );
    expect(s.values['weight']).toBe(0);
  });

  it('reference is the LAST completed set of the MOST RECENT session', () => {
    const s = suggestNextValues(
      STRENGTH,
      hist([
        {
          performedAt: 200,
          sets: [{ values: { weight: 70, reps: 8 } }, { values: { weight: 72.5, reps: 6 } }],
        },
        { performedAt: 100, sets: [{ values: { weight: 65, reps: 8 } }] },
      ]),
    );
    expect(s.values['weight']).toBe(72.5); // top set of latest session
    expect(s.reference?.performedAt).toBe(200);
  });
});

describe('suggestNextValues — endurance (no nudge, ever)', () => {
  it('carries pace/distance forward untouched, even with an RPE present', () => {
    const s = suggestNextValues(
      ENDURANCE,
      hist([
        { performedAt: 1, sets: [{ values: { distance: 5, duration: 25, pace: 5 }, rpe: 6 }] },
      ]),
    );
    expect(s.modality).toBe('endurance');
    expect(s.values).toEqual({ distance: 5, duration: 25, pace: 5 });
    expect(Object.values(s.basis).every((b) => b === 'carry-forward')).toBe(true);
  });
});

describe('suggestNextValues — hybrid (weight nudges, endurance carries)', () => {
  it('sled push: weight nudged by RPE, distance carried', () => {
    const s = suggestNextValues(
      [field('weight'), field('distance')],
      hist([{ performedAt: 1, sets: [{ values: { weight: 50, distance: 15 }, rpe: 6 }] }]),
    );
    expect(s.modality).toBe('hybrid');
    expect(s.values['weight']).toBe(52.5);
    expect(s.basis['weight']).toBe('nudge-up');
    expect(s.values['distance']).toBe(15);
    expect(s.basis['distance']).toBe('carry-forward');
  });
});

describe('suggestNextValues — unknown modality & empty history', () => {
  it('unknown modality carries numeric fields with no nudge', () => {
    const s = suggestNextValues(
      [field('duration'), field('perceivedEffort')],
      hist([{ performedAt: 1, sets: [{ values: { duration: 30, perceivedEffort: 4 }, rpe: 5 }] }]),
    );
    expect(s.modality).toBe('unknown');
    expect(s.values).toEqual({ duration: 30, perceivedEffort: 4 });
  });

  it('no history → empty suggestion, resolved modality, null reference', () => {
    const s = suggestNextValues(STRENGTH, hist([]));
    expect(s.modality).toBe('strength');
    expect(s.values).toEqual({});
    expect(s.reference).toBeNull();
  });

  it('only suggests fields the exercise still defines', () => {
    // History has a stray `calories` value; exercise no longer tracks it.
    const s = suggestNextValues(
      STRENGTH,
      hist([{ performedAt: 1, sets: [{ values: { weight: 60, reps: 8, calories: 200 } }] }]),
    );
    expect(s.values).toEqual({ weight: 60, reps: 8 });
    expect(s.values['calories']).toBeUndefined();
  });
});

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
