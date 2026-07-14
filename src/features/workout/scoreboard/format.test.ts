import { describe, expect, it } from 'vitest';
import {
  announceExerciseChange,
  announceFinished,
  announceRest,
  announceSetActive,
  formatScoreboardTarget,
  stripZero,
} from './format';
import type { FieldDefinition } from '../../../types/core';

function field(
  id: string,
  name: string,
  unit: string | null,
  order: number,
  type: FieldDefinition['type'] = 'number',
): FieldDefinition {
  return { id, name, type, unit, isBase: true, isPrimary: order === 0, order };
}

const strengthFields: FieldDefinition[] = [
  field('weight', 'Weight', 'kg', 0),
  field('reps', 'Reps', null, 1),
  field('rir', 'RIR', null, 2),
];

const runningFields: FieldDefinition[] = [
  field('distance', 'Distance', 'km', 0),
  field('duration', 'Duration', 'min', 1),
  field('pace', 'Pace', 'min/km', 2),
];

describe('stripZero', () => {
  it('drops the fraction on integers', () => {
    expect(stripZero(60)).toBe('60');
  });
  it('keeps a real decimal', () => {
    expect(stripZero(62.5)).toBe('62.5');
  });
  it('trims trailing zeros', () => {
    expect(stripZero(62.5)).toBe('62.5');
    expect(stripZero(60.0)).toBe('60');
  });
});

describe('formatScoreboardTarget', () => {
  it('uses the × idiom for weight then reps', () => {
    const t = formatScoreboardTarget(strengthFields, { weight: 60, reps: 8, rir: 2 });
    expect(t).not.toBeNull();
    expect(t!.separator).toBe('×');
    expect(t!.segments).toEqual([
      { value: '60', unit: 'kg' },
      { value: '8', unit: null },
    ]);
    expect(t!.spoken).toBe('60 kilos por 8');
  });

  it('names a lone unit-less field so the giant target is never a bare number', () => {
    // No weight logged yet (fresh exercise, no history): reps alone must read
    // "6 reps", not an ambiguous "6", or it is unreadable across the gym.
    const t = formatScoreboardTarget(strengthFields, { reps: 6 });
    expect(t!.segments).toEqual([{ value: '6', unit: 'reps' }]);
    expect(t!.spoken).toBe('6 reps');
  });

  it('keeps the unit-less reps segment when paired with weight (× disambiguates)', () => {
    const t = formatScoreboardTarget(strengthFields, { weight: 60, reps: 6 });
    expect(t!.segments[1]).toEqual({ value: '6', unit: null });
  });

  it('uses the · separator for non-strength pairs', () => {
    const t = formatScoreboardTarget(runningFields, { distance: 5, duration: 30 });
    expect(t!.separator).toBe('·');
    expect(t!.segments).toEqual([
      { value: '5', unit: 'km' },
      { value: '30', unit: 'min' },
    ]);
    expect(t!.spoken).toBe('5 kilómetros, 30 minutos');
  });

  it('takes only the first two filled numeric fields', () => {
    const t = formatScoreboardTarget(runningFields, { distance: 5, duration: 30, pace: 6 });
    expect(t!.segments).toHaveLength(2);
  });

  it('skips empty leading fields', () => {
    const t = formatScoreboardTarget(strengthFields, { reps: 10 });
    // Alone, the field names itself (see the lone-field case above).
    expect(t!.segments).toEqual([{ value: '10', unit: 'reps' }]);
    // Single field is not the weight×reps idiom → falls back to ·.
    expect(t!.separator).toBe('·');
  });

  it('returns null when nothing numeric is filled (bodyweight/no target)', () => {
    expect(formatScoreboardTarget(strengthFields, {})).toBeNull();
    expect(formatScoreboardTarget(strengthFields, { weight: null, reps: '' })).toBeNull();
  });

  it('formats decimal weights', () => {
    const t = formatScoreboardTarget(strengthFields, { weight: 62.5, reps: 5 });
    expect(t!.segments[0]).toEqual({ value: '62.5', unit: 'kg' });
  });
});

describe('announcements', () => {
  it('announces a set with its target', () => {
    const t = formatScoreboardTarget(strengthFields, { weight: 60, reps: 8 });
    expect(
      announceSetActive({ setIndex: 2, setTotal: 4, exerciseName: 'Sentadilla', target: t }),
    ).toBe('Set 2 de 4. Sentadilla. Objetivo 60 kilos por 8.');
  });

  it('announces a set with no target', () => {
    expect(
      announceSetActive({ setIndex: 1, setTotal: 3, exerciseName: 'Plancha', target: null }),
    ).toBe('Set 1 de 3. Plancha.');
  });

  it('announces rest with and without a next label', () => {
    expect(announceRest('Press banca')).toBe('Descanso. Siguiente: Press banca.');
    expect(announceRest(null)).toBe('Descanso.');
  });

  it('announces an exercise change', () => {
    const t = formatScoreboardTarget(strengthFields, { weight: 40, reps: 10 });
    expect(announceExerciseChange('Remo', t)).toBe(
      'Nuevo ejercicio: Remo. Objetivo 40 kilos por 10.',
    );
  });

  it('announces the finish', () => {
    expect(announceFinished()).toBe('Sesión completada.');
  });
});
