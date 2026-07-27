import { describe, expect, it } from 'vitest';
import { resolveJustCompleted } from './justCompleted';
import type { ExerciseCard, ExerciseSet, FieldDefinition, FieldValues } from '../../../types/core';

function field(id: string, name: string, unit: string | null, order: number): FieldDefinition {
  return { id, name, type: 'number', unit, isBase: true, isPrimary: order === 0, order };
}

const strengthFields: FieldDefinition[] = [
  field('weight', 'Weight', 'kg', 0),
  field('reps', 'Reps', null, 1),
];

function makeSet(
  id: string,
  opts: { completed?: boolean; completed_at?: string | null; values?: FieldValues } = {},
): ExerciseSet {
  return {
    id,
    exercise_card_id: 'ex',
    order: 0,
    values: opts.values ?? {},
    completed: opts.completed ?? false,
    completed_at: opts.completed_at ?? null,
    notes: null,
  };
}

function makeExercise(id: string, name: string, sets: ExerciseSet[]): ExerciseCard {
  const now = '2026-07-19T00:00:00.000Z';
  return {
    id,
    workout_block_id: 'block',
    order: 0,
    name,
    icon: 'dumbbell',
    color: '#000000',
    notes: null,
    discipline: 'strength',
    fields: strengthFields,
    sets,
    default_sets_count: sets.length,
    rest_seconds: 90,
    created_at: now,
    updated_at: now,
  };
}

describe('resolveJustCompleted', () => {
  it('returns null for an empty exercise list', () => {
    expect(resolveJustCompleted([])).toBeNull();
  });

  it('returns null when no set is completed', () => {
    const ex = makeExercise('e1', 'Press banca', [makeSet('s1'), makeSet('s2')]);
    expect(resolveJustCompleted([ex])).toBeNull();
  });

  it('returns the ref of the single completed set', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', {
        completed: true,
        completed_at: '2026-07-19T10:00:00.000Z',
        values: { weight: 60, reps: 8 },
      }),
      makeSet('s2'),
    ]);
    const ref = resolveJustCompleted([ex]);
    expect(ref).toEqual({
      exerciseId: 'e1',
      exerciseIndex: 0,
      setId: 's1',
      setIndex: 0,
      exerciseName: 'Press banca',
      fields: strengthFields,
      values: { weight: 60, reps: 8 },
    });
  });

  it('picks the later completed_at within the same exercise', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, completed_at: '2026-07-19T10:00:00.000Z' }),
      makeSet('s2', { completed: true, completed_at: '2026-07-19T10:03:00.000Z' }),
    ]);
    const ref = resolveJustCompleted([ex]);
    expect(ref?.setId).toBe('s2');
    expect(ref?.setIndex).toBe(1);
  });

  it('picks the globally most recent completed_at across exercises', () => {
    const ex1 = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, completed_at: '2026-07-19T10:00:00.000Z' }),
    ]);
    const ex2 = makeExercise('e2', 'Sentadilla', [
      makeSet('s2', { completed: true, completed_at: '2026-07-19T10:05:00.000Z' }),
    ]);
    const ref = resolveJustCompleted([ex1, ex2]);
    expect(ref?.exerciseId).toBe('e2');
    expect(ref?.exerciseIndex).toBe(1);
    expect(ref?.setId).toBe('s2');
    expect(ref?.exerciseName).toBe('Sentadilla');
  });

  it('ignores a completed set without completed_at when another has one', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, completed_at: null }),
      makeSet('s2', { completed: true, completed_at: '2026-07-19T10:00:00.000Z' }),
    ]);
    expect(resolveJustCompleted([ex])?.setId).toBe('s2');
  });

  it('returns null when the only completed set lacks completed_at', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, completed_at: null }),
    ]);
    expect(resolveJustCompleted([ex])).toBeNull();
  });

  it('returns the values untouched', () => {
    const values: FieldValues = { weight: 60, reps: 8 };
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, completed_at: '2026-07-19T10:00:00.000Z', values }),
    ]);
    const ref = resolveJustCompleted([ex]);
    expect(ref?.values).toEqual({ weight: 60, reps: 8 });
    expect(ref?.values).toBe(values); // same reference, no clone
  });

  it('breaks a timestamp tie deterministically: first traversed wins', () => {
    const at = '2026-07-19T10:00:00.000Z';
    const ex1 = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, completed_at: at }),
    ]);
    const ex2 = makeExercise('e2', 'Sentadilla', [
      makeSet('s2', { completed: true, completed_at: at }),
    ]);
    const ref = resolveJustCompleted([ex1, ex2]);
    expect(ref?.setId).toBe('s1');
    expect(ref?.exerciseId).toBe('e1');
  });
});
