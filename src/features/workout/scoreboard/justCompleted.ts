// Resolve "la serie que acabas de hacer" for the rest-state correction echo
// (BRIEF-03). Derived, not stored: the most recent `completed_at` across every
// set of every exercise IS the just-completed set, which survives exercise
// boundaries and needs no new store state or migration.

import type { ExerciseCard, FieldDefinition, FieldValue } from '../../../types/core';

export interface JustCompletedRef {
  exerciseId: string;
  exerciseIndex: number;
  setId: string;
  setIndex: number;
  exerciseName: string;
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
}

/**
 * The just-completed set = the one with the most recent `completed_at` (ISO
 * timestamps compare correctly as strings). Pure. Returns null when no set is
 * completed — e.g. before the first HECHO, where there'd be no rest anyway.
 * Ties resolve to the first set encountered in traversal order (deterministic).
 */
export function resolveJustCompleted(exercises: ExerciseCard[]): JustCompletedRef | null {
  let best: JustCompletedRef | null = null;
  let bestAt: string | null = null;

  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const ex = exercises[exIdx];
    for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
      const s = ex.sets[setIdx];
      if (!s.completed || !s.completed_at) continue;
      // Strictly greater → on a timestamp tie the first one traversed wins.
      if (bestAt !== null && s.completed_at <= bestAt) continue;
      bestAt = s.completed_at;
      best = {
        exerciseId: ex.id,
        exerciseIndex: exIdx,
        setId: s.id,
        setIndex: setIdx,
        exerciseName: ex.name,
        fields: ex.fields,
        values: s.values,
      };
    }
  }

  return best;
}
