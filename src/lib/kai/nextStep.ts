// src/lib/kai/nextStep.ts
//
// L-B · Kai's "next step" — one deterministic, offline recommendation that the
// user can apply in a single tap. This is the anti-black-box move (05 P0-2,
// 02 P0-3): GymStreak/Fitbod monetise zero-decision friction; we match that
// without hijacking control. NO LLM, NO network — pure functions of state.
//
// Two entry points, one shape:
//   · postWorkoutNextStep — closes every finished session with a progression
//   · todayNextStep        — the "Hoy" screen always ends in one actionable CTA
//
// The step ALWAYS carries an action; silence is never an option here (unlike
// the sober kaiSignal card). Applying it lives in applyAction.ts.

import type { ISODate } from '../../types/schedule';

export type KaiActionKind =
  | 'start_block'
  | 'resume_workout'
  | 'schedule_block'
  | 'repeat_block'
  | 'bump_weight'
  | 'open_block'
  | 'create_block';

export interface KaiNextAction {
  kind: KaiActionKind;
  /** One-tap button copy (ES). */
  label: string;
  blockId?: string;
  exerciseId?: string;
  /** Target date for schedule/repeat actions. Filled by the applier when absent. */
  date?: ISODate;
  /** New absolute goal weight (kg) for bump_weight — what the store persists. */
  targetWeight?: number;
  /** Increment (kg) for bump_weight — used only for copy. */
  deltaKg?: number;
}

export interface KaiNextStep {
  /** Stable rule id so the card doesn't flicker across re-renders. */
  id: string;
  headline: string;
  detail?: string;
  action: KaiNextAction;
}

// ======================== POST-WORKOUT ========================

export interface PostWorkoutExercise {
  exerciseId: string;
  name: string;
  /** Primary metric is weight (kg) — required to bump load. */
  hasWeight: boolean;
  plannedSetsCount: number;
  completedSets: number;
  /** Lowest RPE across rated sets this session (1..10). Undefined = unrated. */
  minRpe?: number;
  /** Heaviest weight touched this session (kg). Undefined = none logged. */
  topWeight?: number;
  /** Increment step for this exercise's weight field (kg). Defaults to 2.5. */
  weightStep?: number;
}

export interface PostWorkoutInput {
  blockId: string;
  blockName: string;
  exercises: PostWorkoutExercise[];
  /** True when a future session for this or any block is already on the calendar. */
  hasUpcomingPlan: boolean;
}

const DEFAULT_STEP = 2.5;
// Above this RPE the set was near-maximal — hold the load, don't push it.
const BUMP_RPE_CEILING = 8;

function bumpCandidate(exs: PostWorkoutExercise[]): PostWorkoutExercise | null {
  const eligible = exs.filter(
    (e) =>
      e.hasWeight &&
      e.plannedSetsCount > 0 &&
      e.completedSets >= e.plannedSetsCount &&
      (e.minRpe === undefined || e.minRpe <= BUMP_RPE_CEILING),
  );
  if (eligible.length === 0) return null;
  // Prefer the exercise that felt easiest (lowest RPE); unrated sits mid-scale
  // so a genuinely easy rated set wins. Stable tie-break by original order.
  const rpeOf = (e: PostWorkoutExercise) => (e.minRpe === undefined ? 7.5 : e.minRpe);
  return eligible.reduce((best, e) => (rpeOf(e) < rpeOf(best) ? e : best), eligible[0]);
}

function hasIncompleteWork(exs: PostWorkoutExercise[]): boolean {
  return exs.some((e) => e.plannedSetsCount > 0 && e.completedSets < e.plannedSetsCount);
}

/** Round a kg value to the nearest 0.5 so bumped targets stay plate-friendly. */
function roundKg(kg: number): number {
  return Math.round(kg * 2) / 2;
}

