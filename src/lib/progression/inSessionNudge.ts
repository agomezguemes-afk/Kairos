// KAIROS — Progression engine: in-session advisor (BRIEF-06).
//
// suggestNextValues adapts weight BETWEEN sessions; this adapts it WITHIN one:
// the set you just finished is the freshest signal there is. Same pinned v1
// heuristic (rpeNudgeKg, ±2.5 kg) — easy (RPE≤7) → up, maxed (RPE≥10) → down,
// in range or unrated → hold (null). Pure; the screen applies it to the draft
// SEED only, so the store's completeSet hot path is untouched.

import type { FieldDefinition } from '../../types/core';
import { rpeNudgeKg, applyAdaptationToNudge } from './suggestNextValues';
import { classifyModality } from './modality';
import type { AdaptationSignal } from '../readiness/adaptiveEngine';

export interface InSessionNudge {
  deltaKg: number; // ±WEIGHT_NUDGE_KG
  nextWeight: number; // max(0, priorWeight + deltaKg)
  reason: 'easy' | 'hard'; // easy = nudge up, hard = nudge down
}

// Adapta el peso de la SIGUIENTE serie a la recién completada del MISMO ejercicio,
// con la regla RPE fijada v1 (±2.5 kg). null cuando no hay señal accionable: no es
// movimiento de fuerza, sin peso previo, sin RPE, o RPE en rango de trabajo (hold).
export function inSessionWeightNudge(
  fields: FieldDefinition[],
  priorSet: { weight: number | null; rpe: number | null | undefined },
  adaptation?: AdaptationSignal,
): InSessionNudge | null {
  const modality = classifyModality(fields);
  if (modality !== 'strength' && modality !== 'hybrid') return null;
  if (typeof priorSet.weight !== 'number') return null;
  const delta = applyAdaptationToNudge(rpeNudgeKg(priorSet.rpe ?? undefined), adaptation);
  if (delta === 0) return null;
  return {
    deltaKg: delta,
    nextWeight: Math.max(0, priorSet.weight + delta),
    reason: delta > 0 ? 'easy' : 'hard',
  };
}
