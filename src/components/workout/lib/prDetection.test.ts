import { describe, it, expect } from 'vitest';

import { detectPR, formatPRDelta, PR_LABEL, type PRResult } from './prDetection';
import { entry, exSummary, pset } from '../../../lib/progression/_fixtures';
import type { FieldDefinition } from '../../../types/core';

function fields(defs: { id: string; unit?: string | null }[]): FieldDefinition[] {
  return defs.map((d, i) => ({
    id: d.id,
    name: d.id,
    type: 'number',
    unit: d.unit ?? null,
    isBase: true,
    isPrimary: false,
    order: i,
  }));
}

function exercise(
  name: string,
  fieldDefs: { id: string; unit?: string | null }[],
  opts: { id?: string; libraryId?: string } = {},
) {
  return {
    id: opts.id ?? 'ex_current',
    name,
    libraryId: opts.libraryId,
    fields: fields(fieldDefs),
  };
}

const STRENGTH = [
  { id: 'weight', unit: 'kg' },
  { id: 'reps', unit: null },
];

// ============================================================================
// Strength — no-regression: every badge the old weight×reps detector fired for
// must still fire, with the same kind + delta.
// ============================================================================
describe('detectPR — strength (no regression on the old badge)', () => {
  it('a heavier top set is a max-weight PR', () => {
    const pr = detectPR({
      exercise: exercise('Press banca', STRENGTH),
      values: { weight: 85, reps: 5 },
      history: [entry([exSummary('Press banca', [pset({ weight: 80, reps: 5 })])])],
    });
    expect(pr).toEqual<PRResult>({ kind: 'max-weight', delta: 5, unit: 'kg' });
  });

  it('one more rep at your top weight is a max-reps-at-weight PR', () => {
    const pr = detectPR({
      exercise: exercise('Sentadilla', STRENGTH),
      values: { weight: 80, reps: 6 },
      history: [entry([exSummary('Sentadilla', [pset({ weight: 80, reps: 5 })])])],
    });
    expect(pr).toEqual<PRResult>({ kind: 'max-reps-at-weight', delta: 1, unit: 'rep' });
  });

  it('a bigger single set by tonnage (no weight/rep PR) is a max-volume-set PR', () => {
    const pr = detectPR({
      exercise: exercise('Peso muerto', STRENGTH),
      values: { weight: 90, reps: 6 }, // 540 > 500, but 90 < 100 kg top
      history: [entry([exSummary('Peso muerto', [pset({ weight: 100, reps: 5 })])])],
    });
    expect(pr).toEqual<PRResult>({ kind: 'max-volume-set', delta: 40, unit: 'kg·rep' });
  });

  it('matching your best exactly is not a PR', () => {
    const pr = detectPR({
      exercise: exercise('Press banca', STRENGTH),
      values: { weight: 100, reps: 5 },
      history: [entry([exSummary('Press banca', [pset({ weight: 100, reps: 5 })])])],
    });
    expect(pr).toBeNull();
  });

  it('the first-ever set (no prior history) is not a PR', () => {
    const pr = detectPR({
      exercise: exercise('Press banca', STRENGTH),
      values: { weight: 999, reps: 10 },
      history: [],
    });
    expect(pr).toBeNull();
  });

  it('invalid values (≤0) do not fire', () => {
    const pr = detectPR({
      exercise: exercise('Press banca', STRENGTH),
      values: { weight: 0, reps: 5 },
      history: [entry([exSummary('Press banca', [pset({ weight: 80, reps: 5 })])])],
    });
    expect(pr).toBeNull();
  });

  // The consolidation fix: the old detector matched by exerciseId, so a Kai-built
  // block (fresh exercise id) never saw its own history. Name-match now works.
  it('detects across a fresh exercise id via normalized name', () => {
    const pr = detectPR({
      exercise: exercise('Sentadilla', STRENGTH, { id: 'ex_freshly_built_123' }),
      values: { weight: 105, reps: 5 },
      history: [
        entry([
          exSummary('Sentadilla', [pset({ weight: 100, reps: 5 })], { exerciseId: 'ex_old' }),
        ]),
      ],
    });
    expect(pr).toEqual<PRResult>({ kind: 'max-weight', delta: 5, unit: 'kg' });
  });
});

