import { describe, expect, it } from 'vitest';

import { parseGoal } from '../../adaptive/goalParser';
import { GOAL_CASES, GOAL_HOLDOUT, scoreGoal, summarise } from './goalCases';

const rulesOn = (cases: typeof GOAL_CASES) =>
  summarise(cases.map((c) => scoreGoal(c, { ...parseGoal(c.text), source: 'rules' })));

describe('rules goal parser against the Spanish eval set', () => {
  it('keeps what it learned from the tuning set', () => {
    const s = rulesOn(GOAL_CASES);
    expect(s.sport).toBeGreaterThanOrEqual(0.95);
    expect(s.days).toBe(1);
    expect(s.weeks).toBe(1);
  });

  // Not a target: the held-out set measures phrasing nobody planned for,
  // and the rules are never tuned on it. The floor only catches regressions;
  // a model earns its download by beating this number in the AI lab.
  it('held-out baseline does not regress', () => {
    const s = rulesOn(GOAL_HOLDOUT);
    expect(s.sport).toBeGreaterThanOrEqual(0.3);
  });

  it('every case is well formed', () => {
    for (const c of [...GOAL_CASES, ...GOAL_HOLDOUT]) {
      expect(c.text.trim().length).toBeGreaterThan(5);
      expect(c.sport.length).toBeGreaterThan(0);
    }
    const texts = [...GOAL_CASES, ...GOAL_HOLDOUT].map((c) => c.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
