// src/features/planner/lib/foldSummary.ts
// Teaser for the collapsed HomeFolder handle. Pure, deterministic, no IO —
// same shape as kaiSignal.ts. First matching rule wins.

export interface FoldSummaryInputs {
  /** computeWeekStats(history).sessionsThisWeek */
  sessionsThisWeek: number;
  /** snapshot.signals.daysSinceLastWorkout === null */
  readinessCalibrating: boolean;
  /** snapshot.headline */
  readinessHeadline: string;
}

export interface FoldSummary {
  eyebrow: string;
  summary: string;
}

export function foldSummary(i: FoldSummaryInputs): FoldSummary {
  // 1) The number the user is proud of (Apple Health / Whoop lead with count).
  if (i.sessionsThisWeek > 0) {
    const n = i.sessionsThisWeek;
    return { eyebrow: 'Esta semana', summary: `${n} ${n === 1 ? 'sesión' : 'sesiones'}` };
  }
  // 2) No sessions yet but a readiness reading exists — preview the state.
  if (!i.readinessCalibrating) {
    return { eyebrow: 'Tu estado', summary: i.readinessHeadline };
  }
  // 3) Day 0 — nothing to show off yet.
  return { eyebrow: 'Más', summary: 'Calendario, estado y semana' };
}
