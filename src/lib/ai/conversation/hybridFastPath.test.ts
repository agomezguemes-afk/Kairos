import { describe, it, expect, beforeEach } from 'vitest';

import { buildHybridSession, wantsHybridSession } from './hybridFastPath';
import { useScheduleStore } from '../../../store/scheduleStore';
import { useWorkoutStore } from '../../../store/workoutStore';

// AsyncStorage's web fallback assumes `window` (same stub as the store suite).
(globalThis as { window?: unknown }).window = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};

beforeEach(() => {
  useWorkoutStore.setState({ blocks: [] });
  useScheduleStore.setState({ assignments: [] });
});

// 2026-07-06 is a Monday (weekday 0 in the preset's Mon-first convention).
const MONDAY = new Date(2026, 6, 6, 10, 0, 0);
const TUESDAY = new Date(2026, 6, 7, 10, 0, 0);

describe('wantsHybridSession — detección estricta', () => {
  it.each([
    'algo tipo hyrox',
    'quiero prepararme un HYROX',
    'entrenamiento híbrido',
    'algo hibrido en el box',
    'a hybrid workout today',
    'una carrera híbrida',
  ])('"%s" → true', (text) => {
    expect(wantsHybridSession(text)).toBe(true);
  });

  it.each(['hoy piernas 40 min en casa', 'no sé, algo suave', 'quiero correr 5k', ''])(
    '"%s" → false (no secuestra peticiones normales)',
    (text) => {
      expect(wantsHybridSession(text)).toBe(false);
    },
  );
});

describe('buildHybridSession — siembra el preset y resume', () => {
  it('inserta el bloque "Carrera híbrida" en el store, favorito y con estaciones', () => {
    const summary = buildHybridSession({ now: MONDAY });

    const blocks = useWorkoutStore.getState().blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe(summary.blockId);
    expect(blocks[0].name).toBe('Carrera híbrida');
    expect(blocks[0].is_favorite).toBe(true);
    expect(summary.source).toBe('template');
    expect(summary.discipline).toBe('general');
    expect(summary.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it('siembra la semana recurrente con la frecuencia pedida', () => {
    buildHybridSession({ weeklyFrequency: 5, now: MONDAY });
    const recurring = useScheduleStore.getState().assignments.filter((a) => a.kind === 'recurring');
    expect(recurring).toHaveLength(1);
    const rrule = recurring[0].kind === 'recurring' ? recurring[0].rrule : '';
    // 5 días → BYDAY con 5 entradas.
    expect(rrule.split('BYDAY=')[1]?.split(',')).toHaveLength(5);
  });

  it('si hoy cae en la semana sembrada, no añade asignación suelta', () => {
    // Frecuencia 3 → Lun/Mié/Vie. Un lunes queda cubierto por la recurrencia.
    buildHybridSession({ now: MONDAY });
    const oneTime = useScheduleStore.getState().assignments.filter((a) => a.kind === 'one-time');
    expect(oneTime).toHaveLength(0);
  });

  it('si hoy NO cae en la semana sembrada, ancla hoy con una asignación única', () => {
    // Martes (weekday 1) no está en [Lun, Mié, Vie].
    buildHybridSession({ now: TUESDAY });
    const oneTime = useScheduleStore.getState().assignments.filter((a) => a.kind === 'one-time');
    expect(oneTime).toHaveLength(1);
    expect(oneTime[0].kind === 'one-time' && oneTime[0].date).toBe('2026-07-07');
  });

  it('personaliza la intro con el nombre del usuario', () => {
    buildHybridSession({ displayName: 'Álvaro', now: MONDAY });
    const block = useWorkoutStore.getState().blocks[0];
    const hasName = block.content.some(
      (n) => n.type === 'text' && n.data.content.includes('Álvaro'),
    );
    expect(hasName).toBe(true);
  });
});
