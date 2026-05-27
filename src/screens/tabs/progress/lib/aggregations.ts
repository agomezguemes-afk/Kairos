// Aggregation engine for the Progress dashboard.
// Pure functions — given workoutHistory, return chart-ready series.

import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';

export interface ExerciseFrequency {
  exerciseId: string;
  name: string;
  sessionCount: number;
  lastPerformedAt: number;
}

/** Top N exercises by session frequency, ordered desc. */
export function topExercisesByFrequency(
  history: WorkoutHistoryEntry[],
  topN = 5,
): ExerciseFrequency[] {
  const map = new Map<string, ExerciseFrequency>();
  for (const entry of history) {
    for (const ex of entry.exercises) {
      const prev = map.get(ex.exerciseId);
      if (prev) {
        prev.sessionCount += 1;
        if (entry.endedAt > prev.lastPerformedAt) prev.lastPerformedAt = entry.endedAt;
      } else {
        map.set(ex.exerciseId, {
          exerciseId: ex.exerciseId,
          name: ex.name,
          sessionCount: 1,
          lastPerformedAt: entry.endedAt,
        });
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.sessionCount - a.sessionCount || b.lastPerformedAt - a.lastPerformedAt)
    .slice(0, topN);
}

export interface MaxWeightPoint {
  date: number; // entry.endedAt ms
  weight: number;
}

/**
 * Max weight per session for one exercise, chronological asc.
 * Prefers performedSets (accurate, per Batch D snapshot); falls back to maxWeight.
 */
export function maxWeightSeries(
  history: WorkoutHistoryEntry[],
  exerciseId: string,
  limit = 12,
): MaxWeightPoint[] {
  const points: MaxWeightPoint[] = [];
  // History is most-recent first per store contract.
  for (const entry of history) {
    const ex = entry.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    let max = 0;
    if (ex.performedSets && ex.performedSets.length > 0) {
      for (const ps of ex.performedSets) {
        if (!ps.completed) continue;
        const w = ps.weight ?? 0;
        if (w > max) max = w;
      }
    } else {
      max = ex.maxWeight;
    }
    if (max > 0) points.push({ date: entry.endedAt, weight: max });
    if (points.length >= limit) break;
  }
  return points.reverse();
}

export interface WeeklyVolumePoint {
  weekStart: number; // Monday 00:00 ms local
  volume: number;
  sessions: number;
}

/** Last N weeks of volume, including zeros. Oldest → newest. */
export function weeklyVolumeSeries(
  history: WorkoutHistoryEntry[],
  weeks = 12,
  nowMs = Date.now(),
): WeeklyVolumePoint[] {
  const now = new Date(nowMs);
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
  const startOfThisWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayOfWeek,
    0,
    0,
    0,
    0,
  );
  const series: WeeklyVolumePoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(startOfThisWeek);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    let volume = 0;
    let sessions = 0;
    for (const entry of history) {
      if (entry.startedAt < weekStart.getTime() || entry.startedAt >= weekEnd.getTime()) continue;
      volume += entry.totalVolume;
      sessions += 1;
    }
    series.push({ weekStart: weekStart.getTime(), volume, sessions });
  }
  return series;
}

export interface SummaryStats {
  totalSessions: number;
  totalVolume: number;
  thisWeekSessions: number;
  thisWeekVolume: number;
}

export function computeSummaryStats(
  history: WorkoutHistoryEntry[],
  nowMs = Date.now(),
): SummaryStats {
  let totalVolume = 0;
  for (const e of history) totalVolume += e.totalVolume;
  const weeks = weeklyVolumeSeries(history, 1, nowMs);
  const thisWeek = weeks[0] ?? { volume: 0, sessions: 0 };
  return {
    totalSessions: history.length,
    totalVolume,
    thisWeekSessions: thisWeek.sessions,
    thisWeekVolume: thisWeek.volume,
  };
}
