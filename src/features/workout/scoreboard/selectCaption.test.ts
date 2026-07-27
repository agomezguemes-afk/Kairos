import { describe, expect, it } from 'vitest';
import { selectSuggestionCaption } from './selectCaption';
import type { InSessionNudge } from '../../../lib/progression';

const MINUS = '−'; // U+2212 — the caption uses the typographic minus, not the hyphen

const easyNudge: InSessionNudge = { deltaKg: 2.5, nextWeight: 62.5, reason: 'easy' };
const hardNudge: InSessionNudge = { deltaKg: -2.5, nextWeight: 57.5, reason: 'hard' };

describe('selectSuggestionCaption — precedence: nudge intra-sesión > sugerido > nada', () => {
  it('1. changing:true → null (aunque haya nudge y suggestion)', () => {
    const c = selectSuggestionCaption({
      changing: true,
      inSessionNudge: easyNudge,
      suggestion: { values: { weight: 60 }, basis: { weight: 'carry-forward' } },
      currentValues: { weight: 62.5 },
    });
    expect(c).toBeNull();
  });

  it('2. nudge presente + weight === nextWeight → caption del nudge (easy = fácil)', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: easyNudge,
      suggestion: null,
      currentValues: { weight: 62.5 },
    });
    expect(c).not.toBeNull();
    expect(c?.text).toContain('+2.5 kg');
    expect(c?.text).toContain('fácil');
    expect(c?.text).toContain('serie anterior');
  });

  it('2b. nudge hard + weight === nextWeight → caption del nudge (−2.5 kg, costó)', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: hardNudge,
      suggestion: null,
      currentValues: { weight: 57.5 },
    });
    expect(c?.text).toContain(`${MINUS}2.5 kg`);
    expect(c?.text).not.toContain('-'); // no ASCII hyphen
    expect(c?.text).toContain('costó');
  });

  it('3. nudge presente + peso editado (≠ nextWeight) → null (el usuario mandó, no cae al sugerido)', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: easyNudge,
      suggestion: { values: { weight: 60 }, basis: { weight: 'carry-forward' } },
      currentValues: { weight: 70 },
    });
    expect(c).toBeNull();
  });

  it('4. sin nudge + suggestion nudge-up → caption del sugerido ("la última fue fácil")', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: null,
      suggestion: {
        values: { weight: 62.5, reps: 8 },
        basis: { weight: 'nudge-up', reps: 'carry-forward' },
      },
      currentValues: { weight: 62.5, reps: 8 },
    });
    expect(c).not.toBeNull();
    expect(c?.text).toContain('+2.5 kg');
    expect(c?.text).toContain('última');
    expect(c?.text).toContain('fácil');
  });

  it('5. sin nudge + suggestion carry-forward → "igual que la última"', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: null,
      suggestion: { values: { weight: 60 }, basis: { weight: 'carry-forward' } },
      currentValues: { weight: 60 },
    });
    expect(c?.text).toBe('Sugerido · igual que la última');
  });

  it('6. sin nudge + sin suggestion → null', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: null,
      suggestion: null,
      currentValues: { weight: 60 },
    });
    expect(c).toBeNull();
  });

  it('7. nudge presente pero currentValues sin clave weight (bodyweight) → null (no casa nextWeight)', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: easyNudge,
      suggestion: null,
      currentValues: { reps: 8 },
    });
    expect(c).toBeNull();
  });

  it('8. precedencia: nudge Y suggestion presentes → gana el nudge', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: easyNudge,
      suggestion: { values: { weight: 60 }, basis: { weight: 'carry-forward' } },
      currentValues: { weight: 62.5 },
    });
    expect(c).not.toBeNull();
    // el nudge dice "serie anterior"; el sugerido diría "la última"
    expect(c?.text).toContain('serie anterior');
    expect(c?.text).not.toContain('igual que la última');
  });

  it('9. suggestion con values vacíos → null (describeSuggestion no inventa)', () => {
    const c = selectSuggestionCaption({
      changing: false,
      inSessionNudge: null,
      suggestion: { values: {}, basis: {} },
      currentValues: { weight: 60 },
    });
    expect(c).toBeNull();
  });
});
