import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_EVENTS, getTrackedEventsByName, resetAnalytics } from '../analytics';
import { applyKaiAction, markKaiStepViewed, type KaiActionDeps } from './applyAction';
import type { KaiNextAction, KaiNextStep } from './nextStep';

function makeDeps() {
  const startWorkout = vi.fn<KaiActionDeps['startWorkout']>();
  const assignOnce = vi.fn<KaiActionDeps['assignOnce']>(() => 'assignment_1');
  const setExerciseGoal = vi.fn<KaiActionDeps['setExerciseGoal']>();
  const addBlock = vi.fn<KaiActionDeps['addBlock']>(() => 'new_block');
  const deps: KaiActionDeps = {
    startWorkout,
    assignOnce,
    setExerciseGoal,
    addBlock,
    today: () => '2026-07-08',
    tomorrow: () => '2026-07-09',
  };
  return { deps, startWorkout, assignOnce, setExerciseGoal, addBlock };
}

describe('applyKaiAction', () => {
  let deps: KaiActionDeps;
  let startWorkout: ReturnType<typeof makeDeps>['startWorkout'];
  let assignOnce: ReturnType<typeof makeDeps>['assignOnce'];
  let setExerciseGoal: ReturnType<typeof makeDeps>['setExerciseGoal'];
  let addBlock: ReturnType<typeof makeDeps>['addBlock'];
  beforeEach(() => {
    resetAnalytics();
    ({ deps, startWorkout, assignOnce, setExerciseGoal, addBlock } = makeDeps());
  });

  it('start_block starts the workout and emits kai_action_applied', () => {
    const action: KaiNextAction = { kind: 'start_block', label: 'Empezar', blockId: 'b1' };
    const res = applyKaiAction(action, deps);
    expect(res).toEqual({ ok: true, blockId: 'b1' });
    expect(startWorkout).toHaveBeenCalledWith('b1', { source: 'today' });
    const applied = getTrackedEventsByName(ANALYTICS_EVENTS.kai_action_applied);
    expect(applied).toHaveLength(1);
    expect(applied[0].props).toEqual({ kind: 'start_block', blockId: 'b1' });
  });

  it('schedule_block assigns tomorrow when no explicit date', () => {
    applyKaiAction({ kind: 'schedule_block', label: 'x', blockId: 'b1' }, deps);
    expect(assignOnce).toHaveBeenCalledWith('2026-07-09', 'b1');
  });

  it('repeat_block assigns tomorrow', () => {
    applyKaiAction({ kind: 'repeat_block', label: 'x', blockId: 'b1' }, deps);
    expect(assignOnce).toHaveBeenCalledWith('2026-07-09', 'b1');
  });

  it('respects an explicit action date over the default', () => {
    applyKaiAction({ kind: 'schedule_block', label: 'x', blockId: 'b1', date: '2026-08-01' }, deps);
    expect(assignOnce).toHaveBeenCalledWith('2026-08-01', 'b1');
  });

  it('bump_weight sets the new goal weight', () => {
    applyKaiAction(
      { kind: 'bump_weight', label: 'x', blockId: 'b1', exerciseId: 'e1', targetWeight: 62.5 },
      deps,
    );
    expect(setExerciseGoal).toHaveBeenCalledWith('b1', 'e1', { goalWeight: 62.5 });
  });

  it('create_block adds a block and returns its id', () => {
    const res = applyKaiAction({ kind: 'create_block', label: 'x' }, deps);
    expect(addBlock).toHaveBeenCalledTimes(1);
    expect(res.blockId).toBe('new_block');
  });

  it('resume_workout and open_block mutate nothing but still emit', () => {
    applyKaiAction({ kind: 'resume_workout', label: 'x' }, deps);
    applyKaiAction({ kind: 'open_block', label: 'x', blockId: 'b1' }, deps);
    expect(startWorkout).not.toHaveBeenCalled();
    expect(assignOnce).not.toHaveBeenCalled();
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.kai_action_applied)).toHaveLength(2);
  });

  it('returns { ok: false } and emits nothing for a malformed action', () => {
    const res = applyKaiAction({ kind: 'bump_weight', label: 'x', blockId: 'b1' }, deps);
    expect(res.ok).toBe(false);
    expect(setExerciseGoal).not.toHaveBeenCalled();
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.kai_action_applied)).toHaveLength(0);
  });
});

describe('markKaiStepViewed', () => {
  beforeEach(() => resetAnalytics());
  it('emits kai_signal_viewed with the step id and action kind', () => {
    const step: KaiNextStep = {
      id: 'bump-weight',
      headline: 'x',
      action: {
        kind: 'bump_weight',
        label: 'x',
        blockId: 'b1',
        exerciseId: 'e1',
        targetWeight: 62.5,
      },
    };
    markKaiStepViewed(step);
    const viewed = getTrackedEventsByName(ANALYTICS_EVENTS.kai_signal_viewed);
    expect(viewed).toHaveLength(1);
    expect(viewed[0].props).toEqual({ id: 'bump-weight', kind: 'bump_weight' });
  });
});
