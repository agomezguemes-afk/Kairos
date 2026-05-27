// src/features/planner/lib/kaiSignal.ts
// Deterministic insight generator. No network, no IO. Pure function of state.
// The first matching rule wins; if no rule matches, returns null
// (silence > noise).

import type { ResolvedAssignment } from '../../../types/schedule';

export type KaiTone = 'focus' | 'progress' | 'momentum' | 'celebrate';
// 'plan-week' removed: sober tone has no AI-mascot CTA. The no-plan signal is
// pure information; assignment happens via the existing 'assign' action.
export type KaiActionKind = 'assign' | 'resume' | 'create-block';

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
      message: 'Sin bloques. Crea uno para empezar a planificar.',
      action: { label: 'Crear bloque', kind: 'create-block' },
    };
  }

  if (i.hasActiveWorkout) {
    return {
      id: 'resume',
      tone: 'progress',
      message: 'Sesión a medias. Continúa donde la dejaste.',
      action: { label: 'Continuar', kind: 'resume' },
    };
  }

  if (i.isToday && i.resolved?.status === 'completed') {
    return {
      id: 'done',
      tone: 'celebrate',
      message: 'Sesión completada.',
    };
  }

  if (i.isToday && !i.resolved && i.streak >= 3) {
    return {
      id: 'streak',
      tone: 'momentum',
      message: `${i.streak} días seguidos. Programa una sesión para hoy.`,
      action: { label: 'Asignar bloque', kind: 'assign' },
    };
  }

  if (i.isToday && !i.resolved) {
    return {
      id: 'no-plan',
      tone: 'momentum',
      message: 'Día sin plan.',
    };
  }

  if (i.isToday && i.resolved && !i.lastSession) {
    return {
      id: 'first-time',
      tone: 'focus',
      message: 'Primera vez con este bloque.',
    };
  }

  if (
    i.isToday &&
    i.resolved &&
    i.lastSession &&
    i.lastSession.targetSetCount > 0 &&
    i.lastSession.setCount >= i.lastSession.targetSetCount
  ) {
    return {
      id: 'progress-up',
      tone: 'progress',
      message: 'Última sesión completa. Puedes subir ligeramente.',
    };
  }

  if (
    i.isToday &&
    i.resolved &&
    i.lastSession &&
    i.lastSession.targetSetCount > 0 &&
    i.lastSession.setCount < i.lastSession.targetSetCount
  ) {
    const remaining = i.lastSession.targetSetCount - i.lastSession.setCount;
    return {
      id: 'close-block',
      tone: 'focus',
      message:
        remaining === 1
          ? `Última vez: faltó ${remaining} serie.`
          : `Última vez: faltaron ${remaining} series.`,
    };
  }

  return null;
}
