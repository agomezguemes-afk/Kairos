// src/features/planner/lib/heroMode.ts
// Pure decision: does today's greeting stay full-size or shrink to make room
// for the DayCard's CTA? See STORY-02.

import type { DayCardVariant } from '../hooks/useDayCardState';

export type HeroMode = 'full' | 'compact';

/**
 * The greeting cedes the spotlight to the DayCard only when today has a
 * session to START or CONTINUE. In every other state (empty day, no blocks,
 * future/past — not reachable for today's variant anyway, completed) the
 * greeting stays full-size: there it carries the moment and nothing urgent
 * competes with it.
 */
export function heroMode(todayVariant: DayCardVariant): HeroMode {
  return todayVariant === 'assigned' || todayVariant === 'in-progress' ? 'compact' : 'full';
}
