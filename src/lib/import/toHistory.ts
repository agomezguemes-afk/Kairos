// IR → WorkoutHistoryEntry. Pure: the store-side merge (dedupe + sort) lives
// in workoutStore.importWorkoutHistory so this stays unit-testable.

import { generateId } from '../../types/core';
import type { WorkoutHistoryEntry, ExerciseHistorySummary } from '../../store/workoutStore';
import type { ImportedWorkout } from './types';

export const IMPORTED_BLOCK_ID = 'imported';

export function toHistoryEntries(workouts: ImportedWorkout[]): WorkoutHistoryEntry[] {
  return workouts.map((w) => {
    let totalSets = 0;
    let totalVolume = 0;
    const exercises: ExerciseHistorySummary[] = w.exercises.map((ex) => {
      let maxW = 0;
      let exVol = 0;
      const performedSets: NonNullable<ExerciseHistorySummary['performedSets']> = ex.sets.map(
        (s) => {
          totalSets += 1;
          const w0 = s.weight ?? 0;
          const r0 = s.reps ?? 0;
          if (w0 > maxW) maxW = w0;
          exVol += w0 * r0;
          return {
            weight: s.weight,
            reps: s.reps,
            completed: true, // exports only contain performed sets
            ...(s.isWarmup ? { kind: 'warmup' as const } : {}),
            ...(s.rpe != null ? { rpe: s.rpe } : {}),
          };
        },
      );
      totalVolume += exVol;
      return {
        // Synthetic id namespaced by normalized name so the SAME movement
        // across imported sessions correlates (ghost values, PRs, charts).
        exerciseId: `import_${ex.name.trim().toLowerCase().replace(/\s+/g, '_')}`,
        name: ex.name,
        maxWeight: maxW,
        totalVolume: exVol,
        setsCompleted: performedSets.length,
        performedSets,
      };
    });

    const endedAt = w.endedAt ?? w.startedAt;
    return {
      id: generateId(),
      blockId: IMPORTED_BLOCK_ID,
      blockName: w.name,
      source: 'history' as const,
      startedAt: w.startedAt,
      endedAt,
      exerciseCount: exercises.length,
      setCount: totalSets,
      totalVolume,
      durationSec: Math.max(0, Math.round((endedAt - w.startedAt) / 1000)),
      exercises,
    };
  });
}
