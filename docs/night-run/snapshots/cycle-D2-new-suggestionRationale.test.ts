import { describe, expect, it } from 'vitest';
import { describeSuggestion } from './suggestionRationale';

const MINUS = '−'; // U+2212 — the label must use the typographic minus, not the hyphen

describe('describeSuggestion', () => {
  it('returns null when the engine has no suggestion (empty values)', () => {
    expect(describeSuggestion({ values: {}, basis: {} }, { weight: 60 })).toBeNull();
  });

  it('nudge-up: "+2.5 kg" and "fácil", with non-empty spoken', () => {
    const c = describeSuggestion(
      {
        values: { weight: 62.5, reps: 8 },
        basis: { weight: 'nudge-up', reps: 'carry-forward' },
      },
      { weight: 62.5, reps: 8 },
    );
    expect(c).not.toBeNull();
    expect(c?.text).toContain('+2.5 kg');
    expect(c?.text).toContain('fácil');
    expect(c?.spoken).toBeTruthy();
    expect(c?.spoken).toContain('fácil');
  });

  it('nudge-down: "−2.5 kg" (U+2212, no ASCII hyphen) and "costó"', () => {
    const c = describeSuggestion(
      {
        values: { weight: 57.5, reps: 8 },
        basis: { weight: 'nudge-down', reps: 'carry-forward' },
      },
      { weight: 57.5, reps: 8 },
    );
    expect(c?.text).toContain(`${MINUS}2.5 kg`);
    expect(c?.text).not.toContain('-'); // no ASCII hyphen
    expect(c?.text).toContain('costó');
    expect(c?.spoken).toContain('costó');
  });

  it('weight carry-forward → "Sugerido · igual que la última"', () => {
    const c = describeSuggestion(
      {
        values: { weight: 60, reps: 8 },
        basis: { weight: 'carry-forward', reps: 'carry-forward' },
      },
      { weight: 60, reps: 8 },
    );
    expect(c?.text).toBe('Sugerido · igual que la última');
    expect(c?.spoken).toBe('Objetivo sugerido, igual que la última vez');
  });

  it('no weight field (reps-only carry) → "igual que la última"', () => {
    const c = describeSuggestion(
      { values: { reps: 8 }, basis: { reps: 'carry-forward' } },
      { reps: 8 },
    );
    expect(c?.text).toBe('Sugerido · igual que la última');
  });

  it('edited target (current ≠ suggested) → null', () => {
    const c = describeSuggestion(
      { values: { weight: 62.5 }, basis: { weight: 'nudge-up' } },
      { weight: 60 },
    );
    expect(c).toBeNull();
  });

  it('untouched target (current === suggested) → not null', () => {
    const c = describeSuggestion(
      { values: { weight: 62.5 }, basis: { weight: 'nudge-up' } },
      { weight: 62.5 },
    );
    expect(c).not.toBeNull();
  });

  it('extra current key not in the suggestion does not count as edited', () => {
    const c = describeSuggestion(
      { values: { weight: 60 }, basis: { weight: 'carry-forward' } },
      { weight: 60, reps: 8 },
    );
    expect(c).not.toBeNull();
    expect(c?.text).toBe('Sugerido · igual que la última');
  });
});
