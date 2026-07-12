// KAIROS — Progression engine: test fixtures. Not a *.test.ts suite; imported
// by the suites to build history entries and exercises without boilerplate.

import type { FieldDefinition, FieldValue } from '../../types/core';
import type { WorkoutHistoryEntry, ExerciseHistorySummary } from '../../store/workoutStore';

/** Minimal numeric FieldDefinition — only `id` matters to the engine. */
export function field(id: string): FieldDefinition {
  return { id, name: id, type: 'number', unit: null, isBase: true, isPrimary: false, order: 0 };
}

/** A performed set for a history summary. `values` is the modern full map. */
export function pset(
  values: Record<string, FieldValue>,
  opts: { completed?: boolean; rpe?: number } = {},
): NonNullable<ExerciseHistorySummary['performedSets']>[number] {
  const completed = opts.completed ?? true;
  const w = typeof values['weight'] === 'number' ? (values['weight'] as number) : null;
  const r = typeof values['reps'] === 'number' ? (values['reps'] as number) : null;
  return opts.rpe != null
    ? { weight: w, reps: r, completed, rpe: opts.rpe, values }
    : { weight: w, reps: r, completed, values };
}

/** A LEGACY performed set — no `values` map, only weight/reps (pre-M4 shape). */
export function legacyPset(
  weight: number | null,
  reps: number | null,
  opts: { completed?: boolean; rpe?: number } = {},
): NonNullable<ExerciseHistorySummary['performedSets']>[number] {
  const completed = opts.completed ?? true;
  return opts.rpe != null
    ? { weight, reps, completed, rpe: opts.rpe }
    : { weight, reps, completed };
}

export function exSummary(
  name: string,
  performedSets: NonNullable<ExerciseHistorySummary['performedSets']>,
  opts: { libraryId?: string; exerciseId?: string } = {},
): ExerciseHistorySummary {
  return {
    exerciseId: opts.exerciseId ?? `ex_${name}`,
    libraryId: opts.libraryId,
    name,
    maxWeight: 0,
    totalVolume: 0,
    setsCompleted: performedSets.filter((s) => s.completed).length,
    performedSets,
  };
}

let seq = 0;
/** A history entry (one session). `endedAt` defaults to a monotonic clock. */
export function entry(
  exercises: ExerciseHistorySummary[],
  opts: { endedAt?: number; blockName?: string } = {},
): WorkoutHistoryEntry {
  seq += 1;
  const endedAt = opts.endedAt ?? 1_700_000_000_000 + seq * 86_400_000;
  return {
    id: `entry_${seq}`,
    blockId: `block_${seq}`,
    blockName: opts.blockName ?? 'Sesión',
    startedAt: endedAt - 3_600_000,
    endedAt,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((n, e) => n + (e.performedSets?.length ?? 0), 0),
    totalVolume: 0,
    durationSec: 3600,
    exercises,
  };
}
