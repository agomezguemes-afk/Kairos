import { describe, expect, it } from 'vitest';
import {
  applySmartDefaults,
  DEFAULT_EQUIPMENT,
  DEFAULT_GOAL,
  EMPTY_DRAFT,
  firstValueReady,
  fullProgress,
  isValidGoal,
  makeTtfvTracker,
  MAX_NAME_LEN,
  MAX_TTFV_MS,
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

    const kept = applySmartDefaults({ goal: 'endurance', name: ' Sam ', equipment: ['dumbbells'] });
    expect(kept.goal).toBe('endurance');
    expect(kept.name).toBe('Sam');
    expect(kept.equipment).toEqual(['dumbbells']);
  });

  it('dedupes equipment and drops blanks', () => {
    const out = applySmartDefaults({
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

  it('fullProgress counts goal + name + equipment thirds', () => {
    expect(fullProgress(EMPTY_DRAFT)).toBe(0);
    expect(fullProgress({ goal: 'health', name: null, equipment: [] })).toBeCloseTo(1 / 3);
    const full: OnboardingDraft = { goal: 'health', name: 'Sam', equipment: ['dumbbells'] };
    expect(fullProgress(full)).toBe(1);
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
