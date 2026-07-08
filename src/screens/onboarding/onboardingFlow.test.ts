// KAIROS — tests del flujo puro de onboarding (contrato del sprint).

import { describe, it, expect, beforeEach } from 'vitest';

import {
  assignWeekdays,
  planForFrequency,
  buildTheatreSteps,
  withMinimumDuration,
  delay,
  track,
  __getTrackedEvents,
  __resetTrackedEvents,
  THEATRE_MIN_MS,
  THEATRE_STEP_INTERVAL_MS,
  DISCIPLINE_CAPTIONS,
  EVENTS,
} from './onboardingFlow';

describe('planForFrequency', () => {
  it('devuelve lu/mi/vi para 3 días (directiva L1)', () => {
    expect(planForFrequency(3)).toEqual([1, 3, 5]);
  });

  it('cubre las frecuencias del quiz (2-5) con el nº de días exacto', () => {
    for (const freq of [2, 3, 4, 5]) {
      expect(planForFrequency(freq)).toHaveLength(freq);
    }
  });

  it('nunca repite día dentro de un plan', () => {
    for (const freq of [1, 2, 3, 4, 5, 6, 7]) {
      const plan = planForFrequency(freq);
      expect(new Set(plan).size).toBe(plan.length);
    }
  });

  it('normaliza valores fuera de rango o inválidos al plan de 3 días', () => {
    expect(planForFrequency(0)).toEqual([1, 3, 5]);
    expect(planForFrequency(8)).toEqual([1, 3, 5]);
    expect(planForFrequency(Number.NaN)).toEqual([1, 3, 5]);
    expect(planForFrequency(Number.POSITIVE_INFINITY)).toEqual([1, 3, 5]);
  });

  it('solo produce weekdays válidos 0-6', () => {
    for (const freq of [1, 2, 3, 4, 5, 6, 7]) {
      for (const d of planForFrequency(freq)) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe('assignWeekdays', () => {
  it('asigna un único bloque a todos los días del plan', () => {
    const out = assignWeekdays(['b1'], 3);
    expect(out).toEqual([
      { blockId: 'b1', weekday: 1 },
      { blockId: 'b1', weekday: 3 },
      { blockId: 'b1', weekday: 5 },
    ]);
  });

  it('cicla varios bloques sobre los días (A/B alternos)', () => {
    const out = assignWeekdays(['a', 'b'], 4);
    expect(out.map((x) => x.blockId)).toEqual(['a', 'b', 'a', 'b']);
  });

  it('produce ≥ frequency asignaciones para cada frecuencia del quiz', () => {
    for (const freq of [2, 3, 4, 5]) {
      expect(assignWeekdays(['b1'], freq).length).toBeGreaterThanOrEqual(freq);
    }
  });

  it('devuelve vacío sin bloques (estado degradado, no crash)', () => {
    expect(assignWeekdays([], 3)).toEqual([]);
  });
});

describe('buildTheatreSteps', () => {
  it('devuelve 4 pasos narrados con la disciplina en minúsculas', () => {
    const steps = buildTheatreSteps('Fuerza');
    expect(steps).toHaveLength(4);
    expect(steps[1]).toContain('fuerza');
  });

  it('la cadencia de pasos nunca deja silencios > 2s', () => {
    expect(THEATRE_STEP_INTERVAL_MS).toBeLessThanOrEqual(2000);
    // 3 checks intermedios caben dentro del mínimo percibido.
    expect(THEATRE_STEP_INTERVAL_MS * 3).toBeLessThan(THEATRE_MIN_MS);
  });

  it('cada disciplina del quiz tiene caption de micro-momento', () => {
    for (const caption of Object.values(DISCIPLINE_CAPTIONS)) {
      expect(caption.length).toBeGreaterThan(0);
    }
    expect(Object.keys(DISCIPLINE_CAPTIONS)).toHaveLength(6);
  });
});

describe('withMinimumDuration', () => {
  it('no resuelve antes del mínimo aunque la promesa sea instantánea', async () => {
    const t0 = Date.now();
    const value = await withMinimumDuration(Promise.resolve('ok'), 120);
    expect(value).toBe('ok');
    // Margen de 20ms por resolución del event loop.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(100);
  });

  it('espera a la promesa si tarda más que el mínimo', async () => {
    const t0 = Date.now();
    const value = await withMinimumDuration(
      delay(150).then(() => 42),
      50,
    );
    expect(value).toBe(42);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(130);
  });

  it('propaga rechazos sin tragárselos', async () => {
    await expect(withMinimumDuration(Promise.reject(new Error('boom')), 50)).rejects.toThrow(
      'boom',
    );
  });
});

describe('track (stub del contrato de analytics)', () => {
  beforeEach(() => {
    __resetTrackedEvents();
  });

  it('registra evento, props y timestamp', () => {
    const before = Date.now();
    track(EVENTS.quizStepViewed, { step: 2 });
    const events = __getTrackedEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('quiz_step_viewed');
    expect(events[0].props).toEqual({ step: 2 });
    expect(events[0].ts).toBeGreaterThanOrEqual(before);
  });

  it('acepta eventos sin props', () => {
    track(EVENTS.onboardingStarted);
    expect(__getTrackedEvents()[0].props).toBeUndefined();
  });

  it('acota la cola a 200 eventos (no crece sin límite)', () => {
    for (let i = 0; i < 250; i++) track('e', { i });
    const events = __getTrackedEvents();
    expect(events).toHaveLength(200);
    expect(events[0].props).toEqual({ i: 50 });
  });

  it('expone los nombres canónicos del funnel del backlog', () => {
    expect(Object.values(EVENTS)).toEqual(
      expect.arrayContaining([
        'onboarding_started',
        'quiz_step_viewed',
        'onboarding_step_completed',
        'space_generated',
        'plan_reveal_viewed',
        'reveal_action',
        'paywall_viewed',
        'paywall_dismissed',
      ]),
    );
  });
});
