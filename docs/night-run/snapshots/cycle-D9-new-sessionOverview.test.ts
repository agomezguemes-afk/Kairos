import { describe, expect, it } from 'vitest';
import { buildSessionOverview, formatSetSummary } from './sessionOverview';
import type { ExerciseCard, ExerciseSet, FieldDefinition, FieldValues } from '../../../types/core';

function field(id: string, name: string, unit: string | null, order: number): FieldDefinition {
  return { id, name, type: 'number', unit, isBase: true, isPrimary: order === 0, order };
}

const strengthFields: FieldDefinition[] = [
  field('weight', 'Weight', 'kg', 0),
  field('reps', 'Reps', null, 1),
];

const runningFields: FieldDefinition[] = [
  field('distance', 'Distance', 'km', 0),
  field('pace', 'Pace', 'min/km', 1),
];

function makeSet(
  id: string,
  opts: { completed?: boolean; values?: FieldValues } = {},
): ExerciseSet {
  return {
    id,
    exercise_card_id: 'ex',
    order: 0,
    values: opts.values ?? {},
    completed: opts.completed ?? false,
    completed_at: null,
    notes: null,
  };
}

function makeExercise(
  id: string,
  name: string,
  sets: ExerciseSet[],
  fields: FieldDefinition[] = strengthFields,
): ExerciseCard {
  const now = '2026-07-20T00:00:00.000Z';
  return {
    id,
    workout_block_id: 'block',
    order: 0,
    name,
    icon: 'dumbbell',
    color: '#000000',
    notes: null,
    discipline: 'strength',
    fields,
    sets,
    default_sets_count: sets.length,
    rest_seconds: 90,
    created_at: now,
    updated_at: now,
  };
}

describe('formatSetSummary', () => {
  it('formats weight + reps as "60 kg · 8"', () => {
    const s = makeSet('s1', { values: { weight: 60, reps: 8 } });
    expect(formatSetSummary(s, strengthFields)).toBe('60 kg · 8');
  });

  it('formats a unit-less field bare ("8")', () => {
    const s = makeSet('s1', { values: { reps: 8 } });
    expect(formatSetSummary(s, [field('reps', 'Reps', null, 0)])).toBe('8');
  });

  it('respects field `order`, not declaration order', () => {
    const outOfOrderFields: FieldDefinition[] = [
      field('reps', 'Reps', null, 1),
      field('weight', 'Weight', 'kg', 0),
    ];
    const s = makeSet('s1', { values: { weight: 60, reps: 8 } });
    expect(formatSetSummary(s, outOfOrderFields)).toBe('60 kg · 8');
  });

  it('skips null and empty-string values', () => {
    const s = makeSet('s1', { values: { weight: 60, reps: null } });
    expect(formatSetSummary(s, strengthFields)).toBe('60 kg');
    const s2 = makeSet('s2', { values: { weight: '', reps: 8 } });
    expect(formatSetSummary(s2, strengthFields)).toBe('8');
  });

  it('formats distance + pace for a non-strength discipline', () => {
    const s = makeSet('s1', { values: { distance: 5, pace: '5:30' } });
    expect(formatSetSummary(s, runningFields)).toBe('5 km · 5:30 min/km');
  });
});

