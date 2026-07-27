// src/features/planner/lib/foldSummary.test.ts
// Pure-core tests for the HomeFolder handle teaser. Mirrors momentum.test.ts
// style — describe/it/expect, no mocking, no React.

import { describe, it, expect } from 'vitest';
import { foldSummary } from './foldSummary';

describe('foldSummary — handle teaser priority', () => {
  it('leads with the weekly session count when sessions exist', () => {
    expect(
      foldSummary({ sessionsThisWeek: 3, readinessCalibrating: false, readinessHeadline: 'x' }),
    ).toEqual({ eyebrow: 'Esta semana', summary: '3 sesiones' });
  });

  it('singularises "1 sesión"', () => {
    expect(
      foldSummary({ sessionsThisWeek: 1, readinessCalibrating: false, readinessHeadline: 'x' }),
    ).toEqual({ eyebrow: 'Esta semana', summary: '1 sesión' });
  });

  it('falls back to readiness headline when no sessions but a reading exists', () => {
    expect(
      foldSummary({
        sessionsThisWeek: 0,
        readinessCalibrating: false,
        readinessHeadline: 'Listo para rendir',
      }),
    ).toEqual({ eyebrow: 'Tu estado', summary: 'Listo para rendir' });
  });

  it('falls back to the day-0 teaser when calibrating and no sessions', () => {
    expect(
      foldSummary({ sessionsThisWeek: 0, readinessCalibrating: true, readinessHeadline: 'x' }),
    ).toEqual({ eyebrow: 'Más', summary: 'Calendario, estado y semana' });
  });

  it('prioritises the sessions rule over the readiness rule when both apply', () => {
    expect(
      foldSummary({
        sessionsThisWeek: 2,
        readinessCalibrating: false,
        readinessHeadline: 'Día verde. Puedes ir fuerte hoy.',
      }),
    ).toEqual({ eyebrow: 'Esta semana', summary: '2 sesiones' });
  });
});
