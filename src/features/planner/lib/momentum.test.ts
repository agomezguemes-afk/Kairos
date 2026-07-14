// Weekly-window unification (Design v2 fix): the planner header sentence and
// HomeHeroStats must never disagree. Both derive their weekly session count
// from computeWeekStats (rolling 7 days). These tests pin that contract and
// reproduce the original contradiction ("Semana sin sesiones aún" vs
// "4 sesiones esta semana") to prove it can no longer happen.

import { describe, it, expect } from 'vitest';
import { getMomentumPhrase } from './momentum';
import { computeWeekStats } from '../../../lib/stats/weekStats';
import type { WorkoutHistoryEntry } from '../../../store/workoutStore';

const DAY = 86_400_000;

// A Monday 09:00 local — the day the bug surfaced: a Mon-reset calendar week
// has 0 sessions, while the rolling 7-day window still holds last week's work.
const MONDAY_9AM = new Date('2026-07-13T09:00:00').getTime();

function session(endedAt: number): WorkoutHistoryEntry {
  return {
    id: `h_${endedAt}`,
    blockId: 'block_1',
    blockName: 'Fuerza',
    startedAt: endedAt - 60 * 60 * 1000,
    endedAt,
    exerciseCount: 4,
    setCount: 12,
    totalVolume: 4200,
    durationSec: 3600,
    exercises: [],
  };
}

describe('getMomentumPhrase — unified weekly window', () => {
  it('says "Sin bloques." before any block exists (window irrelevant)', () => {
    expect(getMomentumPhrase({ history: [], streak: 0, blocksCount: 0 }, MONDAY_9AM)).toBe(
      'Sin bloques.',
    );
  });

  it('reads the SAME count as HomeHeroStats on a Monday (the bug scenario)', () => {
    // Four sessions across the prior week: 2, 3, 4 and 5 days ago. All fall in
    // the rolling 7-day window but NONE in the just-started calendar week.
    const history = [
      session(MONDAY_9AM - 2 * DAY),
      session(MONDAY_9AM - 3 * DAY),
      session(MONDAY_9AM - 4 * DAY),
      session(MONDAY_9AM - 5 * DAY),
    ];
    const inputs = { history, streak: 4, blocksCount: 1 };

    const stats = computeWeekStats(history, MONDAY_9AM);
    expect(stats.sessionsThisWeek).toBe(4);
    // The header now agrees with the hero figure instead of contradicting it.
    expect(getMomentumPhrase(inputs, MONDAY_9AM)).toBe('4 sesiones esta semana.');
  });

  it('singularises "1 sesión" and empties correctly', () => {
    const one = [session(MONDAY_9AM - 2 * DAY)];
    expect(getMomentumPhrase({ history: one, streak: 1, blocksCount: 1 }, MONDAY_9AM)).toBe(
      '1 sesión esta semana.',
    );

    // Blocks exist, but no session inside the 7-day window → the honest empty.
    const stale = [session(MONDAY_9AM - 30 * DAY)];
    expect(getMomentumPhrase({ history: stale, streak: 0, blocksCount: 2 }, MONDAY_9AM)).toBe(
      'Semana sin sesiones aún.',
    );
  });

  it('the phrase count is always exactly computeWeekStats.sessionsThisWeek', () => {
    const history = [
      session(MONDAY_9AM - 1 * DAY),
      session(MONDAY_9AM - 6 * DAY),
      session(MONDAY_9AM - 10 * DAY), // outside the window — must not be counted
    ];
    const stats = computeWeekStats(history, MONDAY_9AM);
    const phrase = getMomentumPhrase({ history, streak: 2, blocksCount: 1 }, MONDAY_9AM);
    expect(phrase).toContain(String(stats.sessionsThisWeek));
    expect(stats.sessionsThisWeek).toBe(2);
  });
});
