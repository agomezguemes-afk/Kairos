// src/lib/kai/kaiDeps.ts
//
// Real store wiring for applyKaiAction. Kept apart from applyAction.ts so the
// applier stays store-free and unit-testable; this file is the thin seam that
// binds it to zustand at call time. DEV-U: `applyKaiAction(step.action, getKaiActionDeps())`.

import { useScheduleStore } from '../../store/scheduleStore';
import { useWorkoutStore } from '../../store/workoutStore';
import type { KaiActionDeps } from './applyAction';

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getKaiActionDeps(): KaiActionDeps {
  const w = useWorkoutStore.getState();
  const s = useScheduleStore.getState();
  return {
    startWorkout: (blockId, ctx) => w.startWorkout(blockId, ctx),
    assignOnce: (date, blockId) => s.assignOnce(date, blockId),
    setExerciseGoal: (blockId, exerciseId, goal) => w.setExerciseGoal(blockId, exerciseId, goal),
    addBlock: () => w.addBlock(),
    today: () => isoOffset(0),
    tomorrow: () => isoOffset(1),
  };
}
