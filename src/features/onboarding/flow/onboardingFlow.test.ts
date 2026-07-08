import { describe, expect, it } from 'vitest';
import {
  applySmartDefaults,
  clampDaysPerWeek,
  DEFAULT_DAYS_PER_WEEK,
  DEFAULT_EQUIPMENT,
  DEFAULT_EXPERIENCE,
  DEFAULT_GOAL,
  EMPTY_DRAFT,
  firstValueReady,
  fullProgress,
  isValidExperience,
  isValidGoal,
  makeTtfvTracker,
  MAX_AI_PROMPT_LEN,
  MAX_DAYS_PER_WEEK,
  MAX_NAME_LEN,
  MAX_TTFV_MS,
  MIN_DAYS_PER_WEEK,
  normalizeAiPrompt,
  normalizeName,
  requiredProgress,
  skipToValue,
  TARGET_TTFV_MS,
  type OnboardingDraft,
} from './onboardingFlow';

describe('isValidGoal', () => {
  it('accepts the four known goals and rejects everything else', () => {
    expect(isValidGoal('strength')).toBe(true);
    expect(isValidGoal('health')).toBe(true);
    expect(isValidGoal('bogus')).toBe(false);
    expect(isValidGoal(null)).toBe(false);
    expect(isValidGoal(42)).toBe(false);
  });
});

describe('normalizeName', () => {
  it('trims, collapses whitespace, and caps length', () => {
    expect(normalizeName('  Álvaro  ')).toBe('Álvaro');
    expect(normalizeName('John   Doe')).toBe('John Doe');
    expect(normalizeName('a'.repeat(50))).toHaveLength(MAX_NAME_LEN);
  });

  it('returns null for empty / whitespace / non-string', () => {
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('')).toBeNull();
    expect(normalizeName(null)).toBeNull();
    expect(normalizeName(undefined)).toBeNull();
  });
});

describe('firstValueReady', () => {
  it('is false with no goal, true once a valid goal is set', () => {
    expect(firstValueReady(EMPTY_DRAFT)).toBe(false);
    expect(firstValueReady({ ...EMPTY_DRAFT, goal: 'strength' })).toBe(true);
  });
});

describe('applySmartDefaults', () => {
  it('fills goal and equipment with defaults, keeps a valid goal', () => {
    const out = applySmartDefaults(EMPTY_DRAFT);
    expect(out.goal).toBe(DEFAULT_GOAL);
    expect(out.equipment).toEqual([DEFAULT_EQUIPMENT]);
    expect(out.name).toBeNull();

    const kept = applySmartDefaults({
      ...EMPTY_DRAFT,
      goal: 'endurance',
      name: ' Sam ',
      equipment: ['dumbbells'],
    });
    expect(kept.goal).toBe('endurance');
    expect(kept.name).toBe('Sam');
    expect(kept.equipment).toEqual(['dumbbells']);
  });

  it('defaults the deeper profile fields, keeps valid ones', () => {
    const out = applySmartDefaults(EMPTY_DRAFT);
    expect(out.experience).toBe(DEFAULT_EXPERIENCE);
    expect(out.daysPerWeek).toBe(DEFAULT_DAYS_PER_WEEK);
    expect(out.aiPrompt).toBeNull();

    const kept = applySmartDefaults({
      ...EMPTY_DRAFT,
      goal: 'strength',
      experience: 'advanced',
      daysPerWeek: 5,
      aiPrompt: '  Quiero ganar fuerza  ',
    });
    expect(kept.experience).toBe('advanced');
    expect(kept.daysPerWeek).toBe(5);
    expect(kept.aiPrompt).toBe('Quiero ganar fuerza');
  });

  it('dedupes equipment and drops blanks', () => {
    const out = applySmartDefaults({
      ...EMPTY_DRAFT,
      goal: 'health',
      name: null,
      equipment: ['dumbbells', 'dumbbells', '', 'barbell_plates'],
    });
    expect(out.equipment).toEqual(['dumbbells', 'barbell_plates']);
  });
});

