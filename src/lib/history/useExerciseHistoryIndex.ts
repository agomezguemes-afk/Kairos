// useExerciseHistoryIndex — module-cached index of workoutHistory.
//
// N tiles in a block all need the same history view. Building the index
// in each component's useMemo means N rebuilds per render and N Map
// instances that hold the same data. A module-level cache keyed on the
// `workoutHistory` array reference reduces this to a single build per
// history change, shared across the entire render tree.
//
// Safe because zustand guarantees `workoutHistory` reference stability:
// the array identity only changes when the store actually mutates it
// (in finishWorkout / cancelWorkout). Until then, every consumer
// reading `state.workoutHistory` gets the same reference and hits the
// cache.

import { useWorkoutStore } from '../../store/workoutStore';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import { buildExerciseHistoryIndex, type ExerciseHistoryIndex } from './exerciseHistory';

interface Cached {
  source: WorkoutHistoryEntry[];
  index: ExerciseHistoryIndex;
}

let cache: Cached | null = null;

function indexFor(history: WorkoutHistoryEntry[]): ExerciseHistoryIndex {
  if (cache && cache.source === history) return cache.index;
  const index = buildExerciseHistoryIndex(history);
  cache = { source: history, index };
  return index;
}

/** Hook returning the shared index for the current workoutHistory. */
export function useExerciseHistoryIndex(): ExerciseHistoryIndex {
  const history = useWorkoutStore((s) => s.workoutHistory);
  return indexFor(history);
}

/** Test/diagnostic — clears the cached index. Never needed in production. */
export function __resetExerciseHistoryIndexCache(): void {
  cache = null;
}
