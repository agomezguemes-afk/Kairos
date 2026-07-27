// Active workout → Live Activity payload. PURE: no store, no native, no clock
// unless you pass one. This is the whole contract the OS surface renders.
//
// The Live Activity is a THIN CLIENT of the phone scoreboard
// (docs/INWORKOUT_GLANCE_MODE.md §5 "No intrusivo"): the phone lying face-up on
// the bench IS the marker. So the phase comes from the same state machine the
// screen uses (features/workout/scoreboard/machine) and the giant target from
// the same formatter (…/format) — never a second implementation, and never a
// weight×reps-only shortcut that would leave running/mobility blank.

import {
  formatScoreboardTarget,
  type FormattedTarget,
} from '../../features/workout/scoreboard/format';
import { deriveScoreboardState } from '../../features/workout/scoreboard/machine';
import type { ExerciseCard } from '../../types/core';

/** Mirrors the machine's kinds that the OS surface can actually render. */
export type LiveActivityPhase = 'set' | 'rest' | 'change';

export interface LiveActivityPayload {
  /** Block/session name — immutable for the activity's lifetime. */
  blockName: string;
  exerciseName: string;
  /** The giant line: "60 kg × 6", "5 km · 5:30 min/km". Null = no target set. */
  targetLine: string | null;
  /** 1-based. */
  setIndex: number;
  setTotal: number;
  /** Epoch ms. Non-null exactly when phase === 'rest'. */
  restStartedAt: number | null;
  restEndsAt: number | null;
  /** "Siguiente" peek. Null on the last exercise / single-set exercise. */
  nextUp: string | null;
  phase: LiveActivityPhase;
}

/** The slice of ActiveWorkout the OS surface needs, plus the screen's one bit. */
export interface WorkoutSnapshot {
  blockName: string;
  currentExerciseIndex: number;
  currentSetIndex: number;
  exercises: ExerciseCard[];
  restTimer: { active: boolean; startTime: number; duration: number };
  /**
   * Has the user tapped "Empezar" on the exercise-change interstitial? Screen
   * state — passed in so the activity and the screen agree on the phase.
   */
  hasEnteredCurrentExercise: boolean;
}

/**
 * FormattedTarget → the single string the widget renders. Keeps the segment
 * idiom of GiantTarget ("60 kg × 6", "5 km · 5:30 min/km") without asking Swift
 * to re-derive units.
 */
export function formatTargetLine(target: FormattedTarget | null): string | null {
  if (!target) return null;
  const parts = target.segments.map((s) => (s.unit ? `${s.value} ${s.unit}` : s.value));
  if (parts.length === 0) return null;
  return parts.join(` ${target.separator} `);
}

function nextUpLabel(
  phase: LiveActivityPhase,
  snapshot: WorkoutSnapshot,
  exercise: ExerciseCard,
  setIndex: number,
  setTotal: number,
): string | null {
  // During rest the indices ALREADY point at the upcoming work (completeSet
  // advances them), so "siguiente" is the current pointer, not the one after.
  if (phase === 'rest') {
    return setTotal > 1 ? `${exercise.name} · serie ${setIndex}/${setTotal}` : exercise.name;
  }
  return snapshot.exercises[snapshot.currentExerciseIndex + 1]?.name ?? null;
}

/**
 * Build the payload, or null when there is nothing to show — no workout, a
 * corrupt index, or a finished session (the OS surface must disappear and let
 * the in-app summary take over).
 *
 * `now` is injectable so an expired-but-not-yet-cleared rest (the app was
 * backgrounded, so no JS ran to call skipRest) is reported as lifting, not as a
 * rest stuck at 00:00.
 */
export function buildLiveActivityPayload(
  snapshot: WorkoutSnapshot | null,
  now: number = Date.now(),
): LiveActivityPayload | null {
  if (!snapshot) return null;

  const exercise = snapshot.exercises[snapshot.currentExerciseIndex];
  if (!exercise) return null;
  const set = exercise.sets[snapshot.currentSetIndex];
  if (!set) return null;

  const allCompleted = snapshot.exercises.every((ex) => ex.sets.every((s) => s.completed));

  const rest = snapshot.restTimer;
  const restEndsAt = rest.startTime + rest.duration * 1000;
  const restRunning = rest.active && rest.duration > 0 && restEndsAt > now;

  const state = deriveScoreboardState({
    hasActiveWorkout: true,
    allCompleted,
    restActive: restRunning,
    currentExerciseIndex: snapshot.currentExerciseIndex,
    currentSetIndex: snapshot.currentSetIndex,
    hasEnteredCurrentExercise: snapshot.hasEnteredCurrentExercise,
  });

  if (state.kind === 'finished' || state.kind === 'loading') return null;

  const phase: LiveActivityPhase =
    state.kind === 'resting' ? 'rest' : state.kind === 'exercise-change' ? 'change' : 'set';

  const setIndex = snapshot.currentSetIndex + 1;
  const setTotal = exercise.sets.length;

  return {
    blockName: snapshot.blockName,
    exerciseName: exercise.name,
    targetLine: formatTargetLine(formatScoreboardTarget(exercise.fields, set.values)),
    setIndex,
    setTotal,
    restStartedAt: restRunning ? rest.startTime : null,
    restEndsAt: restRunning ? restEndsAt : null,
    nextUp: nextUpLabel(phase, snapshot, exercise, setIndex, setTotal),
    phase,
  };
}
