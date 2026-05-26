// weekStats — pure computation of this-week vs last-week summaries
// from workoutHistory. Used by HomeTab's hero stats and by progress
// surfaces. nowMs is injected so callers can test deterministically.

import type { WorkoutHistoryEntry } from '../../store/workoutStore';

const MS_PER_DAY = 86400_000;

export interface WeekSummary {
  /** Sessions completed in the current rolling 7-day window. */
  sessionsThisWeek: number;
  /** Sessions in the prior 7-day window. */
  sessionsLastWeek: number;
  /** Σ totalVolume across this-week sessions (kg). */
  volumeThisWeek: number;
  /** Σ totalVolume across last-week sessions (kg). */
  volumeLastWeek: number;
  /** sessionsThisWeek - sessionsLastWeek. */
  sessionsDelta: number;
  /** volumeThisWeek - volumeLastWeek. */
  volumeDelta: number;
  /** Total minutes trained this week. */
  minutesThisWeek: number;
}

/**
 * Bucket `workoutHistory` into two 7-day windows ending at `nowMs`.
 * "This week" = [nowMs − 7d, nowMs]; "last week" = [nowMs − 14d, nowMs − 7d).
 *
 * Rolling windows, not calendar weeks — matches Apple Health / Fitness
 * which show "last 7 days" rather than reset on Monday.
 */
export function computeWeekStats(
  history: WorkoutHistoryEntry[],
  nowMs: number = Date.now(),
): WeekSummary {
  const thisStart = nowMs - 7 * MS_PER_DAY;
  const lastStart = nowMs - 14 * MS_PER_DAY;

  let sessionsThisWeek = 0;
  let sessionsLastWeek = 0;
  let volumeThisWeek = 0;
  let volumeLastWeek = 0;
  let minutesThisWeek = 0;

  for (const entry of history) {
    const at = entry.endedAt;
    if (at >= thisStart && at <= nowMs) {
      sessionsThisWeek += 1;
      volumeThisWeek += entry.totalVolume;
      minutesThisWeek += Math.round(entry.durationSec / 60);
    } else if (at >= lastStart && at < thisStart) {
      sessionsLastWeek += 1;
      volumeLastWeek += entry.totalVolume;
    }
  }

  return {
    sessionsThisWeek,
    sessionsLastWeek,
    volumeThisWeek,
    volumeLastWeek,
    sessionsDelta: sessionsThisWeek - sessionsLastWeek,
    volumeDelta: volumeThisWeek - volumeLastWeek,
    minutesThisWeek,
  };
}

/** Compact formatter: 12340 → "12.3k", 940 → "940". */
export function formatVolume(kg: number): string {
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (kg >= 1000)   return `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return Math.round(kg).toString();
}
