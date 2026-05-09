// src/features/planner/lib/kaiSignal.ts
// Deterministic insight generator. No network, no IO. Pure function of state.
// The first matching rule wins; if no rule matches, returns null
// (silence > noise).

import type { ResolvedAssignment } from '../../../types/schedule';

export type KaiTone = 'focus' | 'progress' | 'momentum' | 'celebrate';
export type KaiActionKind = 'assign' | 'resume' | 'plan-week' | 'create-block';

export interface KaiSignal {
  /** Stable id per rule so the card doesn't flicker on re-render. */
  id: string;
  tone: KaiTone;
  message: string;
  action?: { label: string; kind: KaiActionKind };
}

export interface KaiInputs {
  selectedDate: string;
  isToday: boolean;
  isPast: boolean;
  resolved: ResolvedAssignment | null;
  streak: number;
  blocksCount: number;
  hasActiveWorkout: boolean;
  /** Last matching session for the resolved block, if any. */
  lastSession: { setCount: number; targetSetCount: number } | null;
}

export function kaiSignal(i: KaiInputs): KaiSignal | null {
  if (i.blocksCount === 0) {
    return {
      id: 'no-blocks',
      tone: 'momentum',
      message: 'Crea tu primer bloque para empezar a planificar.',
      action: { label: 'Crear bloque', kind: 'create-block' },
    };
  }

  if (i.hasActiveWorkout) {
    return {
      id: 'resume',
      tone: 'progress',
      message: 'Tienes una sesión a medias. Reanuda donde la dejaste.',
      action: { label: 'Reanudar', kind: 'resume' },
    };
  }

  if (i.isToday && i.resolved?.status === 'completed') {
    return {
      id: 'done',
      tone: 'celebrate',
      message: 'Sesión completada. Buen ritmo, descansa o estira.',
    };
  }

  if (i.isToday && !i.resolved && i.streak >= 3) {
    return {
      id: 'streak',
      tone: 'momentum',
      message: `Llevas ${i.streak} días. Una sesión corta mantiene la racha.`,
      action: { label: 'Asignar bloque', kind: 'assign' },
    };
  }

  if (i.isToday && !i.resolved) {
    return {
      id: 'no-plan',
      tone: 'momentum',
      message: 'Día sin plan. Programa una sesión para mantener momentum.',
      action: { label: 'Kai planifica', kind: 'plan-week' },
    };
  }

  if (i.isToday && i.resolved && !i.lastSession) {
    return {
      id: 'first-time',
      tone: 'focus',
      message: 'Foco de hoy: completa el bloque sin cambiar accesorios.',
    };
  }

  if (
    i.isToday && i.resolved && i.lastSession &&
    i.lastSession.targetSetCount > 0 &&
    i.lastSession.setCount >= i.lastSession.targetSetCount
  ) {
    return {
      id: 'progress-up',
      tone: 'progress',
      message: 'La última vez cerraste todas las series. Puedes subir ligeramente.',
    };
  }

  if (
    i.isToday && i.resolved && i.lastSession &&
    i.lastSession.targetSetCount > 0 &&
    i.lastSession.setCount < i.lastSession.targetSetCount
  ) {
    const remaining = i.lastSession.targetSetCount - i.lastSession.setCount;
    return {
      id: 'close-block',
      tone: 'focus',
      message: `La última vez quedaste a ${remaining} ${remaining === 1 ? 'serie' : 'series'}. Hoy intenta cerrar el bloque.`,
    };
  }

  return null;
}
