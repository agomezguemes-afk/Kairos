// src/features/planner/lib/momentum.ts
// Greeting and one-line momentum phrase shown in the planner header.
// Pure function of state — no network, no time-of-day chat fluff.

import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import { todayISO, weekRange } from './dates';

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

export function getMomentumPhrase(i: MomentumInputs): string {
  if (i.blocksCount === 0) return 'Sin bloques.';

  const today = todayISO();
  const { start } = weekRange(today);
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const sessions = i.history.filter((h) => h.startedAt >= startMs).length;

  if (sessions === 0) return 'Semana sin sesiones aún.';
  if (sessions === 1) return '1 sesión esta semana.';
  return `${sessions} sesiones esta semana.`;
}
