import { describe, expect, it } from 'vitest';
import { computeProgressionDelta, progressionCaption } from './progressionDelta';

const MINUS = '−'; // U+2212 — the label must use the typographic minus, not the hyphen

describe('computeProgressionDelta', () => {
  it('returns null when there is no previous reference', () => {
    expect(computeProgressionDelta({ weight: 60, reps: 8 }, null)).toBeNull();
  });

  it('weight up: 62.5 vs 60 → +2.5 kg', () => {
    const d = computeProgressionDelta({ weight: 62.5, reps: 8 }, { weight: 60, reps: 8 });
    expect(d).not.toBeNull();
    expect(d?.field).toBe('weight');
    expect(d?.direction).toBe('up');
    expect(d?.delta).toBe(2.5);
    expect(d?.label).toBe('+2.5 kg');
    expect(d?.spoken).toContain('2.5 kilos más');
  });

  it('weight down: 57.5 vs 60 → −2.5 kg with U+2212', () => {
    const d = computeProgressionDelta({ weight: 57.5, reps: 8 }, { weight: 60, reps: 8 });
    expect(d?.direction).toBe('down');
    expect(d?.delta).toBe(-2.5);
    expect(d?.label).toBe(`${MINUS}2.5 kg`);
    expect(d?.label).not.toContain('-'); // no ASCII hyphen
    expect(d?.spoken).toContain('menos que la última');
  });

  it('weight same: 60 vs 60 → igual que la última', () => {
    const d = computeProgressionDelta({ weight: 60, reps: 8 }, { weight: 60, reps: 8 });
    expect(d?.field).toBe('weight');
    expect(d?.direction).toBe('same');
    expect(d?.delta).toBe(0);
    expect(d?.label).toBe('igual que la última');
    expect(d?.spoken).toBe('igual que la última vez');
  });

  it('falls back to reps when previous has no weight: 10 vs 8 → +2 reps', () => {
    const d = computeProgressionDelta({ reps: 10 }, { weight: null, reps: 8 });
    expect(d?.field).toBe('reps');
    expect(d?.direction).toBe('up');
    expect(d?.delta).toBe(2);
    expect(d?.label).toBe('+2 reps');
    expect(d?.spoken).toContain('2 repeticiones más');
  });

  it('reps down singular: 7 vs 8 → −1 rep / 1 repetición menos', () => {
    const d = computeProgressionDelta({ reps: 7 }, { weight: null, reps: 8 });
    expect(d?.direction).toBe('down');
    expect(d?.delta).toBe(-1);
    expect(d?.label).toBe(`${MINUS}1 rep`);
    expect(d?.spoken).toContain('1 repetición menos');
  });

  it('reps same: 8 vs 8 → igual que la última', () => {
    const d = computeProgressionDelta({ reps: 8 }, { weight: null, reps: 8 });
    expect(d?.field).toBe('reps');
    expect(d?.direction).toBe('same');
    expect(d?.label).toBe('igual que la última');
    expect(d?.spoken).toBe('igual que la última vez');
  });

  it('returns null when previous has weight but current has neither weight nor reps', () => {
    expect(computeProgressionDelta({}, { weight: 60, reps: null })).toBeNull();
  });

  it('falls to reps when previous.weight is null even if current has weight', () => {
    const d = computeProgressionDelta({ weight: 60, reps: 10 }, { weight: null, reps: 8 });
    expect(d?.field).toBe('reps');
    expect(d?.delta).toBe(2);
  });

  it('trims decimals via stripZero: 62.5 vs 61 → +1.5 kg (no trailing zeros)', () => {
    const d = computeProgressionDelta({ weight: 62.5 }, { weight: 61, reps: null });
    expect(d?.label).toBe('+1.5 kg');
    expect(d?.spoken).toContain('1.5 kilos más');
  });

  it('prefers weight over reps when both axes are comparable', () => {
    const d = computeProgressionDelta({ weight: 62.5, reps: 10 }, { weight: 60, reps: 8 });
    expect(d?.field).toBe('weight');
    expect(d?.delta).toBe(2.5);
  });

  it('returns null when previous.weight is null and reps are not comparable', () => {
    expect(computeProgressionDelta({ weight: 60 }, { weight: null, reps: null })).toBeNull();
    expect(computeProgressionDelta({ weight: 60 }, { weight: null, reps: 8 })).toBeNull();
  });

  it('non-numeric current values are ignored (no throw, falls through)', () => {
    expect(computeProgressionDelta({ weight: 'mucho', reps: null }, { weight: 60, reps: null })).toBeNull();
    const d = computeProgressionDelta({ weight: '60', reps: 9 }, { weight: 60, reps: 8 });
    expect(d?.field).toBe('reps'); // string weight is not comparable → reps axis
    expect(d?.delta).toBe(1);
  });

  it('singular kilo: 61 vs 60 → "1 kilo más", not "1 kilos"', () => {
    const d = computeProgressionDelta({ weight: 61 }, { weight: 60, reps: null });
    expect(d?.label).toBe('+1 kg');
    expect(d?.spoken).toContain('1 kilo más');
    expect(d?.spoken).not.toContain('1 kilos');
  });
});

describe('progressionCaption', () => {
  it('edited=false, delta null → bare "Sugerido"', () => {
    const c = progressionCaption(null, { edited: false });
    expect(c?.text).toBe('Sugerido');
    expect(c?.spoken).toBeTruthy();
  });

  it('edited=false, same → "Sugerido · igual que la última"', () => {
    const d = computeProgressionDelta({ weight: 60 }, { weight: 60, reps: null });
    const c = progressionCaption(d, { edited: false });
    expect(c?.text).toBe('Sugerido · igual que la última');
    expect(c?.spoken).toBeTruthy();
  });

  it('edited=false, up → "Sugerido · +2.5 kg"', () => {
    const d = computeProgressionDelta({ weight: 62.5 }, { weight: 60, reps: null });
    const c = progressionCaption(d, { edited: false });
    expect(c?.text).toBe('Sugerido · +2.5 kg');
    expect(c?.spoken).toBeTruthy();
    expect(c?.spoken).toContain('Objetivo sugerido');
  });

  it('edited=true, delta null → null (nothing to say)', () => {
    expect(progressionCaption(null, { edited: true })).toBeNull();
  });

  it('edited=true, same → "Igual que la última" without "Sugerido"', () => {
    const d = computeProgressionDelta({ weight: 60 }, { weight: 60, reps: null });
    const c = progressionCaption(d, { edited: true });
    expect(c?.text).toBe('Igual que la última');
    expect(c?.text).not.toContain('Sugerido');
    expect(c?.spoken).toBeTruthy();
  });

  it('edited=true, down → "−2.5 kg vs la última" without "Sugerido"', () => {
    const d = computeProgressionDelta({ weight: 57.5 }, { weight: 60, reps: null });
    const c = progressionCaption(d, { edited: true });
    expect(c?.text).toBe(`${MINUS}2.5 kg vs la última`);
    expect(c?.text).not.toContain('Sugerido');
    expect(c?.spoken).toBeTruthy();
  });
});
