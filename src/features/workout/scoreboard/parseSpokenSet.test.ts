import { describe, expect, it } from 'vitest';
import { parseSpokenSet } from './parseSpokenSet';
import type { FieldDefinition } from '../../../types/core';

function numField(
  id: string,
  name: string,
  order: number,
  unit: string | null = null,
): FieldDefinition {
  return { id, name, type: 'number', unit, isBase: true, isPrimary: order === 0, order };
}

function timeField(
  id: string,
  name: string,
  order: number,
  unit: string | null = null,
): FieldDefinition {
  return { id, name, type: 'time', unit, isBase: true, isPrimary: order === 0, order };
}

const strength: FieldDefinition[] = [
  numField('weight', 'Peso', 0, 'kg'),
  numField('reps', 'Reps', 1),
];
const endurance: FieldDefinition[] = [
  numField('distance', 'Distancia', 0, 'km'),
  timeField('pace', 'Ritmo', 1, 'min/km'),
];
const bodyweight: FieldDefinition[] = [numField('reps', 'Reps', 0)];

describe('parseSpokenSet — strength idiom', () => {
  it('parses "62.5 por 8" into weight × reps', () => {
    const p = parseSpokenSet('62.5 por 8', strength);
    expect(p.values).toEqual({ weight: 62.5, reps: 8 });
    expect(p.matched).toBe(true);
    expect(p.rpe).toBeNull();
    expect(p.note).toBeNull();
  });

  it('parses the compact "60x8"', () => {
    expect(parseSpokenSet('60x8', strength).values).toEqual({ weight: 60, reps: 8 });
  });

  it('parses explicit units "60 kg × 8 reps"', () => {
    expect(parseSpokenSet('60 kg × 8 reps', strength).values).toEqual({ weight: 60, reps: 8 });
  });

  it('accepts the Spanish decimal comma "62,5 por 8"', () => {
    expect(parseSpokenSet('62,5 por 8', strength).values).toEqual({ weight: 62.5, reps: 8 });
  });
});

describe('parseSpokenSet — single units', () => {
  it('"8 reps" fills only reps', () => {
    expect(parseSpokenSet('8 reps', strength).values).toEqual({ reps: 8 });
  });

  it('"8 repeticiones" maps the long alias to reps', () => {
    expect(parseSpokenSet('8 repeticiones', strength).values).toEqual({ reps: 8 });
  });

  it('"60 kilos" fills only weight', () => {
    expect(parseSpokenSet('60 kilos', strength).values).toEqual({ weight: 60 });
  });

  it('bare "60 8" falls back to field order (weight before reps)', () => {
    expect(parseSpokenSet('60 8', strength).values).toEqual({ weight: 60, reps: 8 });
  });
});

describe('parseSpokenSet — rpe metadata', () => {
  it('"rpe 9" sets rpe with no field values, still matched', () => {
    const p = parseSpokenSet('rpe 9', strength);
    expect(p).toEqual({ values: {}, rpe: 9, note: null, matched: true });
  });

  it('combines values and rpe in "62.5 por 8 rpe 9"', () => {
    const p = parseSpokenSet('62.5 por 8 rpe 9', strength);
    expect(p.values).toEqual({ weight: 62.5, reps: 8 });
    expect(p.rpe).toBe(9);
  });

  it('out-of-range "rpe 11" is discarded entirely (no bare-number leak)', () => {
    const p = parseSpokenSet('rpe 11', strength);
    expect(p).toEqual({ values: {}, rpe: null, note: null, matched: false });
  });
});

describe('parseSpokenSet — notes', () => {
  it('leftover effort text becomes the note', () => {
    const p = parseSpokenSet('60 por 8 me costó', strength);
    expect(p.values).toEqual({ weight: 60, reps: 8 });
    expect(p.note).toBe('me costó');
  });

  it('collapses extra whitespace inside the note', () => {
    expect(parseSpokenSet('60 por 8   me   costó mucho', strength).note).toBe('me costó mucho');
  });

  it('an unintelligible utterance creates no note and no match', () => {
    const p = parseSpokenSet('hola qué tal', strength);
    expect(p).toEqual({ values: {}, rpe: null, note: null, matched: false });
  });
});

