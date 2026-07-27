import { describe, it, expect, beforeEach } from 'vitest';

import { useWorkoutStore, type ActiveWorkout } from '../../store/workoutStore';
import { createExerciseCard } from '../../types/core';

import {
  applyWidgetAction,
  isStaleWidgetAction,
  MAX_WIDGET_ACTION_AGE_MS,
  WIDGET_EXTEND_SECONDS,
} from './widgetActions';

// AsyncStorage's web fallback assumes `window` (same stub the store suites use);
// zustand/persist flushes writes asynchronously after each mutation.
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

const NOW = 1_700_000_000_000;

function activeWorkout(over: Partial<ActiveWorkout> = {}): ActiveWorkout {
  const press = createExerciseCard('b1', 0, 'strength', { name: 'Press banca' });
  press.sets = press.sets.slice(0, 3).map((s) => ({
    ...s,
    values: { ...s.values, weight: 60, reps: 6 },
  }));
  press.rest_seconds = 90;
  return {
    blockId: 'b1',
    startTime: NOW,
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    restTimer: { duration: 0, startTime: 0, active: false },
    exercises: [press],
    ...over,
  };
}

beforeEach(() => {
  useWorkoutStore.setState({ activeWorkout: null });
});

describe('isStaleWidgetAction', () => {
  it('accepts a tap with no timestamp (Android broadcast — always live)', () => {
    expect(isStaleWidgetAction(undefined, NOW)).toBe(false);
  });

  it('accepts a fresh tap and rejects one older than the window', () => {
    expect(isStaleWidgetAction(NOW - 5_000, NOW)).toBe(false);
    expect(isStaleWidgetAction(NOW - MAX_WIDGET_ACTION_AGE_MS - 1, NOW)).toBe(true);
  });
});

describe('applyWidgetAction', () => {
  it('does nothing when the session is already over', () => {
    expect(applyWidgetAction('completeSet', NOW, NOW)).toBe('no-workout');
  });

  it('never logs a set from a tap that arrived too late to trust', () => {
    useWorkoutStore.setState({ activeWorkout: activeWorkout() });
    const outcome = applyWidgetAction('completeSet', NOW - MAX_WIDGET_ACTION_AGE_MS - 1, NOW);
    expect(outcome).toBe('stale');
    expect(useWorkoutStore.getState().activeWorkout?.exercises[0].sets[0].completed).toBe(false);
  });

  it('HECHO logs the current set with the values the widget was showing', () => {
    useWorkoutStore.setState({ activeWorkout: activeWorkout() });

    expect(applyWidgetAction('completeSet', NOW, NOW)).toBe('applied');

    const aw = useWorkoutStore.getState().activeWorkout!;
    const set = aw.exercises[0].sets[0];
    expect(set.completed).toBe(true);
    expect(set.values).toMatchObject({ weight: 60, reps: 6 });
    // …and advances the scoreboard + starts the rest, exactly as the phone does.
    expect(aw.currentSetIndex).toBe(1);
    expect(aw.restTimer.active).toBe(true);
    expect(aw.restTimer.duration).toBe(90);
  });

  it('ignores a double tap on a set already logged', () => {
    const aw = activeWorkout();
    aw.exercises[0].sets[0] = { ...aw.exercises[0].sets[0], completed: true };
    useWorkoutStore.setState({ activeWorkout: aw });

    expect(applyWidgetAction('completeSet', NOW, NOW)).toBe('already-completed');
    expect(useWorkoutStore.getState().activeWorkout?.restTimer.active).toBe(false);
  });

  it('+30 s extends a running rest', () => {
    useWorkoutStore.setState({
      activeWorkout: activeWorkout({
        restTimer: { duration: 90, startTime: NOW, active: true },
      }),
    });

    expect(applyWidgetAction('extendRest', NOW, NOW)).toBe('applied');
    expect(useWorkoutStore.getState().activeWorkout?.restTimer.duration).toBe(
      90 + WIDGET_EXTEND_SECONDS,
    );
  });

  it('skip ends the rest', () => {
    useWorkoutStore.setState({
      activeWorkout: activeWorkout({
        restTimer: { duration: 90, startTime: NOW, active: true },
      }),
    });

    expect(applyWidgetAction('skipRest', NOW, NOW)).toBe('applied');
    expect(useWorkoutStore.getState().activeWorkout?.restTimer.active).toBe(false);
  });

  it('rest controls are inert when no rest is running', () => {
    useWorkoutStore.setState({ activeWorkout: activeWorkout() });
    expect(applyWidgetAction('extendRest', NOW, NOW)).toBe('not-resting');
    expect(applyWidgetAction('skipRest', NOW, NOW)).toBe('not-resting');
  });
});
