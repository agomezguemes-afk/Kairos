import { describe, expect, it } from 'vitest';
import { resolveSheetCommit } from './commit';
import type { FieldDefinition } from '../../../types/core';

function field(
  id: string,
  name: string,
  unit: string | null,
  order: number,
  type: FieldDefinition['type'] = 'number',
): FieldDefinition {
  return { id, name, type, unit, isBase: true, isPrimary: order === 0, order };
}

const strengthFields: FieldDefinition[] = [
  field('weight', 'Weight', 'kg', 0),
  field('reps', 'Reps', null, 1),
];

const enduranceFields: FieldDefinition[] = [
  field('distance', 'Distance', 'km', 0),
  field('pace', 'Pace', 'min/km', 1),
];

describe('resolveSheetCommit', () => {
  it('lets the draft override the base (correction wins)', () => {
    const c = resolveSheetCommit({ weight: 60, reps: 8 }, { weight: 62.5 }, strengthFields);
    expect(c.values).toEqual({ weight: 62.5, reps: 8 });
    expect(c.target!.separator).toBe('×');
    expect(c.target!.segments).toEqual([
      { value: '62.5', unit: 'kg' },
      { value: '8', unit: null },
    ]);
    expect(c.target!.spoken).toContain('62.5 kilos por 8');
  });

  it('fills a missing field on top of a partial base', () => {
    const c = resolveSheetCommit({ weight: 60 }, { reps: 8 }, strengthFields);
    expect(c.values).toEqual({ weight: 60, reps: 8 });
    expect(c.target!.segments).toEqual([
      { value: '60', unit: 'kg' },
      { value: '8', unit: null },
    ]);
  });

  it('keeps the base intact when the draft is empty', () => {
    const c = resolveSheetCommit({ weight: 60, reps: 8 }, {}, strengthFields);
    expect(c.values).toEqual({ weight: 60, reps: 8 });
    expect(c.target).toEqual(resolveSheetCommit({}, { weight: 60, reps: 8 }, strengthFields).target);
  });

  it('allows HECHO with no numeric target (bodyweight set)', () => {
    // Spec §"serie sin objetivo": the commit is still valid, just untargeted.
    const textOnly = [field('feeling', 'Sensación', null, 0, 'text')];
    const c = resolveSheetCommit({}, {}, textOnly);
    expect(c.values).toEqual({});
    expect(c.target).toBeNull();
  });

  it('uses the · separator for endurance pairs', () => {
    const c = resolveSheetCommit({ distance: 5 }, { pace: 6 }, enduranceFields);
    expect(c.target!.separator).toBe('·');
    expect(c.target!.segments).toEqual([
      { value: '5', unit: 'km' },
      { value: '6', unit: 'min/km' },
    ]);
  });

  it('includes draft fields absent from the base', () => {
    const c = resolveSheetCommit({ weight: 60 }, { rir: 2 }, strengthFields);
    expect(c.values).toEqual({ weight: 60, rir: 2 });
  });
});
