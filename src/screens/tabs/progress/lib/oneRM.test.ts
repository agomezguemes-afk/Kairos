import { describe, expect, it } from 'vitest';
import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';
import {
  brzycki1RM,
  epley1RM,
  oneRMSeries,
  sessionBest1RM,
  summarize1RM,
  type OneRMPoint,
} from './oneRM';

describe('epley1RM', () => {
  it('matches the formula in the validated range', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 5)).toBeCloseTo(116.6667, 3);
    expect(epley1RM(60, 10)).toBeCloseTo(80, 5);
  });

  it('returns 0 outside the validated range or for non-positive input', () => {
    expect(epley1RM(100, 13)).toBe(0);
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(-100, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
  });

  it('never propagates NaN/Infinity (corrupted or imported input)', () => {
    expect(epley1RM(NaN, 5)).toBe(0);
    expect(epley1RM(100, NaN)).toBe(0);
    expect(epley1RM(Infinity, 5)).toBe(0);
    expect(epley1RM(100, Infinity)).toBe(0);
    expect(epley1RM(-Infinity, 5)).toBe(0);
  });
});

describe('brzycki1RM', () => {
  it('matches the formula and is safe at the reps cap (no divide-by-zero)', () => {
    expect(brzycki1RM(100, 1)).toBe(100);
    expect(brzycki1RM(100, 5)).toBeCloseTo(112.5, 5);
    expect(brzycki1RM(100, 13)).toBe(0); // capped before the 37-r denominator nears 0
  });

  it('rejects non-finite input', () => {
    expect(brzycki1RM(NaN, 5)).toBe(0);
    expect(brzycki1RM(100, NaN)).toBe(0);
    expect(brzycki1RM(Infinity, 3)).toBe(0);
  });
});

describe('sessionBest1RM', () => {
  it('takes the best estimate across completed sets, rounded to 0.1', () => {
    const best = sessionBest1RM([
      { weight: 100, reps: 5, completed: true }, // 116.67
      { weight: 120, reps: 3, completed: true }, // 132.0
      { weight: 200, reps: 5, completed: false }, // ignored: not completed
    ]);
    expect(best).toBe(132);
  });

  it('ignores null and non-finite-derived sets, returns 0 when nothing eligible', () => {
    expect(sessionBest1RM(undefined)).toBe(0);
    expect(sessionBest1RM([])).toBe(0);
    expect(
      sessionBest1RM([
        { weight: null, reps: 5, completed: true },
        { weight: 100, reps: null, completed: true },
        { weight: NaN, reps: 5, completed: true },
      ]),
    ).toBe(0);
  });
});

// Minimal fixture — oneRMSeries only reads endedAt + exercises[].performedSets.
function entry(
  endedAt: number,
  exerciseId: string,
  performedSets: { weight: number | null; reps: number | null; completed: boolean }[],
): WorkoutHistoryEntry {
  return {
    endedAt,
    exercises: [{ exerciseId, performedSets }],
  } as unknown as WorkoutHistoryEntry;
}

describe('oneRMSeries', () => {
  it('builds a chronological series, skipping sessions with no eligible sets', () => {
    const history = [
      entry(3000, 'squat', [{ weight: 140, reps: 3, completed: true }]),
      entry(2000, 'squat', [{ weight: 0, reps: 0, completed: true }]), // no estimate → skipped
      entry(1000, 'squat', [{ weight: 100, reps: 5, completed: true }]),
    ];
    const series = oneRMSeries(history, 'squat');
    expect(series.map((p) => p.date)).toEqual([1000, 3000]); // reversed to asc
    expect(series).toHaveLength(2);
  });

  it('respects the limit and ignores other exercises', () => {
    const history = Array.from({ length: 20 }, (_, i) =>
      entry(i, 'bench', [{ weight: 80 + i, reps: 5, completed: true }]),
    );
    expect(oneRMSeries(history, 'bench', 5)).toHaveLength(5);
    expect(oneRMSeries(history, 'deadlift')).toHaveLength(0);
  });
});

describe('summarize1RM', () => {
  it('reports zeros and null trend for an empty series', () => {
    expect(summarize1RM([])).toEqual({ current: 0, peak: 0, trendPct: null });
  });

  it('computes current, peak, and % trend vs the first point', () => {
    const series: OneRMPoint[] = [
      { date: 1, oneRM: 100 },
      { date: 2, oneRM: 130 },
      { date: 3, oneRM: 120 },
    ];
    const s = summarize1RM(series);
    expect(s.current).toBe(120);
    expect(s.peak).toBe(130);
    expect(s.trendPct).toBe(20); // (120-100)/100
  });

  it('returns null trend with a single point', () => {
    expect(summarize1RM([{ date: 1, oneRM: 100 }]).trendPct).toBeNull();
  });
});
