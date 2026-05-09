// src/features/planner/lib/momentum.ts
// Greeting and one-line momentum phrase shown in the planner header.
// Pure function of state — no network, no time-of-day chat fluff.

import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import { todayISO, weekRange } from './dates';

export function getGreeting(name?: string | null): string {
  const h = new Date().getHours();
  const base =
    h < 6  ? 'Buenas noches' :
    h < 13 ? 'Buenos días'   :
    h < 20 ? 'Buenas tardes' :
             'Buenas noches';
  return name && name.trim() ? `${base}, ${name.trim()}` : base;
}

export interface MomentumInputs {
  history: WorkoutHistoryEntry[];
  streak: number;
  blocksCount: number;
}

export function getMomentumPhrase(i: MomentumInputs): string {
  if (i.blocksCount === 0) return 'Empieza creando tu primer bloque.';

  const today = todayISO();
  const { start } = weekRange(today);
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const sessionsThisWeek = i.history.filter((h) => h.startedAt >= startMs).length;

  if (sessionsThisWeek === 0 && i.streak === 0) return 'Empieza la semana con una sesión clara.';
  if (sessionsThisWeek === 0 && i.streak > 0) return `Racha de ${i.streak} días. No la rompas.`;
  if (sessionsThisWeek === 1) return 'Una sesión esta semana. Buen arranque.';
  if (sessionsThisWeek <= 3) return `${sessionsThisWeek} sesiones esta semana.`;
  return `${sessionsThisWeek} sesiones esta semana. Ritmo sólido.`;
}
