// KAIROS — Progression engine: read one exercise's history.
//
// Digests the store's raw WorkoutHistoryEntry[] into an exercise-scoped,
// most-recent-first ExerciseHistory: only completed sets, only numeric values.
// Match tier is libraryId first (stable across renamed cards), then normalized
// name — freshly built blocks carry brand-new exercise ids and often no
// libraryId, so name is the load-bearing key in practice.
//
// Back-compat: entries written before the additive `values` map only carry
// weight/reps; we reconstruct a {weight,reps} numeric map from those so strength
// history keeps working. Endurance history (pace/distance/calories) only exists
// for sessions recorded after the `values` map landed — honest, not faked.

// Type-only: erased at runtime, so this stays a pure leaf (no store instance,
// no AsyncStorage) and is unit-testable in node.
import type { WorkoutHistoryEntry, ExerciseHistorySummary } from '../../store/workoutStore';
import type { FieldValue } from '../../types/core';
import { normalizeExerciseName } from './modality';
import type { ExerciseHistory, ExerciseRef, HistoricalSession, HistoricalSet } from './types';

type PerformedSet = NonNullable<ExerciseHistorySummary['performedSets']>[number];

/** Find the exercise summary in one session entry: libraryId > normalized name. */
function matchSummary(
  entry: WorkoutHistoryEntry,
  libraryId: string | undefined,
  nameNorm: string,
): ExerciseHistorySummary | undefined {
  let byName: ExerciseHistorySummary | undefined;
  for (const e of entry.exercises) {
    if (libraryId && e.libraryId === libraryId) return e;
    if (!byName && normalizeExerciseName(e.name) === nameNorm) byName = e;
  }
  return byName;
}

/** Lift the numeric field map for one performed set, back-compat aware. */
function numericValues(ps: PerformedSet): Record<string, number> {
  const out: Record<string, number> = {};
  const source: Record<string, FieldValue> = ps.values ??
    // Legacy entry: only weight/reps were persisted.
    { weight: ps.weight, reps: ps.reps };
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Read one exercise's completed history from raw session entries.
 * `history` is expected most-recent-first (the store prepends new sessions);
 * the returned sessions preserve that order.
 */
export function readExerciseHistory(
  history: WorkoutHistoryEntry[],
  ref: ExerciseRef,
): ExerciseHistory {
  const nameNorm = normalizeExerciseName(ref.name);
  const sessions: HistoricalSession[] = [];

  for (const entry of history) {
    const summary = matchSummary(entry, ref.libraryId, nameNorm);
    if (!summary?.performedSets) continue;

    const sets: HistoricalSet[] = [];
    for (const ps of summary.performedSets) {
      if (!ps.completed) continue;
      const values = numericValues(ps);
      if (Object.keys(values).length === 0) continue;
      sets.push(ps.rpe != null ? { values, rpe: ps.rpe } : { values });
    }
    if (sets.length === 0) continue;

    sessions.push(
      entry.blockName
        ? { performedAt: entry.endedAt, blockName: entry.blockName, sets }
        : { performedAt: entry.endedAt, sets },
    );
  }

  return { key: nameNorm, libraryId: ref.libraryId, sessions };
}
