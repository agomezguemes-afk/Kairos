// Widget button → store. The ONE place a lock-screen tap becomes state.
//
// Mandate (docs/INWORKOUT_GLANCE_MODE.md §5): the user advances the session
// without unlocking. So this must be correct with the app suspended, and it
// must never apply a tap that arrived from a previous era (an intent can
// relaunch a killed app; the tap then lands minutes late, after hydration).

import type { WidgetAction } from '../../../modules/kairos-live-activity';
import { useWorkoutStore } from '../../store/workoutStore';

export const WIDGET_EXTEND_SECONDS = 30;

/**
 * A tap older than this is discarded rather than applied. Rationale: iOS can
 * relaunch the app to run a LiveActivityIntent, but if that relaunch (or the
 * store hydration behind it) is delayed — or the user simply reopens the app
 * much later — silently completing a set the user pressed long ago would
 * corrupt the log. Two minutes covers any plausible relaunch + hydration.
 */
export const MAX_WIDGET_ACTION_AGE_MS = 120_000;

export type WidgetActionOutcome =
  | 'applied'
  | 'stale' // arrived too late to trust
  | 'no-workout' // session already finished/cancelled
  | 'not-resting' // rest controls tapped after the rest ended
  | 'already-completed'; // duplicate tap on the same set

export function isStaleWidgetAction(ts: number | undefined, now: number = Date.now()): boolean {
  if (ts == null) return false; // Android: broadcast only lands in a live process
  return now - ts > MAX_WIDGET_ACTION_AGE_MS;
}

/**
 * Apply a widget action to the active workout. Returns why it did nothing when
 * it does nothing — callers log it; nothing here throws across the native
 * boundary.
 *
 * HECHO from the widget commits the set's PRE-FILLED values (the progression
 * suggestion the widget itself was showing) — never a draft the user typed on
 * the phone and never confirmed. What the scoreboard shows is what gets logged.
 */
export function applyWidgetAction(
  action: WidgetAction,
  ts?: number,
  now: number = Date.now(),
): WidgetActionOutcome {
  if (isStaleWidgetAction(ts, now)) return 'stale';

  const store = useWorkoutStore.getState();
  const aw = store.activeWorkout;
  if (!aw) return 'no-workout';

  switch (action) {
    case 'extendRest': {
      if (!aw.restTimer.active) return 'not-resting';
      store.extendRest(WIDGET_EXTEND_SECONDS);
      return 'applied';
    }
    case 'skipRest': {
      if (!aw.restTimer.active) return 'not-resting';
      store.skipRest();
      return 'applied';
    }
    case 'completeSet': {
      const exercise = aw.exercises[aw.currentExerciseIndex];
      const set = exercise?.sets[aw.currentSetIndex];
      if (!exercise || !set) return 'no-workout';
      // Double-tap guard: the widget has no keypad, so a repeat tap on an
      // already-logged set is always a mistake, never an intent to re-log.
      if (set.completed) return 'already-completed';
      // completeSet() overwrites restTimer wholesale, so an expired-but-active
      // rest left behind by a backgrounded session is cleared by construction.
      store.completeSet(exercise.id, set.id, set.values);
      return 'applied';
    }
  }
}
