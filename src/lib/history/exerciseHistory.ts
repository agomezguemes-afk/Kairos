// Exercise history selectors — pure functions over `workoutHistory`.
//
// Correlation strategy:
//   1. If both sides have a `libraryId`, match on it (canonical exercise).
//   2. Otherwise, fall back to normalized-name match (lowercased, trimmed,
//      diacritics stripped). Strong / Hevy do the same — covers ~95% of
//      user-created exercises without a library entry.
//
// All exports are pure and synchronous. The store hands us a snapshot;
// these helpers never touch zustand directly. Test-friendly.

import type { ExerciseCard } from '../../types/core';
import type {
  WorkoutHistoryEntry,
  ExerciseHistorySummary,
} from '../../store/workoutStore';

// ─────────────────────────────────────────────────────────────────────────────
// Identity

/** Lowercase, trim, strip diacritics. Stable for name-based fallback match. */
export function normalizeExerciseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** True when two exercise references describe the same canonical exercise. */
export function isSameExercise(
  a: { libraryId?: string; name: string },
  b: { libraryId?: string; name: string },
): boolean {
  if (a.libraryId && b.libraryId) return a.libraryId === b.libraryId;
  return normalizeExerciseName(a.name) === normalizeExerciseName(b.name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-exercise history slice

export interface ExerciseSessionPoint {
  /** ms epoch when the parent session ended. */
  at: number;
  /** Date YYYY-MM-DD for display grouping. */
  date: string;
  /** Heaviest completed set in this session, or null if none completed. */
  topWeight: number | null;
  /** Reps achieved at topWeight (best informational pair). */
  topReps: number | null;
  /** Total volume (Σ weight × reps) for this exercise in this session. */
  volume: number;
  /** Number of completed sets. */
  setsCompleted: number;
  /** Estimated 1RM for the top set (Epley). Null when no weighted set. */
  estimatedOneRm: number | null;
}

/**
 * Get the chronological history of a single exercise (oldest → newest).
 * Pass `limit` to cap entries (returns the most recent N, still asc-sorted).
 */
export function getExerciseHistoryFor(
  ex: { libraryId?: string; name: string },
  workoutHistory: WorkoutHistoryEntry[],
  limit?: number,
): ExerciseSessionPoint[] {
  const points: ExerciseSessionPoint[] = [];
  const sorted = [...workoutHistory].sort((a, b) => a.endedAt - b.endedAt);

  for (const entry of sorted) {
    for (const summary of entry.exercises) {
      if (!isSameExercise(ex, summary)) continue;
      points.push(summaryToPoint(summary, entry.endedAt));
    }
  }

  if (limit != null && limit > 0 && points.length > limit) {
    return points.slice(points.length - limit);
  }
  return points;
}

function summaryToPoint(
  summary: ExerciseHistorySummary,
  endedAt: number,
): ExerciseSessionPoint {
  let topWeight: number | null = null;
  let topReps: number | null = null;
  let volume = 0;
  let completed = 0;

  const performed = summary.performedSets ?? [];
  for (const s of performed) {
    if (!s.completed) continue;
    completed += 1;
    const w = s.weight ?? 0;
    const r = s.reps ?? 0;
    volume += w * r;
    if (topWeight == null || w > topWeight) {
      topWeight = s.weight;
      topReps = s.reps;
    }
  }

  // Fallback to summary.maxWeight if we have no performedSets (older entries).
  if (topWeight == null && summary.maxWeight > 0) {
    topWeight = summary.maxWeight;
  }
  if (volume === 0 && summary.totalVolume > 0) {
    volume = summary.totalVolume;
  }
  if (completed === 0 && summary.setsCompleted > 0) {
    completed = summary.setsCompleted;
  }

  return {
    at: endedAt,
    date: new Date(endedAt).toISOString().slice(0, 10),
    topWeight,
    topReps,
    volume,
    setsCompleted: completed,
    estimatedOneRm: estimateOneRepMax(topWeight, topReps),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Computed stats

export interface ExerciseStats {
  /** Most recent session point, or null if no history. */
  last: ExerciseSessionPoint | null;
  /** Session prior to `last`, for delta comparisons. */
  previous: ExerciseSessionPoint | null;
  /** All-time best top set weight. */
  allTimeMaxWeight: number | null;
  /** All-time best estimated 1RM. */
  allTimeMaxOneRm: number | null;
  /** All-time best single-session volume. */
  allTimeMaxVolume: number;
  /** Sparkline series — defaults to last 7 sessions, oldest → newest. */
  sparkline: number[];
  /** Best metric chosen for the sparkline (topWeight when present, else volume). */
  sparklineMetric: 'topWeight' | 'volume' | 'empty';
}

export interface ComputeStatsOpts {
  /** How many recent sessions to include in the sparkline. Default 7. */
  sparklineSize?: number;
}

export function computeExerciseStats(
  history: ExerciseSessionPoint[],
  opts: ComputeStatsOpts = {},
): ExerciseStats {
  const sparklineSize = opts.sparklineSize ?? 7;

  if (history.length === 0) {
    return {
      last: null,
      previous: null,
      allTimeMaxWeight: null,
      allTimeMaxOneRm: null,
      allTimeMaxVolume: 0,
      sparkline: [],
      sparklineMetric: 'empty',
    };
  }

  const last = history[history.length - 1] ?? null;
  const previous = history.length >= 2 ? history[history.length - 2] : null;

  let allTimeMaxWeight: number | null = null;
  let allTimeMaxOneRm: number | null = null;
  let allTimeMaxVolume = 0;
  for (const p of history) {
    if (p.topWeight != null) {
      if (allTimeMaxWeight == null || p.topWeight > allTimeMaxWeight) {
        allTimeMaxWeight = p.topWeight;
      }
    }
    if (p.estimatedOneRm != null) {
      if (allTimeMaxOneRm == null || p.estimatedOneRm > allTimeMaxOneRm) {
        allTimeMaxOneRm = p.estimatedOneRm;
      }
    }
    if (p.volume > allTimeMaxVolume) allTimeMaxVolume = p.volume;
  }

  const tail = history.slice(Math.max(0, history.length - sparklineSize));
  // Pick the metric that has signal: prefer weight if any point has it.
  const hasWeight = tail.some(p => p.topWeight != null);
  const sparklineMetric: ExerciseStats['sparklineMetric'] =
    hasWeight ? 'topWeight' : tail.some(p => p.volume > 0) ? 'volume' : 'empty';

  const sparkline = tail.map(p =>
    sparklineMetric === 'topWeight'
      ? (p.topWeight ?? 0)
      : sparklineMetric === 'volume'
        ? p.volume
        : 0,
  );

  return {
    last,
    previous,
    allTimeMaxWeight,
    allTimeMaxOneRm,
    allTimeMaxVolume,
    sparkline,
    sparklineMetric,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PR detection

/**
 * Epley formula: 1RM ≈ w × (1 + r / 30). Returns null when either side is
 * missing/zero — there's no meaningful 1RM without both weight and reps.
 * Caps reps at 12 because Epley overestimates beyond that.
 */
export function estimateOneRepMax(
  weight: number | null,
  reps: number | null,
): number | null {
  if (weight == null || reps == null) return null;
  if (weight <= 0 || reps <= 0) return null;
  const cappedReps = Math.min(reps, 12);
  return Math.round(weight * (1 + cappedReps / 30) * 10) / 10;
}

export type PrKind = 'weight' | 'oneRm' | 'volume';

export interface PrResult {
  /** True when the candidate beats the best of `history`. */
  isPr: boolean;
  /** Which dimension was beaten (when multiple, returns the strongest signal). */
  kind: PrKind | null;
  /** Delta vs previous best in the same dimension. */
  delta: number;
}

/**
 * Detect whether the candidate session beats prior history.
 *
 * Hierarchy of evidence (strongest first):
 *   • Top-set weight at the same-or-higher reps → 'weight'
 *   • Estimated 1RM (Epley)                       → 'oneRm'
 *   • Session volume                              → 'volume'
 *
 * If the candidate is in `history` (same `at`), it's ignored — callers can
 * pass the full session list pre-completion safely.
 */
export function detectPr(
  candidate: ExerciseSessionPoint,
  history: ExerciseSessionPoint[],
): PrResult {
  const prior = history.filter(p => p.at !== candidate.at);
  if (prior.length === 0) {
    // First time ever doing this exercise — gentle PR if there's any signal.
    if (candidate.topWeight != null && candidate.topWeight > 0) {
      return { isPr: true, kind: 'weight', delta: candidate.topWeight };
    }
    if (candidate.volume > 0) {
      return { isPr: true, kind: 'volume', delta: candidate.volume };
    }
    return { isPr: false, kind: null, delta: 0 };
  }

  // Weight PR — only counts when reps are equal or greater than the previous
  // best at that weight. Comparing 100×1 vs 80×8 as a "weight PR" lies.
  if (candidate.topWeight != null) {
    const sameOrBetter = prior
      .filter(p => p.topWeight != null && (p.topReps ?? 0) <= (candidate.topReps ?? 0));
    const priorMax = sameOrBetter.reduce(
      (acc, p) => Math.max(acc, p.topWeight ?? 0),
      0,
    );
    if (candidate.topWeight > priorMax && priorMax > 0) {
      return { isPr: true, kind: 'weight', delta: candidate.topWeight - priorMax };
    }
  }

  // 1RM PR — Epley estimate broke the prior best.
  if (candidate.estimatedOneRm != null) {
    const priorMaxRm = prior.reduce(
      (acc, p) => Math.max(acc, p.estimatedOneRm ?? 0),
      0,
    );
    if (candidate.estimatedOneRm > priorMaxRm && priorMaxRm > 0) {
      return {
        isPr: true,
        kind: 'oneRm',
        delta: Math.round((candidate.estimatedOneRm - priorMaxRm) * 10) / 10,
      };
    }
  }

  // Volume PR — total work done in a single session.
  const priorMaxVol = prior.reduce((acc, p) => Math.max(acc, p.volume), 0);
  if (candidate.volume > priorMaxVol && priorMaxVol > 0) {
    return { isPr: true, kind: 'volume', delta: candidate.volume - priorMaxVol };
  }

  return { isPr: false, kind: null, delta: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: collapse to "last completed" for ghost-data placeholders

export interface LastCompletedReference {
  weight: number | null;
  reps: number | null;
  /** ms epoch when this set was completed. */
  at: number;
}

/**
 * Find the most recent completed weight/reps pair for an exercise, walking
 * history newest → oldest. Used to populate ghost placeholders in empty sets
 * ("last time: 80 kg × 8") without pulling the full stats blob.
 */
export function getLastCompletedReference(
  ex: ExerciseCard | { libraryId?: string; name: string },
  workoutHistory: WorkoutHistoryEntry[],
): LastCompletedReference | null {
  const sorted = [...workoutHistory].sort((a, b) => b.endedAt - a.endedAt);
  for (const entry of sorted) {
    for (const summary of entry.exercises) {
      if (!isSameExercise(ex, summary)) continue;
      const performed = summary.performedSets ?? [];
      // Walk performed sets newest → oldest (the array is recorded in-order,
      // so the heaviest top set is usually mid-late; we want the LAST one
      // the user actually completed, which is index N-1 of completed sets).
      for (let i = performed.length - 1; i >= 0; i--) {
        const s = performed[i];
        if (!s.completed) continue;
        if (s.weight == null && s.reps == null) continue;
        return { weight: s.weight, reps: s.reps, at: entry.endedAt };
      }
    }
  }
  return null;
}