describe('parseSpokenSet — other disciplines', () => {
  it('endurance "5 km" maps by field unit', () => {
    expect(parseSpokenSet('5 km', endurance).values).toEqual({ distance: 5 });
  });

  it('endurance decimals "10.5 km"', () => {
    expect(parseSpokenSet('10.5 km', endurance).values).toEqual({ distance: 10.5 });
  });

  it('endurance "5 km 5:30" fills the time field as "m:ss"', () => {
    expect(parseSpokenSet('5 km 5:30', endurance).values).toEqual({ distance: 5, pace: '5:30' });
  });

  it('bodyweight bare "8" falls back to the only numeric field', () => {
    expect(parseSpokenSet('8', bodyweight).values).toEqual({ reps: 8 });
  });
});

describe('parseSpokenSet — spelled-out Spanish numbers', () => {
  it('"sesenta por ocho" → weight × reps', () => {
    expect(parseSpokenSet('sesenta por ocho', strength).values).toEqual({ weight: 60, reps: 8 });
  });

  it('tens+y+unit "sesenta y dos por ocho" → 62 × 8', () => {
    const p = parseSpokenSet('sesenta y dos por ocho', strength);
    expect(p.values).toEqual({ weight: 62, reps: 8 });
    expect(p.note).toBeNull();
  });

  it('"y medio" fraction "sesenta y dos y medio por ocho" → 62.5 × 8', () => {
    expect(parseSpokenSet('sesenta y dos y medio por ocho', strength).values).toEqual({
      weight: 62.5,
      reps: 8,
    });
  });

  it('hundreds+rest "doscientos veinte por cinco" → 220 × 5', () => {
    expect(parseSpokenSet('doscientos veinte por cinco', strength).values).toEqual({
      weight: 220,
      reps: 5,
    });
  });

  it('single unit word "ocho reps" fills only reps', () => {
    expect(parseSpokenSet('ocho reps', strength).values).toEqual({ reps: 8 });
  });

  it('endurance "cinco km" maps by field unit', () => {
    expect(parseSpokenSet('cinco km', endurance).values).toEqual({ distance: 5 });
  });

  it('"rpe ocho" sets rpe from a spelled-out number', () => {
    const p = parseSpokenSet('rpe ocho', strength);
    expect(p.rpe).toBe(8);
    expect(p.values).toEqual({});
  });

  it('mixed digit + word "60 por ocho" → 60 × 8', () => {
    expect(parseSpokenSet('60 por ocho', strength).values).toEqual({ weight: 60, reps: 8 });
  });

  it('regression: digit cases still parse identically ("62.5 por 8", "60x8")', () => {
    expect(parseSpokenSet('62.5 por 8', strength).values).toEqual({ weight: 62.5, reps: 8 });
    expect(parseSpokenSet('60x8', strength).values).toEqual({ weight: 60, reps: 8 });
  });
});

describe('parseSpokenSet — "uno"/"una" as ordinary words, not phantom numbers', () => {
  it('"una pausa larga" is treated as unrecognized (like "hola qué tal"), not a phantom weight:1', () => {
    // Before the fix, "una" folded to a bare number token and step 5 (bare
    // numbers fill by field.order) wrote it into `weight` — a silent, wrong
    // value, with the note truncated to "pausa larga" (losing "una"). The fix
    // makes this behave exactly like any other unrecognized utterance: no
    // phantom value, no partial note — same contract as "hola qué tal".
    const p = parseSpokenSet('una pausa larga', strength);
    expect(p).toEqual({ values: {}, rpe: null, note: null, matched: false });
  });

  it('"uno de los discos se resbaló" is unrecognized, not a phantom reps:1', () => {
    const p = parseSpokenSet('uno de los discos se resbaló', bodyweight);
    expect(p).toEqual({ values: {}, rpe: null, note: null, matched: false });
  });

  it('compositional "sesenta y una por ocho" still resolves to weight × reps', () => {
    expect(parseSpokenSet('sesenta y una por ocho', strength).values).toEqual({
      weight: 61,
      reps: 8,
    });
  });
});

describe('parseSpokenSet — robustness', () => {
  it('empty input matches nothing', () => {
    expect(parseSpokenSet('', strength)).toEqual({
      values: {},
      rpe: null,
      note: null,
      matched: false,
    });
  });

  it('never throws on hostile input and with no fields', () => {
    expect(() => parseSpokenSet('!!! 99:99 ,,,, rpe rpe ×××', [])).not.toThrow();
    expect(parseSpokenSet('62.5 por 8', []).matched).toBe(false);
  });
});
