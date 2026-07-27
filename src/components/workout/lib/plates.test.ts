// plates — the barbell-loading solver used mid-session (long-press a weight
// field opens the calculator). This is the last pure-core of the in-use flow
// without test coverage (BRIEF-12); every case here is hand-traced against the
// real algorithm in plates.ts. Test-only — plates.ts is never modified.

import { describe, it, expect } from 'vitest';
import { solvePlates, formatPlateList, DEFAULT_KG_PLATES, DEFAULT_LB_PLATES } from './plates';

describe('solvePlates — exact fits', () => {
  it('simple exact: 60kg on a 20kg bar → one 20 per side', () => {
    const s = solvePlates({ target: 60, bar: 20 });
    expect(s).toEqual({
      plates: [{ size: 20, count: 1 }],
      perSideKg: 20,
      totalKg: 60,
      shortBy: 0,
      warning: null,
    });
  });

  it('greedy multi-plate: 100kg → 25+15 per side', () => {
    const s = solvePlates({ target: 100, bar: 20 });
    expect(s).toEqual({
      plates: [
        { size: 25, count: 1 },
        { size: 15, count: 1 },
      ],
      perSideKg: 40,
      totalKg: 100,
      shortBy: 0,
      warning: null,
    });
  });

  it('lb inventory: 135lb on a 45lb bar → one 45 per side', () => {
    const s = solvePlates({ target: 135, bar: 45, inventory: DEFAULT_LB_PLATES });
    expect(s).toEqual({
      plates: [{ size: 45, count: 1 }],
      perSideKg: 45,
      totalKg: 135,
      shortBy: 0,
      warning: null,
    });
  });

  it('default kg plates close an odd target exactly (2.5/1.25 close the gap)', () => {
    const s = solvePlates({ target: 87.5, bar: 20 });
    expect(s.plates).toEqual([
      { size: 25, count: 1 },
      { size: 5, count: 1 },
      { size: 2.5, count: 1 },
      { size: 1.25, count: 1 },
    ]);
    expect(s.totalKg).toBe(87.5);
    expect(s.shortBy).toBe(0);
    expect(s.warning).toBeNull();
  });
});

describe('solvePlates — below the bar / at the bar', () => {
  it('target below the bar itself → below-bar warning, no plates', () => {
    const s = solvePlates({ target: 15, bar: 20 });
    expect(s).toEqual({
      plates: [],
      perSideKg: 0,
      totalKg: 20,
      shortBy: -5,
      warning: 'below-bar',
    });
  });

  it('target equals the bar → nothing to load, no warning', () => {
    const s = solvePlates({ target: 20, bar: 20 });
    expect(s).toEqual({
      plates: [],
      perSideKg: 0,
      totalKg: 20,
      shortBy: 0,
      warning: null,
    });
  });
});

describe('solvePlates — unreachable targets', () => {
  it('restricted inventory cannot close the gap → odd-target, reports shortBy', () => {
    const s = solvePlates({
      target: 87.5,
      bar: 20,
      inventory: { sizes: [25, 20, 15, 10, 5] },
    });
    expect(s.plates).toEqual([
      { size: 25, count: 1 },
      { size: 5, count: 1 },
    ]);
    expect(s.perSideKg).toBe(30);
    expect(s.totalKg).toBe(80);
    expect(s.shortBy).toBe(7.5);
    expect(s.warning).toBe('odd-target');
  });

  it('maxPerSide caps a plate even when more would fit numerically', () => {
    const s = solvePlates({
      target: 120,
      bar: 20,
      inventory: { sizes: [25], maxPerSide: { 25: 1 } },
    });
    expect(s.plates).toEqual([{ size: 25, count: 1 }]);
    expect(s.perSideKg).toBe(25);
    expect(s.totalKg).toBe(70);
    expect(s.shortBy).toBe(50);
    expect(s.warning).toBe('odd-target');
  });
});

describe('solvePlates — rounding never leaks float noise', () => {
  it('an awkward target rounds shortBy to a clean 1-decimal value', () => {
    // 61.3 - 61 is not exact in binary float (~0.2999999999999972); round1
    // must clean it to display-grade 0.3, not the raw float residue.
    const s = solvePlates({ target: 61.3, bar: 20 });
    expect(s.perSideKg).toBe(20.5);
    expect(s.totalKg).toBe(61);
    expect(s.shortBy).toBe(0.3);
    expect(s.warning).toBe('odd-target');
  });
});

describe('solvePlates — output order is always descending', () => {
  it('an unsorted inventory still yields plates largest-first', () => {
    const s = solvePlates({ target: 80, bar: 20, inventory: { sizes: [5, 25, 10] } });
    expect(s.plates).toEqual([
      { size: 25, count: 1 },
      { size: 5, count: 1 },
    ]);
    expect(s.totalKg).toBe(80);
    expect(s.shortBy).toBe(0);
  });
});

describe('solvePlates — epsilon guard at the bar', () => {
  it('a target a hair above the bar is treated as "at the bar", not a phantom plate', () => {
    const s = solvePlates({ target: 20.0000001, bar: 20 });
    expect(s).toEqual({
      plates: [],
      perSideKg: 0,
      totalKg: 20,
      shortBy: 0,
      warning: null,
    });
  });
});

describe('formatPlateList', () => {
  it('no plates → "Sin discos"', () => {
    expect(formatPlateList([])).toBe('Sin discos');
  });

  it('formats count×size pairs, trimming trailing zeros on fractional sizes', () => {
    expect(
      formatPlateList([
        { size: 25, count: 1 },
        { size: 2.5, count: 2 },
      ]),
    ).toBe('1×25 · 2×2.5');
  });
});
