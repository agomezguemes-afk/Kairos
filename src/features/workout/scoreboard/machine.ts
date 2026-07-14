// Scoreboard state machine — pure derivation of "Modo Sesión" states from a
// snapshot of the active workout. Extracted so the transition rules are
// unit-tested off-thread and the screen stays a thin renderer.
//
// Contract (docs/INWORKOUT_GLANCE_MODE.md §"Estados del marcador"):
//   loading → finished → resting → exercise-change → set-active
// Precedence matters: a finished session wins over a still-running rest timer
// (completing the final set pins the index and starts a rest, but we want the
// summary, not a trailing countdown).

export type ScoreboardStateKind =
  | 'loading'
  | 'set-active'
  | 'resting'
  | 'exercise-change'
  | 'finished';

export interface ScoreboardInput {
  hasActiveWorkout: boolean;
  /** Every set of every exercise is completed. */
  allCompleted: boolean;
  /** Rest timer is currently counting down. */
  restActive: boolean;
  currentExerciseIndex: number;
  currentSetIndex: number;
  /**
   * Has the user explicitly "entered" the current exercise (tapped Empezar on
   * the exercise-change interstitial)? The screen tracks a Set of entered
   * indices; the machine only routes on the boolean for the current index.
   */
  hasEnteredCurrentExercise: boolean;
}

export interface ScoreboardState {
  kind: ScoreboardStateKind;
}

/**
 * Derive which scoreboard state to render. Pure — no store, no side effects.
 *
 * The exercise-change interstitial only appears on the FIRST set of an
 * exercise that is not the first exercise and that the user hasn't entered yet.
 * The very first exercise of a session (index 0) drops straight into set-active
 * — a session start is not an "exercise change".
 */
export function deriveScoreboardState(input: ScoreboardInput): ScoreboardState {
  if (!input.hasActiveWorkout) return { kind: 'loading' };
  if (input.allCompleted) return { kind: 'finished' };
  if (input.restActive) return { kind: 'resting' };

  const isUnenteredNewExercise =
    input.currentExerciseIndex > 0 &&
    input.currentSetIndex === 0 &&
    !input.hasEnteredCurrentExercise;

  if (isUnenteredNewExercise) return { kind: 'exercise-change' };
  return { kind: 'set-active' };
}

/**
 * Stable key for the current state — used by the screen to fire a single
 * VoiceOver announcement per meaningful transition (not on every re-render).
 */
export function scoreboardStateKey(
  state: ScoreboardState,
  input: Pick<ScoreboardInput, 'currentExerciseIndex' | 'currentSetIndex'>,
): string {
  switch (state.kind) {
    case 'set-active':
      return `set-active:${input.currentExerciseIndex}:${input.currentSetIndex}`;
    case 'resting':
      return `resting:${input.currentExerciseIndex}:${input.currentSetIndex}`;
    case 'exercise-change':
      return `exercise-change:${input.currentExerciseIndex}`;
    case 'finished':
      return 'finished';
    case 'loading':
    default:
      return 'loading';
  }
}
