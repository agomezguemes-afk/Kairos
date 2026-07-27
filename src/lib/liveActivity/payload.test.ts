import { describe, it, expect } from 'vitest';

import { createExerciseCard, type ExerciseCard, type FieldDefinition } from '../../types/core';

import { buildLiveActivityPayload, formatTargetLine, type WorkoutSnapshot } from './payload';

const NOW = 1_700_000_000_000;

function strength(name: string, sets = 3, weight: number | null = 60, reps: number | null = 6) {
  const ex = createExerciseCard('b1', 0, 'strength', { name });
  ex.sets = ex.sets.slice(0, sets).map((s) => ({
    ...s,
    values: { ...s.values, weight, reps },
  }));
  return ex;
}

function running(name: string) {
  const fields: FieldDefinition[] = [
    {
      id: 'distance',
      name: 'Distancia',
      type: 'number',
      unit: 'km',
      isBase: true,
      isPrimary: true,
      order: 0,
    },
    {
      id: 'pace',
      name: 'Ritmo',
      type: 'number',
      unit: 'min/km',
      isBase: true,
      isPrimary: false,
      order: 1,
    },
  ];
  const ex = createExerciseCard('b1', 1, 'running', { name, fields });
  ex.sets = ex.sets.slice(0, 1).map((s) => ({ ...s, values: { distance: 5, pace: 5.3 } }));
  return ex;
}

function snapshot(over: Partial<WorkoutSnapshot> = {}): WorkoutSnapshot {
  return {
    blockName: 'Empuje A',
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    exercises: [strength('Press banca'), strength('Press inclinado')],
    restTimer: { active: false, startTime: 0, duration: 0 },
    hasEnteredCurrentExercise: true,
    ...over,
  };
}

function complete(ex: ExerciseCard): ExerciseCard {
  return { ...ex, sets: ex.sets.map((s) => ({ ...s, completed: true })) };
}

describe('formatTargetLine', () => {
  it('renders the weight × reps idiom', () => {
    const target = formatTargetLine({
      segments: [
        { value: '60', unit: 'kg' },
        { value: '6', unit: null },
      ],
      separator: '×',
      spoken: '60 kilos por 6',
    });
    expect(target).toBe('60 kg × 6');
  });

  it('renders non-strength targets with the · separator', () => {
    const target = formatTargetLine({
      segments: [
        { value: '5', unit: 'km' },
        { value: '5.3', unit: 'min/km' },
      ],
      separator: '·',
      spoken: '5 kilómetros, 5.3 minutos por kilómetro',
    });
    expect(target).toBe('5 km · 5.3 min/km');
  });

  it('passes null through (bodyweight / no target)', () => {
    expect(formatTargetLine(null)).toBeNull();
  });
});

describe('buildLiveActivityPayload', () => {
  it('returns null with no workout', () => {
    expect(buildLiveActivityPayload(null, NOW)).toBeNull();
  });

  it('renders the set-active scoreboard: giant target, set N/M, next exercise', () => {
    const payload = buildLiveActivityPayload(snapshot(), NOW);
    expect(payload).toEqual({
      blockName: 'Empuje A',
      exerciseName: 'Press banca',
      targetLine: '60 kg × 6',
      setIndex: 1,
      setTotal: 3,
      restStartedAt: null,
      restEndsAt: null,
      nextUp: 'Press inclinado',
      phase: 'set',
    });
  });

  it('formats non-strength targets through the same formatter', () => {
    const payload = buildLiveActivityPayload(
      snapshot({ exercises: [running('Rodaje suave')] }),
      NOW,
    );
    expect(payload?.targetLine).toBe('5 km · 5.3 min/km');
    expect(payload?.nextUp).toBeNull(); // last exercise
  });

  it('reports a running rest with its window and the upcoming set as nextUp', () => {
    const payload = buildLiveActivityPayload(
      snapshot({
        currentSetIndex: 1,
        restTimer: { active: true, startTime: NOW - 30_000, duration: 90 },
      }),
      NOW,
    );
    expect(payload?.phase).toBe('rest');
    expect(payload?.restStartedAt).toBe(NOW - 30_000);
    expect(payload?.restEndsAt).toBe(NOW - 30_000 + 90_000);
    expect(payload?.nextUp).toBe('Press banca · serie 2/3');
    expect(payload?.setIndex).toBe(2);
  });

  it('treats an expired-but-uncleared rest as lifting', () => {
    // The app was backgrounded: no JS ran to call skipRest, so the store still
    // says active. The lock screen must show the next set, not 00:00 forever.
    const payload = buildLiveActivityPayload(
      snapshot({
        restTimer: { active: true, startTime: NOW - 120_000, duration: 90 },
      }),
      NOW,
    );
    expect(payload?.phase).toBe('set');
    expect(payload?.restEndsAt).toBeNull();
  });

  it('surfaces the exercise-change phase the screen shows', () => {
    const payload = buildLiveActivityPayload(
      snapshot({ currentExerciseIndex: 1, hasEnteredCurrentExercise: false }),
      NOW,
    );
    expect(payload?.phase).toBe('change');
    expect(payload?.exerciseName).toBe('Press inclinado');
  });

  it('drops the change phase once the user has entered the exercise', () => {
    const payload = buildLiveActivityPayload(
      snapshot({ currentExerciseIndex: 1, hasEnteredCurrentExercise: true }),
      NOW,
    );
    expect(payload?.phase).toBe('set');
  });

  it('ends the activity when the session is finished (rest still ticking)', () => {
    const payload = buildLiveActivityPayload(
      snapshot({
        exercises: [complete(strength('Press banca')), complete(strength('Press inclinado'))],
        currentExerciseIndex: 1,
        currentSetIndex: 2,
        restTimer: { active: true, startTime: NOW, duration: 90 },
      }),
      NOW,
    );
    expect(payload).toBeNull();
  });

  it('survives a corrupt index instead of throwing at the native boundary', () => {
    expect(buildLiveActivityPayload(snapshot({ currentExerciseIndex: 9 }), NOW)).toBeNull();
    expect(buildLiveActivityPayload(snapshot({ currentSetIndex: 9 }), NOW)).toBeNull();
    expect(buildLiveActivityPayload(snapshot({ exercises: [] }), NOW)).toBeNull();
  });

  it('shows no target for a set with nothing filled in', () => {
    const payload = buildLiveActivityPayload(
      snapshot({ exercises: [strength('Dominadas', 3, null, null)] }),
      NOW,
    );
    expect(payload?.targetLine).toBeNull();
    expect(payload?.exerciseName).toBe('Dominadas');
  });

  it('names a lone value so "6" is never ambiguous at two metres', () => {
    const payload = buildLiveActivityPayload(
      snapshot({ exercises: [strength('Dominadas', 3, null, 8)] }),
      NOW,
    );
    expect(payload?.targetLine).toBe('8 reps');
  });
});
