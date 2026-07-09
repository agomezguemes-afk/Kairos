import { describe, expect, it } from 'vitest';

import {
  postWorkoutNextStep,
  todayNextStep,
  type PostWorkoutExercise,
  type PostWorkoutInput,
  type TodayInput,
} from './nextStep';

function ex(overrides: Partial<PostWorkoutExercise> = {}): PostWorkoutExercise {
  return {
    exerciseId: 'e1',
    name: 'Press banca',
    hasWeight: true,
    plannedSetsCount: 4,
    completedSets: 4,
    topWeight: 60,
    weightStep: 2.5,
    ...overrides,
  };
}

const basePost: PostWorkoutInput = {
  blockId: 'b1',
  blockName: 'Fuerza · Día A',
  exercises: [ex()],
  hasUpcomingPlan: false,
};

describe('postWorkoutNextStep — always actionable', () => {
  it('bumps weight when a weighted exercise was fully completed at sub-maximal RPE', () => {
    const step = postWorkoutNextStep(basePost);
    expect(step.action.kind).toBe('bump_weight');
    expect(step.action.blockId).toBe('b1');
    expect(step.action.exerciseId).toBe('e1');
    expect(step.action.targetWeight).toBe(62.5); // 60 + 2.5
    expect(step.action.deltaKg).toBe(2.5);
    expect(step.action.label).toContain('62.5');
  });

  it('does not bump when the top set was near-maximal (RPE ≥ 9)', () => {
    const step = postWorkoutNextStep({ ...basePost, exercises: [ex({ minRpe: 9 })] });
    expect(step.action.kind).not.toBe('bump_weight');
  });

  it('bumps when RPE is low and picks the easiest-feeling exercise', () => {
    const step = postWorkoutNextStep({
      ...basePost,
      exercises: [
        ex({ exerciseId: 'hard', name: 'Sentadilla', minRpe: 8, topWeight: 100 }),
        ex({ exerciseId: 'easy', name: 'Press banca', minRpe: 6, topWeight: 60 }),
      ],
    });
    expect(step.action.kind).toBe('bump_weight');
    expect(step.action.exerciseId).toBe('easy');
  });

  it('recommends repeating the block when sets were left incomplete', () => {
    const step = postWorkoutNextStep({
      ...basePost,
      exercises: [ex({ completedSets: 2, minRpe: 9 })],
    });
    expect(step.action.kind).toBe('repeat_block');
    expect(step.action.blockId).toBe('b1');
  });

  it('recommends scheduling the next session when nothing to bump and no plan', () => {
    const step = postWorkoutNextStep({
      ...basePost,
      exercises: [ex({ hasWeight: false, name: 'Dominadas' })],
      hasUpcomingPlan: false,
    });
    expect(step.action.kind).toBe('schedule_block');
  });

  it('falls back to reviewing the block when work is done and a plan exists', () => {
    const step = postWorkoutNextStep({
      ...basePost,
      exercises: [ex({ hasWeight: false })],
      hasUpcomingPlan: true,
    });
    expect(step.action.kind).toBe('open_block');
  });

  it('handles a missing top weight gracefully (target = step)', () => {
    const step = postWorkoutNextStep({ ...basePost, exercises: [ex({ topWeight: undefined })] });
    expect(step.action.kind).toBe('bump_weight');
    expect(step.action.targetWeight).toBe(2.5);
    expect(step.detail).toBeUndefined();
  });

  it('every branch yields an action (never a null next step)', () => {
    const variants: PostWorkoutInput[] = [
      basePost,
      { ...basePost, exercises: [ex({ completedSets: 1 })] },
      { ...basePost, exercises: [ex({ hasWeight: false })] },
      { ...basePost, exercises: [ex({ hasWeight: false })], hasUpcomingPlan: true },
      { ...basePost, exercises: [] },
    ];
    for (const v of variants) {
      const step = postWorkoutNextStep(v);
      expect(step.action).toBeDefined();
      expect(step.action.kind).toBeTruthy();
    }
  });
});

const baseToday: TodayInput = {
  hasActiveWorkout: false,
  blocksCount: 3,
  plannedBlock: null,
  streak: 0,
  suggestedBlock: { blockId: 's1', blockName: 'Fuerza · Día A' },
};

describe('todayNextStep — always one CTA', () => {
  it('resumes an in-progress session first', () => {
    const step = todayNextStep({ ...baseToday, hasActiveWorkout: true });
    expect(step.action.kind).toBe('resume_workout');
  });

  it('prompts block creation when there are no blocks', () => {
    const step = todayNextStep({ ...baseToday, blocksCount: 0, suggestedBlock: null });
    expect(step.action.kind).toBe('create_block');
  });

  it('starts the planned block when today has a plan', () => {
    const step = todayNextStep({
      ...baseToday,
      plannedBlock: { blockId: 'p1', blockName: 'Carrera híbrida', status: 'planned' },
    });
    expect(step.action.kind).toBe('start_block');
    expect(step.action.blockId).toBe('p1');
    expect(step.headline).toContain('Carrera híbrida');
  });

  it('offers to retake a skipped block', () => {
    const step = todayNextStep({
      ...baseToday,
      plannedBlock: { blockId: 'p1', blockName: 'Fuerza', status: 'skipped' },
    });
    expect(step.action.kind).toBe('start_block');
    expect(step.headline).toContain('Saltaste');
  });

  it('schedules the next session after today is completed, mentioning the streak', () => {
    const step = todayNextStep({
      ...baseToday,
      streak: 5,
      plannedBlock: { blockId: 'p1', blockName: 'Fuerza', status: 'completed' },
    });
    expect(step.action.kind).toBe('schedule_block');
    expect(step.headline).toContain('5 días seguidos');
  });

  it('starts the suggested block when there is no plan today', () => {
    const step = todayNextStep(baseToday);
    expect(step.action.kind).toBe('start_block');
    expect(step.action.blockId).toBe('s1');
  });
});
