import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT } from '../flow/onboardingFlow';
import {
  applyPage,
  EQUIPMENT_OPTIONS,
  serialList,
  SENTENCES,
  type FilledBlank,
} from './manuscript';

describe('serialList', () => {
  it('composes 2+ words as "a y b" / "a, b y c"', () => {
    expect(serialList(['mancuernas'])).toBe('mancuernas');
    expect(serialList(['mancuernas', 'bandas'])).toBe('mancuernas y bandas');
    expect(serialList(['mancuernas', 'bandas', 'esterilla'])).toBe(
      'mancuernas, bandas y esterilla',
    );
  });

  it('is empty for no words', () => {
    expect(serialList([])).toBe('');
  });
});

describe('equipment is genuinely multi-select (U-D)', () => {
  it('keeps ≥2 selected equipment ids on the draft', () => {
    const filled: FilledBlank[] = [
      { id: 'equipment', skipped: false, value: ['dumbbells', 'resistance_bands', 'yoga_mat'] },
    ];
    const draft = applyPage(EMPTY_DRAFT, filled);
    expect(draft.equipment).toEqual(['dumbbells', 'resistance_bands', 'yoga_mat']);
    expect(draft.equipment.length).toBeGreaterThanOrEqual(2);
  });

  it('exposes a multi-select ("chips") blank for equipment with the real ids', () => {
    const equip = SENTENCES.find((s) => s.id === 'equipment');
    expect(equip?.kind).toBe('chips');
    const values = EQUIPMENT_OPTIONS.map((o) => o.value);
    expect(values).toContain('dumbbells');
    expect(values).toContain('machines_full_gym');
  });
});

describe('applyPage folds answers, leaving skips to smart-defaults', () => {
  it('maps a full page onto the draft', () => {
    const filled: FilledBlank[] = [
      { id: 'name', skipped: false, value: 'Álvaro' },
      { id: 'goal', skipped: false, value: 'strength' },
      { id: 'experience', skipped: false, value: 'advanced' },
      { id: 'days', skipped: false, value: 4 },
      { id: 'equipment', skipped: false, value: ['dumbbells', 'barbell_plates'] },
      { id: 'prompt', skipped: true, value: null },
    ];
    const draft = applyPage(EMPTY_DRAFT, filled);
    expect(draft.name).toBe('Álvaro');
    expect(draft.goal).toBe('strength');
    expect(draft.experience).toBe('advanced');
    expect(draft.daysPerWeek).toBe(4);
    expect(draft.equipment).toHaveLength(2);
    expect(draft.aiPrompt).toBeNull(); // skipped → default owns it
  });
});
