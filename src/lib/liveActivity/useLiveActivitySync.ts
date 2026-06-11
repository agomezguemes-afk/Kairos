// Keeps the OS surface (iOS Live Activity / Android ongoing notification)
// mirroring the active workout, and applies widget button actions back onto
// the store. Mount once inside ActiveWorkoutScreen — the activity lives and
// dies with the session, not the screen focus.

import { useEffect, useMemo, useRef } from 'react';

import {
  startWorkoutActivity,
  updateWorkoutActivity,
  endWorkoutActivity,
  addWidgetActionListener,
  isLiveActivitySupported,
  type LiveActivityWorkoutState,
} from '../../../modules/kairos-live-activity';
import { useWorkoutStore } from '../../store/workoutStore';

const WIDGET_EXTEND_SECONDS = 30;

function deriveState(): LiveActivityWorkoutState | null {
  const s = useWorkoutStore.getState();
  const aw = s.activeWorkout;
  if (!aw) return null;
  const exercise = aw.exercises[aw.currentExerciseIndex];
  if (!exercise) return null;
  const set = exercise.sets[aw.currentSetIndex];
  const block = s.blocks.find((b) => b.id === aw.blockId);

  const weight =
    typeof set?.values['weight'] === 'number' ? (set.values['weight'] as number) : null;
  const reps = typeof set?.values['reps'] === 'number' ? (set.values['reps'] as number) : null;

  return {
    blockName: block?.name ?? 'Entrenamiento',
    exerciseName: exercise.name,
    setIndex: Math.min(aw.currentSetIndex + 1, exercise.sets.length),
    setTotal: exercise.sets.length,
    targetWeight: weight ?? exercise.goalWeight ?? null,
    targetReps: reps ?? exercise.goalReps ?? null,
    restEndsAt: aw.restTimer.active ? aw.restTimer.startTime + aw.restTimer.duration * 1000 : null,
  };
}

export function useLiveActivitySync(): void {
  const aw = useWorkoutStore((s) => s.activeWorkout);
  const startedRef = useRef(false);

  // Single signature string so the effect only fires on meaningful changes,
  // not on every draft keystroke re-render.
  const signature = useMemo(() => {
    if (!aw) return null;
    const ex = aw.exercises[aw.currentExerciseIndex];
    return [
      aw.blockId,
      aw.currentExerciseIndex,
      aw.currentSetIndex,
      ex?.sets.length ?? 0,
      aw.restTimer.active ? aw.restTimer.startTime + aw.restTimer.duration * 1000 : 0,
    ].join('|');
  }, [aw]);

  useEffect(() => {
    if (!signature) {
      if (startedRef.current) {
        startedRef.current = false;
        endWorkoutActivity();
      }
      return;
    }
    if (!isLiveActivitySupported()) return;
    const state = deriveState();
    if (!state) return;
    if (!startedRef.current) {
      startedRef.current = true;
      startWorkoutActivity(state);
    } else {
      updateWorkoutActivity(state);
    }
  }, [signature]);

  // End the activity when the session screen unmounts with no active workout
  // left behind (finish/cancel paths set activeWorkout = null first).
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        startedRef.current = false;
        endWorkoutActivity();
      }
    };
  }, []);

  // Widget buttons → store actions. Uses getState() at event time: the
  // listener outlives any particular render.
  useEffect(() => {
    const sub = addWidgetActionListener(({ action }) => {
      const s = useWorkoutStore.getState();
      const current = s.activeWorkout;
      if (!current) return;
      if (action === 'extendRest') {
        s.extendRest(WIDGET_EXTEND_SECONDS);
        return;
      }
      if (action === 'completeSet') {
        const exercise = current.exercises[current.currentExerciseIndex];
        const set = exercise?.sets[current.currentSetIndex];
        if (!exercise || !set || set.completed) return;
        // Complete with whatever values the set already carries (goal
        // prefills / ghost values) — the widget has no keypad by design.
        s.completeSet(exercise.id, set.id, set.values);
      }
    });
    return () => sub.remove();
  }, []);
}