export function postWorkoutNextStep(input: PostWorkoutInput): KaiNextStep {
  const candidate = bumpCandidate(input.exercises);
  if (candidate) {
    const step =
      candidate.weightStep && candidate.weightStep > 0 ? candidate.weightStep : DEFAULT_STEP;
    const base = candidate.topWeight ?? 0;
    const targetWeight = roundKg(base + step);
    return {
      id: 'bump-weight',
      headline: `Cerraste ${candidate.name}. Sube ${step} kg la próxima vez.`,
      detail: base > 0 ? `De ${roundKg(base)} kg a ${targetWeight} kg.` : undefined,
      action: {
        kind: 'bump_weight',
        label: `Subir a ${targetWeight} kg`,
        blockId: input.blockId,
        exerciseId: candidate.exerciseId,
        targetWeight,
        deltaKg: step,
      },
    };
  }

  if (hasIncompleteWork(input.exercises)) {
    return {
      id: 'repeat-block',
      headline: 'Te quedaron series pendientes. Repite el bloque y ciérralo.',
      action: {
        kind: 'repeat_block',
        label: 'Repetir mañana',
        blockId: input.blockId,
      },
    };
  }

  if (!input.hasUpcomingPlan) {
    return {
      id: 'schedule-next',
      headline: 'Buen trabajo. Programa tu próxima sesión.',
      action: {
        kind: 'schedule_block',
        label: 'Programar próxima',
        blockId: input.blockId,
      },
    };
  }

  return {
    id: 'review-done',
    headline: 'Sesión redonda. Tu próxima ya está en el calendario.',
    action: {
      kind: 'open_block',
      label: 'Revisar bloque',
      blockId: input.blockId,
    },
  };
}

// ======================== TODAY ========================

export type PlannedStatus = 'planned' | 'completed' | 'skipped';

export interface TodayInput {
  hasActiveWorkout: boolean;
  blocksCount: number;
  /** Today's resolved plan, if any. */
  plannedBlock: { blockId: string; blockName: string; status: PlannedStatus } | null;
  streak: number;
  /** Best block to start when there's no plan (favorite → most-performed → first). */
  suggestedBlock: { blockId: string; blockName: string } | null;
}

export function todayNextStep(input: TodayInput): KaiNextStep {
  if (input.hasActiveWorkout) {
    return {
      id: 'resume',
      headline: 'Tienes una sesión a medias. Continúa donde la dejaste.',
      action: { kind: 'resume_workout', label: 'Continuar' },
    };
  }

  if (input.blocksCount === 0) {
    return {
      id: 'create-first',
      headline: 'Empieza por tu primer bloque.',
      action: { kind: 'create_block', label: 'Crear bloque' },
    };
  }

  const planned = input.plannedBlock;
  const suggested = input.suggestedBlock;
  const pick =
    suggested ?? (planned ? { blockId: planned.blockId, blockName: planned.blockName } : null);

  if (planned && planned.status === 'planned') {
    return {
      id: 'start-planned',
      headline: `Hoy toca ${planned.blockName}. Empieza cuando quieras.`,
      action: { kind: 'start_block', label: 'Empezar', blockId: planned.blockId },
    };
  }

  if (planned && planned.status === 'skipped') {
    return {
      id: 'retake-skipped',
      headline: `Saltaste ${planned.blockName}. Retómalo hoy.`,
      action: { kind: 'start_block', label: 'Empezar', blockId: planned.blockId },
    };
  }

  if (planned && planned.status === 'completed') {
    if (pick) {
      const streakTail = input.streak >= 3 ? ` ${input.streak} días seguidos.` : '';
      return {
        id: 'plan-tomorrow',
        headline: `Hecho por hoy.${streakTail} Programa la próxima.`,
        action: { kind: 'schedule_block', label: 'Programar próxima', blockId: pick.blockId },
      };
    }
    return {
      id: 'done-review',
      headline: 'Hecho por hoy. Buen ritmo.',
      action: { kind: 'open_block', label: 'Revisar', blockId: planned.blockId },
    };
  }

  // No plan for today, but blocks exist → start the best candidate now.
  if (pick) {
    return {
      id: 'start-suggested',
      headline: `Sin plan para hoy. Empieza ${pick.blockName}.`,
      action: { kind: 'start_block', label: `Empezar ${pick.blockName}`, blockId: pick.blockId },
    };
  }

  // Defensive fallback — blocks exist but no candidate resolved.
  return {
    id: 'create-fallback',
    headline: 'Elige tu próxima sesión.',
    action: { kind: 'create_block', label: 'Crear bloque' },
  };
}