// ============================================================================
// Endurance — the new capability: fastest pace, longest distance, most calories.
// ============================================================================
describe('detectPR — endurance', () => {
  it('a faster pace is a fastest-pace PR (lower is better)', () => {
    const pr = detectPR({
      exercise: exercise('Rodaje', [{ id: 'pace', unit: 'min/km' }]),
      values: { pace: 4.6 },
      history: [entry([exSummary('Rodaje', [pset({ pace: 5.0 }), pset({ pace: 4.8 })])])],
    });
    expect(pr?.kind).toBe('fastest-pace');
    expect(pr?.delta).toBeCloseTo(0.2, 5);
    expect(pr?.unit).toBe('min/km');
  });

  it('a farther distance is a longest-distance PR', () => {
    const pr = detectPR({
      exercise: exercise('Tirada larga', [{ id: 'distance', unit: 'km' }]),
      values: { distance: 6 },
      history: [entry([exSummary('Tirada larga', [pset({ distance: 5 })])])],
    });
    expect(pr).toEqual<PRResult>({ kind: 'longest-distance', delta: 1, unit: 'km' });
  });

  it('more calories is a most-calories PR', () => {
    const pr = detectPR({
      exercise: exercise('Remo', [{ id: 'calories', unit: 'kcal' }]),
      values: { calories: 250 },
      history: [entry([exSummary('Remo', [pset({ calories: 200 })])])],
    });
    expect(pr).toEqual<PRResult>({ kind: 'most-calories', delta: 50, unit: 'kcal' });
  });

  it('a slower pace is not a PR', () => {
    const pr = detectPR({
      exercise: exercise('Rodaje', [{ id: 'pace', unit: 'min/km' }]),
      values: { pace: 5.2 },
      history: [entry([exSummary('Rodaje', [pset({ pace: 5.0 })])])],
    });
    expect(pr).toBeNull();
  });

  it('a first-ever endurance effort is not a PR', () => {
    const pr = detectPR({
      exercise: exercise('Rodaje', [{ id: 'distance', unit: 'km' }]),
      values: { distance: 10 },
      history: [],
    });
    expect(pr).toBeNull();
  });
});

// ============================================================================
// Priority + guards spanning modalities.
// ============================================================================
describe('detectPR — priority and exclusion', () => {
  it('a hybrid set that is both a weight and distance PR reports the strength PR', () => {
    const pr = detectPR({
      exercise: exercise('Sled push', [
        { id: 'weight', unit: 'kg' },
        { id: 'reps', unit: null },
        { id: 'distance', unit: 'm' },
      ]),
      values: { weight: 105, reps: 5, distance: 30 },
      history: [entry([exSummary('Sled push', [pset({ weight: 100, reps: 5, distance: 25 })])])],
    });
    expect(pr?.kind).toBe('max-weight');
  });

  it('excludeEntryId drops the in-progress session so it cannot beat itself', () => {
    const inProgress = entry([exSummary('Press banca', [pset({ weight: 80, reps: 5 })])]);
    const pr = detectPR({
      exercise: exercise('Press banca', STRENGTH),
      values: { weight: 85, reps: 5 },
      history: [inProgress],
      excludeEntryId: inProgress.id,
    });
    expect(pr).toBeNull(); // only prior was excluded → nothing to beat
  });
});

// ============================================================================
// Copy — Kai voice, sober, no exclamation marks.
// ============================================================================
describe('formatPRDelta + PR_LABEL', () => {
  it('formats each kind', () => {
    expect(formatPRDelta({ kind: 'max-weight', delta: 2.5, unit: 'kg' })).toBe('+2.5 kg');
    expect(formatPRDelta({ kind: 'max-reps-at-weight', delta: 1, unit: 'rep' })).toBe('+1 rep');
    expect(formatPRDelta({ kind: 'max-reps-at-weight', delta: 3, unit: 'rep' })).toBe('+3 reps');
    expect(formatPRDelta({ kind: 'max-volume-set', delta: 25, unit: 'kg·rep' })).toBe(
      'Volumen +25',
    );
    expect(formatPRDelta({ kind: 'longest-distance', delta: 0.5, unit: 'km' })).toBe('+0.5 km');
    expect(formatPRDelta({ kind: 'most-calories', delta: 50, unit: 'kcal' })).toBe('+50 kcal');
    expect(formatPRDelta({ kind: 'fastest-pace', delta: 0.2, unit: 'min/km' })).toBe('-12 s/km');
  });

  it('has a sober label for every kind and no exclamation marks', () => {
    for (const label of Object.values(PR_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toContain('!');
    }
  });
});
