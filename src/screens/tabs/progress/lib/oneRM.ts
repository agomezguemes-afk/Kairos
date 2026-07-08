// Estimated 1RM engine. Two well-validated formulas:
//   Epley:   1RM = w * (1 + r/30)
//   Brzycki: 1RM = w * 36 / (37 - r)
// Both degrade past r > 10–12 reps. We CAP at r=12 to avoid noise from
// endurance sets. We report Epley as canonical (more popular in fitness apps)
// and expose Brzycki as a sanity-check tool the UI can ignore.

import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';

export function epley1RM(weight: number, reps: number): number {
  // Reject non-finite inputs (NaN/Infinity) up front — a corrupted or imported
  // value must read as "no estimate" (0), never propagate NaN into PR detection
  // and progress charts.
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return 0; // out of validated range
  return weight * (1 + reps / 30);
}

export function brzycki1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return 0;
  return (weight * 36) / (37 - reps);
}

/** Best estimated 1RM (Epley) across all completed sets in this exercise summary. */
export function sessionBest1RM(
  performedSets: { weight: number | null; reps: number | null; completed: boolean }[] | undefined,
): number {
  if (!performedSets) return 0;
  let best = 0;
  for (const ps of performedSets) {
    if (!ps.completed) continue;
    if (ps.weight == null || ps.reps == null) continue;
    const est = epley1RM(ps.weight, ps.reps);
    if (est > best) best = est;
  }
  return Math.round(best * 10) / 10;
}

export interface OneRMPoint {
  date: number; // entry.endedAt ms
  oneRM: number;
}

/**
 * Per-session estimated 1RM series for one exercise, chronological asc.
 * Skips sessions with no eligible sets (e.g., bodyweight-only / endurance).
 */
export function oneRMSeries(
  history: WorkoutHistoryEntry[],
  exerciseId: string,
  limit = 12,
): OneRMPoint[] {
  const points: OneRMPoint[] = [];
  for (const entry of history) {
    const ex = entry.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const best = sessionBest1RM(ex.performedSets);
    if (best > 0) points.push({ date: entry.endedAt, oneRM: best });
    if (points.length >= limit) break;
  }
  return points.reverse();
}

export interface OneRMSummary {
  current: number;
  peak: number;
  /** % delta vs first point in the window. null when <2 points. */
  trendPct: number | null;
}

export function summarize1RM(series: OneRMPoint[]): OneRMSummary {
  if (series.length === 0) return { current: 0, peak: 0, trendPct: null };
  const peak = series.reduce((m, p) => Math.max(m, p.oneRM), 0);
  const current = series[series.length - 1].oneRM;
  const first = series[0].oneRM;
  const trendPct =
    series.length >= 2 && first > 0 ? Math.round(((current - first) / first) * 1000) / 10 : null;
  return { current: round1(current), peak: round1(peak), trendPct };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