describe('buildSessionOverview', () => {
  it('counts exercisesDone/exercisesTotal and setsDone/setsTotal across the session', () => {
    const done = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, values: { weight: 60, reps: 8 } }),
      makeSet('s2', { completed: true, values: { weight: 60, reps: 8 } }),
    ]);
    const current = makeExercise('e2', 'Sentadilla', [
      makeSet('s3', { completed: true, values: { weight: 80, reps: 5 } }),
      makeSet('s4'),
    ]);
    const upcoming = makeExercise('e3', 'Remo', [makeSet('s5'), makeSet('s6')]);
    const ov = buildSessionOverview([done, current, upcoming], 1);

    expect(ov.exercisesDone).toBe(1);
    expect(ov.exercisesTotal).toBe(3);
    expect(ov.setsDone).toBe(3);
    expect(ov.setsTotal).toBe(6);
  });

  it('builds progressLabel and progress as a fraction of sets', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true }),
      makeSet('s2'),
      makeSet('s3'),
      makeSet('s4'),
    ]);
    const ov = buildSessionOverview([ex], 0);
    expect(ov.progressLabel).toBe('1 de 4 series');
    expect(ov.progress).toBe(0.25);
  });

  it('returns progress 0 with setsTotal 0, no division by zero', () => {
    const ex = makeExercise('e1', 'Plancha estática', []);
    const ov = buildSessionOverview([ex], 0);
    expect(ov.setsTotal).toBe(0);
    expect(ov.progress).toBe(0);
    expect(Number.isNaN(ov.progress)).toBe(false);
    expect(ov.progressLabel).toBe('0 de 0 series');
  });

  it('assigns status done/current/upcoming per exercise', () => {
    const done = makeExercise('e1', 'Press banca', [makeSet('s1', { completed: true })]);
    const current = makeExercise('e2', 'Sentadilla', [makeSet('s2', { completed: true }), makeSet('s3')]);
    const upcoming = makeExercise('e3', 'Remo', [makeSet('s4')]);
    const ov = buildSessionOverview([done, current, upcoming], 1);

    expect(ov.exercises[0].status).toBe('done');
    expect(ov.exercises[1].status).toBe('current');
    expect(ov.exercises[2].status).toBe('upcoming');
  });

  it('builds recap for a complete exercise, singular set', () => {
    const ex = makeExercise('e1', 'Plancha', [makeSet('s1', { completed: true })]);
    const ov = buildSessionOverview([ex], 5);
    expect(ov.exercises[0].recap).toBe('1 serie');
  });

  it('builds recap for a complete exercise, plural sets', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true }),
      makeSet('s2', { completed: true }),
    ]);
    const ov = buildSessionOverview([ex], 5);
    expect(ov.exercises[0].recap).toBe('2 series');
  });

  it('builds recap for a partially completed exercise', () => {
    const ex = makeExercise('e1', 'Sentadilla', [
      makeSet('s1', { completed: true }),
      makeSet('s2'),
      makeSet('s3'),
    ]);
    const ov = buildSessionOverview([ex], 5);
    expect(ov.exercises[0].recap).toBe('1/3 series');
  });

  it('builds recap "Pendiente" for an untouched exercise', () => {
    const ex = makeExercise('e1', 'Remo', [makeSet('s1'), makeSet('s2')]);
    const ov = buildSessionOverview([ex], 5);
    expect(ov.exercises[0].recap).toBe('Pendiente');
  });

  it('builds per-set entries with 1-based index, completed and summary', () => {
    const ex = makeExercise('e1', 'Press banca', [
      makeSet('s1', { completed: true, values: { weight: 60, reps: 8 } }),
      makeSet('s2'),
    ]);
    const ov = buildSessionOverview([ex], 0);
    expect(ov.exercises[0].sets).toEqual([
      { index: 1, completed: true, summary: '60 kg · 8' },
      { index: 2, completed: false, summary: '' },
    ]);
  });

  it('does not crash and marks nobody current when currentIndex is out of range', () => {
    const ex1 = makeExercise('e1', 'Press banca', [makeSet('s1', { completed: true })]);
    const ex2 = makeExercise('e2', 'Sentadilla', [makeSet('s2')]);
    expect(() => buildSessionOverview([ex1, ex2], 99)).not.toThrow();
    const ov = buildSessionOverview([ex1, ex2], -1);
    expect(ov.exercises.some((e) => e.status === 'current')).toBe(false);
    expect(ov.exercises[0].status).toBe('done');
    expect(ov.exercises[1].status).toBe('upcoming');
  });

  it('returns all zeros and "0 de 0 series" for an empty exercise list', () => {
    const ov = buildSessionOverview([], 0);
    expect(ov.exercisesDone).toBe(0);
    expect(ov.exercisesTotal).toBe(0);
    expect(ov.setsDone).toBe(0);
    expect(ov.setsTotal).toBe(0);
    expect(ov.progress).toBe(0);
    expect(ov.progressLabel).toBe('0 de 0 series');
    expect(ov.exercises).toEqual([]);
  });
});
