import { describe, expect, it } from 'vitest';
import { deriveScoreboardState, scoreboardStateKey, type ScoreboardInput } from './machine';

const base: ScoreboardInput = {
  hasActiveWorkout: true,
  allCompleted: false,
  restActive: false,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  hasEnteredCurrentExercise: false,
};

describe('deriveScoreboardState', () => {
  it('is loading with no active workout', () => {
    expect(deriveScoreboardState({ ...base, hasActiveWorkout: false }).kind).toBe('loading');
  });

  it('the first exercise of a session is set-active, never an exercise change', () => {
    expect(deriveScoreboardState(base).kind).toBe('set-active');
  });

  it('a running rest timer yields resting', () => {
    expect(deriveScoreboardState({ ...base, restActive: true }).kind).toBe('resting');
  });

  it('a mid-exercise set (index > 0) is set-active even if unentered', () => {
    expect(
      deriveScoreboardState({ ...base, currentExerciseIndex: 1, currentSetIndex: 2 }).kind,
    ).toBe('set-active');
  });

  it('the first set of an unentered later exercise is an exercise change', () => {
    expect(
      deriveScoreboardState({
        ...base,
        currentExerciseIndex: 1,
        currentSetIndex: 0,
        hasEnteredCurrentExercise: false,
      }).kind,
    ).toBe('exercise-change');
  });

  it('once entered, that exercise drops into set-active', () => {
    expect(
      deriveScoreboardState({
        ...base,
        currentExerciseIndex: 1,
        currentSetIndex: 0,
        hasEnteredCurrentExercise: true,
      }).kind,
    ).toBe('set-active');
  });

  it('finished wins over a trailing rest timer', () => {
    expect(deriveScoreboardState({ ...base, allCompleted: true, restActive: true }).kind).toBe(
      'finished',
    );
  });

  it('finished wins over an unentered exercise change', () => {
    expect(
      deriveScoreboardState({
        ...base,
        allCompleted: true,
        currentExerciseIndex: 2,
        currentSetIndex: 0,
      }).kind,
    ).toBe('finished');
  });

  it('loading takes absolute precedence', () => {
    expect(
      deriveScoreboardState({
        ...base,
        hasActiveWorkout: false,
        allCompleted: true,
        restActive: true,
      }).kind,
    ).toBe('loading');
  });
});

describe('scoreboardStateKey', () => {
  it('changes with set index so each set announces once', () => {
    const a = scoreboardStateKey(
      { kind: 'set-active' },
      { currentExerciseIndex: 0, currentSetIndex: 0 },
    );
    const b = scoreboardStateKey(
      { kind: 'set-active' },
      { currentExerciseIndex: 0, currentSetIndex: 1 },
    );
    expect(a).not.toBe(b);
  });

  it('keys exercise-change by exercise only', () => {
    expect(
      scoreboardStateKey(
        { kind: 'exercise-change' },
        { currentExerciseIndex: 3, currentSetIndex: 0 },
      ),
    ).toBe('exercise-change:3');
  });

  it('collapses finished to a constant', () => {
    expect(
      scoreboardStateKey({ kind: 'finished' }, { currentExerciseIndex: 9, currentSetIndex: 9 }),
    ).toBe('finished');
  });
});