describe('skipToValue', () => {
  it('always yields a first-value-ready draft, even from empty', () => {
    expect(firstValueReady(skipToValue())).toBe(true);
    expect(firstValueReady(skipToValue(EMPTY_DRAFT))).toBe(true);
  });
});

describe('progress', () => {
  it('requiredProgress is binary on the goal', () => {
    expect(requiredProgress(EMPTY_DRAFT)).toBe(0);
    expect(requiredProgress({ ...EMPTY_DRAFT, goal: 'health' })).toBe(1);
  });

  it('fullProgress counts all six profile dimensions', () => {
    expect(fullProgress(EMPTY_DRAFT)).toBe(0);
    expect(fullProgress({ ...EMPTY_DRAFT, goal: 'health' })).toBeCloseTo(1 / 6);
    const full: OnboardingDraft = {
      goal: 'health',
      name: 'Sam',
      equipment: ['dumbbells'],
      experience: 'intermediate',
      daysPerWeek: 4,
      aiPrompt: 'Correr un 10k',
    };
    expect(fullProgress(full)).toBe(1);
  });
});

describe('isValidExperience', () => {
  it('accepts the three levels, rejects the rest', () => {
    expect(isValidExperience('beginner')).toBe(true);
    expect(isValidExperience('advanced')).toBe(true);
    expect(isValidExperience('pro')).toBe(false);
    expect(isValidExperience(null)).toBe(false);
    expect(isValidExperience(3)).toBe(false);
  });
});

describe('clampDaysPerWeek', () => {
  it('rounds and clamps into [1, 7]', () => {
    expect(clampDaysPerWeek(0)).toBe(MIN_DAYS_PER_WEEK);
    expect(clampDaysPerWeek(99)).toBe(MAX_DAYS_PER_WEEK);
    expect(clampDaysPerWeek(3.4)).toBe(3);
    expect(clampDaysPerWeek(4.6)).toBe(5);
  });

  it('returns null for non-finite / non-number', () => {
    expect(clampDaysPerWeek(NaN)).toBeNull();
    expect(clampDaysPerWeek(Infinity)).toBeNull();
    expect(clampDaysPerWeek('3')).toBeNull();
    expect(clampDaysPerWeek(null)).toBeNull();
  });
});

describe('normalizeAiPrompt', () => {
  it('trims, collapses whitespace, and caps at MAX_AI_PROMPT_LEN', () => {
    expect(normalizeAiPrompt('  hola   Kai  ')).toBe('hola Kai');
    expect(normalizeAiPrompt('x'.repeat(MAX_AI_PROMPT_LEN + 200))).toHaveLength(MAX_AI_PROMPT_LEN);
  });

  it('returns null for empty / non-string', () => {
    expect(normalizeAiPrompt('   ')).toBeNull();
    expect(normalizeAiPrompt('')).toBeNull();
    expect(normalizeAiPrompt(null)).toBeNull();
    expect(normalizeAiPrompt(undefined)).toBeNull();
  });
});

describe('makeTtfvTracker', () => {
  it('flags samples within the 30s target', () => {
    const t = makeTtfvTracker(1_000);
    const s = t.reached(1_000 + 12_000);
    expect(s.elapsedMs).toBe(12_000);
    expect(s.withinTarget).toBe(true);
    expect(s.withinMax).toBe(true);
  });

  it('is over target but within the 2-minute promise', () => {
    const t = makeTtfvTracker(0);
    const s = t.reached(TARGET_TTFV_MS + 1);
    expect(s.withinTarget).toBe(false);
    expect(s.withinMax).toBe(true);
  });

  it('flags a blown 2-minute budget', () => {
    const t = makeTtfvTracker(0);
    const s = t.reached(MAX_TTFV_MS + 1);
    expect(s.withinMax).toBe(false);
  });

  it('never reports negative elapsed time if the clock goes backwards', () => {
    const t = makeTtfvTracker(10_000);
    expect(t.reached(9_000).elapsedMs).toBe(0);
  });
});
