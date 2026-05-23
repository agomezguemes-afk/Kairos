// Insight engine — detects patterns from workoutHistory without motivational fluff.
// Each insight has an id + label. The ProgressTab renders zero or one per section.

import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';
import { oneRMSeries } from './oneRM';

export type InsightKind = 'plateau' | 'pr-streak' | 'gap' | 'consistent';

export interface Insight {
  kind: InsightKind;
  label: string;
}

const DAY = 24 * 3600 * 1000;

/**
 * Detect plateau on a specific exercise: 3+ consecutive sessions with
 * 1RM stable (within ±1%) and no upward trend.
 */
export function detectPlateau(history: WorkoutHistoryEntry[], exerciseId: string): Insight | null {
  const series = oneRMSeries(history, exerciseId, 6);
  if (series.length < 3) return null;
  const last3 = series.slice(-3);
  const avg = last3.reduce((s, p) => s + p.oneRM, 0) / 3;
  const flat = last3.every((p) => Math.abs(p.oneRM - avg) / avg < 0.01);
  if (flat) return { kind: 'plateau', label: 'Carga estable últimas 3 sesiones' };
  return null;
}

/**
 * Detect PR streak: 2+ sessions in a row each beat the previous's 1RM.
 */
export function detectPRStreak(history: WorkoutHistoryEntry[], exerciseId: string): Insight | null {
  const series = oneRMSeries(history, exerciseId, 6);
  if (series.length < 2) return null;
  let streak = 1;
  for (let i = series.length - 1; i > 0; i--) {
    if (series[i].oneRM > series[i - 1].oneRM + 0.5) streak++;
    else break;
  }
  if (streak >= 2) return { kind: 'pr-streak', label: `${streak} sesiones subiendo carga` };
  return null;
}

/**
 * Detect gap: most recent session was >7 days ago, BUT history has 5+ entries
 * (so it's not just a fresh user with no data).
 */
export function detectGap(history: WorkoutHistoryEntry[], nowMs = Date.now()): Insight | null {
  if (history.length < 5) return null;
  const last = history[0];
  const daysSince = Math.floor((nowMs - last.endedAt) / DAY);
  if (daysSince >= 7) {
    return { kind: 'gap', label: `${daysSince} días desde la última sesión` };
  }
  return null;
}

/** Sessions per week ≥ 3 across 4+ weeks → consistent. */
export function detectConsistent(history: WorkoutHistoryEntry[], nowMs = Date.now()): Insight | null {
  if (history.length < 12) return null;
  const fourWeeksAgo = nowMs - 28 * DAY;
  const recent = history.filter((h) => h.startedAt >= fourWeeksAgo);
  if (recent.length >= 12) {
    return { kind: 'consistent', label: 'Volumen constante últimas 4 semanas' };
  }
  return null;
}
