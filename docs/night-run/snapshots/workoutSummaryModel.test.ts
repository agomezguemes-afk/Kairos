import { describe, it, expect } from 'vitest';

import {
  fmtDuration,
  signedDelta,
  prDeltaLabel,
  buildSessionPrs,
  type SummaryPr,
} from './workoutSummaryModel';
import { estimateOneRepMax, type ExerciseSessionPoint } from '../../../lib/history/exerciseHistory';
import { entry, exSummary, legacyPset } from '../../../lib/progression/_fixtures';

// U+2212 MINUS SIGN — the same glyph the formatters emit (not ASCII hyphen).
const MINUS = '−';

// A prior session point for an exercise. `at` differs from the candidate so
// detectPr treats it as history, not the current session.
function priorPoint(
  weight: number,
  reps: number,
  opts: { at?: number; volume?: number; libraryId?: string } = {},
): ExerciseSessionPoint {
  const at = opts.at ?? 1_600_000_000_000;
  return {
    at,
    date: new Date(at).toISOString().slice(0, 10),
    topWeight: weight,
    topReps: reps,
    volume: opts.volume ?? weight * reps,
    setsCompleted: 1,
    estimatedOneRm: estimateOneRepMax(weight, reps),
    libraryId: opts.libraryId,
  };
}

describe('fmtDuration', () => {
  it('renders seconds-only under a minute', () => {
    expect(fmtDuration(0)).toBe('0s');
    expect(fmtDuration(45)).toBe('45s');
  });
  it('drops the seconds when they are zero', () => {
    expect(fmtDuration(300)).toBe('5m');
    expect(fmtDuration(3600)).toBe('60m');
  });
  it('zero-pads the seconds when both parts show', () => {
    expect(fmtDuration(303)).toBe('5m 03s');
  });
});

describe('signedDelta', () => {
  it('prefixes a plus for positives', () => {
    expect(signedDelta(3, ' kg')).toBe('+3 kg');
  });
  it('uses U+2212 for negatives', () => {
    expect(signedDelta(-2, ' kg')).toBe(`${MINUS}2 kg`);
  });
  it('shows a bare zero without a sign', () => {
    expect(signedDelta(0, ' kg')).toBe('0 kg');
  });
  it('rounds the magnitude', () => {
    expect(signedDelta(2.6, ' kg')).toBe('+3 kg');
  });
});

describe('prDeltaLabel', () => {
  it('formats a weight PR', () => {
    expect(prDeltaLabel({ kind: 'weight', delta: 5 })).toBe('+5 kg');
  });
  it('formats a 1RM PR', () => {
    expect(prDeltaLabel({ kind: 'oneRm', delta: 3 })).toBe('+3 kg 1RM');
  });
  it('formats a volume PR', () => {
    expect(prDeltaLabel({ kind: 'volume', delta: 120 })).toBe('+120 kg vol.');
  });
  it('returns empty string when kind is null', () => {
    expect(prDeltaLabel({ kind: null, delta: 5 })).toBe('');
  });
  it('rounds magnitude through formatVolume (integer kg)', () => {
    // formatVolume rounds; the inline code did the same — behavior preserved.
    expect(prDeltaLabel({ kind: 'weight', delta: 2.6 })).toBe('+3 kg');
  });
});

describe('buildSessionPrs', () => {
  it('(a) surfaces an exercise whose top weight beats injected history', () => {
    const e = entry([exSummary('Sentadilla', [legacyPset(100, 5)])]);
    const prs = buildSessionPrs(e, () => [priorPoint(80, 5)]);
    expect(prs).toEqual<SummaryPr[]>([{ name: 'Sentadilla', delta: 20, kind: 'weight' }]);
  });

  it('(b) excludes an exercise with no completed sets / zero volume', () => {
    const e = entry([exSummary('Press banca', [legacyPset(60, 8, { completed: false })])]);
    const prs = buildSessionPrs(e, () => [priorPoint(40, 8)]);
    expect(prs).toEqual([]);
  });

  it('(c) excludes when the session does not beat history (isPr false)', () => {
    // Candidate 80×5 vs prior 100×5 — weaker weight, lower volume → not a PR.
    const e = entry([exSummary('Peso muerto', [legacyPset(80, 5)])]);
    const prs = buildSessionPrs(e, () => [priorPoint(100, 5, { volume: 500 })]);
    expect(prs).toEqual([]);
  });

  it('(d) preserves the traversal order of entry.exercises', () => {
    const e = entry([
      exSummary('Primero', [legacyPset(100, 5)]),
      exSummary('Segundo', [legacyPset(90, 5)]),
    ]);
    const prs = buildSessionPrs(e, (ref) =>
      ref.name === 'Primero' ? [priorPoint(80, 5)] : [priorPoint(70, 5)],
    );
    expect(prs.map((p) => p.name)).toEqual(['Primero', 'Segundo']);
  });

  it('(e) fires a gentle weight PR on a first-ever exercise (empty history)', () => {
    const e = entry([exSummary('Dominadas', [legacyPset(50, 6)])]);
    const prs = buildSessionPrs(e, () => []);
    // detectPr: no prior → gentle weight PR with delta = topWeight.
    expect(prs).toEqual<SummaryPr[]>([{ name: 'Dominadas', delta: 50, kind: 'weight' }]);
  });

  it('accumulates volume across completed sets, ignoring uncompleted ones', () => {
    const e = entry([
      exSummary('Remo', [
        legacyPset(50, 10), // 500
        legacyPset(50, 10, { completed: false }), // ignored
        legacyPset(60, 8), // 480, new top weight
      ]),
    ]);
    // Prior top 55×8 → candidate top 60×8 beats it → weight PR delta 5.
    const prs = buildSessionPrs(e, () => [priorPoint(55, 8, { volume: 440 })]);
    expect(prs).toEqual<SummaryPr[]>([{ name: 'Remo', delta: 5, kind: 'weight' }]);
  });
});
