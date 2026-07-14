// src/features/planner/lib/momentum.ts
// Greeting and one-line momentum phrase shown in the planner header.
// Pure function of state — no network, no time-of-day chat fluff.

import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import { computeWeekStats } from '../../../lib/stats/weekStats';

export function getGreeting(name?: string | null): string {
  const h = new Date().getHours();
  const base =
    h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return name && name.trim() ? `${base}, ${name.trim()}` : base;
}

export interface MomentumInputs {
  history: WorkoutHistoryEntry[];
  streak: number;
  blocksCount: number;
}

export function getMomentumPhrase(i: MomentumInputs, nowMs: number = Date.now()): string {
  if (i.blocksCount === 0) return 'Sin bloques.';

  // Single weekly-window source of truth: the exact rolling-7-day computation
  // HomeHeroStats renders. Reading `sessionsThisWeek` from computeWeekStats
  // guarantees this header sentence can never disagree with the hero figures —
  // the bug was two windows (this used a Mon-reset calendar week, the stats a
  // rolling 7 days), so on a Monday the header read "Semana sin sesiones aún"
  // while the stats read "4 sesiones esta semana".
  const { sessionsThisWeek } = computeWeekStats(i.history, nowMs);

  if (sessionsThisWeek === 0) return 'Semana sin sesiones aún.';
  if (sessionsThisWeek === 1) return '1 sesión esta semana.';
  return `${sessionsThisWeek} sesiones esta semana.`;
}
