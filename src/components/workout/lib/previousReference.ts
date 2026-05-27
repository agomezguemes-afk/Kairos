// Pure resolver for "last performance" per exercise. Searches in this order:
//  1. Most recent completed set of the same exercise in the CURRENT session.
//  2. Most recent COMPLETED ExerciseHistorySummary.performedSets across history,
//     filtered by exercise id, ordered by entry.endedAt desc.
// Returns null if no prior performance exists.

import type { WorkoutHistoryEntry, ActiveWorkout } from '../../../store/workoutStore';

export interface PreviousReference {
  /** Where the reference came from. UI may differentiate styling. */
  source: 'current-session' | 'history';
  /** Last weight performed (kg). */
  weight: number | null;
  /** Last reps performed. */
  reps: number | null;
  /** ISO timestamp (ms) for history items; undefined for current session. */
  performedAt?: number;
  /** Block name for history items (helps disambiguate when same exercise across blocks). */
  blockName?: string;
}

export function findPreviousReference(input: {
  exerciseId: string;
  active: ActiveWorkout | null;
  history: WorkoutHistoryEntry[];
  /** Optional: ignore the just-finished entry (e.g., when showing PR detection for the entry we're computing). */
  excludeEntryId?: string;
}): PreviousReference | null {
  const { exerciseId, active, history, excludeEntryId } = input;

  // 1. Current session — walk backwards through the exercise's sets.
  if (active) {
    const ex = active.exercises.find((e) => e.id === exerciseId);
    if (ex) {
      for (let i = ex.sets.length - 1; i >= 0; i--) {
        const s = ex.sets[i];
        if (!s.completed) continue;
        const w = typeof s.values['weight'] === 'number' ? (s.values['weight'] as number) : null;
        const r = typeof s.values['reps'] === 'number' ? (s.values['reps'] as number) : null;
        if (w == null && r == null) continue;
        return { source: 'current-session', weight: w, reps: r };
      }
    }
  }

  // 2. History — most recent entry with a matching exercise + at least one completed set with data.
  for (const entry of history) {
    if (entry.id === excludeEntryId) continue;
    const exHist = entry.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exHist?.performedSets || exHist.performedSets.length === 0) continue;
    for (let i = exHist.performedSets.length - 1; i >= 0; i--) {
      const ps = exHist.performedSets[i];
      if (!ps.completed) continue;
      if (ps.weight == null && ps.reps == null) continue;
      return {
        source: 'history',
        weight: ps.weight,
        reps: ps.reps,
        performedAt: entry.endedAt,
        blockName: entry.blockName,
      };
    }
  }

  return null;
}

/** "60 kg × 8" / "× 12" / "60 kg" / null. Caller decides where to render. */
export function formatReference(ref: PreviousReference | null): string | null {
  if (!ref) return null;
  const parts: string[] = [];
  if (ref.weight != null) parts.push(`${stripTrailingZero(ref.weight)} kg`);
  if (ref.reps != null) parts.push(`× ${ref.reps}`);
  return parts.length > 0 ? parts.join(' ') : null;
}

function stripTrailingZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
