import { describe, expect, it } from 'vitest';
import { parseSpanishNumberWords } from './spanishNumbers';

const w = (s: string): string[] => (s === '' ? [] : s.split(' '));

describe('parseSpanishNumberWords — units', () => {
  it('single unit "ocho" → 8, length 1', () => {
    expect(parseSpanishNumberWords(w('ocho'))).toEqual({ value: 8, length: 1 });
  });

  it('"cero" → 0, still matched (length 1)', () => {
    expect(parseSpanishNumberWords(w('cero'))).toEqual({ value: 0, length: 1 });
  });
});

// 'uno'/'una' are ordinary Spanish words on their own ("una pausa larga", "uno
// de los discos") — a bare standalone match would silently corrupt a free-text
// note into a phantom number. They still work compositionally: after a tens
// word via "y" ("sesenta y una"→61) or after a hundred ("ciento uno"→101).
describe('parseSpanishNumberWords — bare "uno"/"una" excluded, compositional forms kept', () => {
  it('"una" sola → null (palabra común, no una cifra aislada)', () => {
    expect(parseSpanishNumberWords(w('una'))).toBeNull();
  });

  it('"uno" solo → null', () => {
    expect(parseSpanishNumberWords(w('uno'))).toBeNull();
  });

  it('"sesenta y una" → 61 (composición tens+y+unit, camino de código distinto)', () => {
    expect(parseSpanishNumberWords(w('sesenta y una'))).toEqual({ value: 61, length: 3 });
  });

  it('"ciento uno" → 101 (unidad tras centena, `matched` ya es true)', () => {
    expect(parseSpanishNumberWords(w('ciento uno'))).toEqual({ value: 101, length: 2 });
  });

  it('"veintiuno" no se ve afectado (palabra compuesta propia de TEENS) → 21', () => {
    expect(parseSpanishNumberWords(w('veintiuno'))).toEqual({ value: 21, length: 1 });
  });
});

describe('parseSpanishNumberWords — teens / veinti', () => {
  it('"quince" → 15', () => {
    expect(parseSpanishNumberWords(w('quince'))).toEqual({ value: 15, length: 1 });
  });

  it('"veinticinco" (una palabra) → 25, length 1', () => {
    expect(parseSpanishNumberWords(w('veinticinco'))).toEqual({ value: 25, length: 1 });
  });

  it('"veintiuno" → 21, length 1', () => {
    expect(parseSpanishNumberWords(w('veintiuno'))).toEqual({ value: 21, length: 1 });
  });
});

describe('parseSpanishNumberWords — tens (+ y + unit)', () => {
  it('"sesenta" solo → 60, length 1', () => {
    expect(parseSpanishNumberWords(w('sesenta'))).toEqual({ value: 60, length: 1 });
  });

  it('"sesenta y dos" → 62, length 3', () => {
    expect(parseSpanishNumberWords(w('sesenta y dos'))).toEqual({ value: 62, length: 3 });
  });

  it('dangling "sesenta y" (sin unidad) → 60, no consume la "y" (length 1)', () => {
    expect(parseSpanishNumberWords(w('sesenta y'))).toEqual({ value: 60, length: 1 });
  });
});

describe('parseSpanishNumberWords — hundreds', () => {
  it('"cien" → 100, length 1', () => {
    expect(parseSpanishNumberWords(w('cien'))).toEqual({ value: 100, length: 1 });
  });

  it('"doscientos" → 200, length 1', () => {
    expect(parseSpanishNumberWords(w('doscientos'))).toEqual({ value: 200, length: 1 });
  });

  it('"doscientos veinte" → 220, length 2', () => {
    expect(parseSpanishNumberWords(w('doscientos veinte'))).toEqual({ value: 220, length: 2 });
  });

  it('"ciento treinta y cinco" → 135, length 4', () => {
    expect(parseSpanishNumberWords(w('ciento treinta y cinco'))).toEqual({ value: 135, length: 4 });
  });
});

describe('parseSpanishNumberWords — "y medio" fraction', () => {
  it('"sesenta y dos y medio" → 62.5, length 5', () => {
    expect(parseSpanishNumberWords(w('sesenta y dos y medio'))).toEqual({ value: 62.5, length: 5 });
  });

  it('"medio" suelto → 0.5, length 1', () => {
    expect(parseSpanishNumberWords(w('medio'))).toEqual({ value: 0.5, length: 1 });
  });
});

describe('parseSpanishNumberWords — non-numbers → null', () => {
  it('"por" → null', () => {
    expect(parseSpanishNumberWords(w('por'))).toBeNull();
  });

  it('"y" → null', () => {
    expect(parseSpanishNumberWords(w('y'))).toBeNull();
  });

  it('"kg" → null', () => {
    expect(parseSpanishNumberWords(w('kg'))).toBeNull();
  });

  it('empty list → null', () => {
    expect(parseSpanishNumberWords([])).toBeNull();
  });
});

describe('parseSpanishNumberWords — start offset', () => {
  it('parses from mid-list: ["por","ocho"] start 1 → {8, length 1}', () => {
    expect(parseSpanishNumberWords(['por', 'ocho'], 1)).toEqual({ value: 8, length: 1 });
  });

  it('length is measured from start, not 0: ["rpe","sesenta","y","dos"] start 1 → {62, length 3}', () => {
    expect(parseSpanishNumberWords(['rpe', 'sesenta', 'y', 'dos'], 1)).toEqual({
      value: 62,
      length: 3,
    });
  });
});
