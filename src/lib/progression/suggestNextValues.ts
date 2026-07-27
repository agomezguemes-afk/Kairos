// KAIROS — Progression engine: suggest the next session's values.
//
// Pinned v1 rules (DO NOT exceed — no ML, no recommendation engine):
//   - strength (weight field): carry forward the last weight + an RPE nudge of
//     ±2.5 kg. Easy last time → up; maxed out → down; in range or unrated → hold.
//   - endurance (pace/distance/calories) & everything else: carry forward the
//     last value, no nudge.
//
// Extended (Phase 1 adaptive readiness, see docs/superpowers/specs/
// 2026-07-23-adaptive-readiness-design.md): an optional AdaptationSignal can
// scale/cap the RPE nudge — it never replaces it, never invents a nudge the
// RPE data didn't produce, and is still pure deterministic arithmetic (no
// ML). The RPE nudge itself is unchanged.
//
// The reference is the LAST completed set of the MOST RECENT session that has
// completed data (mirrors the active-workout "última vez" resolver). Every
// numeric field on that set that the exercise still defines is carried forward;
// only `weight` is ever nudged, and only when RPE says so.

import type { FieldDefinition } from '../../types/core';
import { classifyModality } from './modality';
import type { AdaptationSignal } from '../readiness/adaptiveEngine';
import type { ExerciseHistory, HistoricalSet, SuggestedValues, SuggestionBasis } from './types';

/** ±2.5 kg — the barbell's smallest honest jump; matches the strength step. */
export const WEIGHT_NUDGE_KG = 2.5;
/** RPE ≤ this on the reference set → the load was light, add 2.5 kg. */
export const RPE_EASY_MAX = 7;
/** RPE ≥ this → the set was maxed/grindy, back off 2.5 kg. */
export const RPE_HARD_MIN = 10;

/** The strength nudge, in kg. 0 when RPE is missing or in the working range. */
export function rpeNudgeKg(rpe: number | undefined): number {
  if (rpe == null) return 0; // unrated → no nudge (hold)
  if (rpe <= RPE_EASY_MAX) return WEIGHT_NUDGE_KG;
  if (rpe >= RPE_HARD_MIN) return -WEIGHT_NUDGE_KG;
  return 0; // 7 < rpe < 10 → in range, hold
}

/** Last completed set of the most recent session with data, or null. */
function referenceSet(history: ExerciseHistory): HistoricalSet | null {
  const session = history.sessions[0];
  if (!session || session.sets.length === 0) return null;
  return session.sets[session.sets.length - 1];
}

/**
 * Adaptation can only dampen or block an RPE-driven increase when recovery
 * is poor — it never invents an increase the RPE data didn't already
 * support. See docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md §6.2.
 */
export function applyAdaptationToNudge(nudgeKg: number, adaptation?: AdaptationSignal): number {
  if (!adaptation) return nudgeKg;
  if (nudgeKg > 0 && adaptation.value <= -0.5) return 0;
  return nudgeKg;
}

/**
 * Suggest pre-fill values for one exercise from its history. Returns empty
 * `values`/`basis` (but a resolved `modality`) when there's no usable history —
 * the first-ever session has nothing to carry, and that's the honest answer.
 */
export function suggestNextValues(
  fields: FieldDefinition[],
  history: ExerciseHistory,
  adaptation?: AdaptationSignal,
): SuggestedValues {
  const modality = classifyModality(fields);
  const ref = referenceSet(history);
  const session = history.sessions[0];

  if (!ref || !session) {
    return { modality, values: {}, basis: {}, reference: null };
  }

  const nudgesWeight = modality === 'strength' || modality === 'hybrid';
  const values: Record<string, number> = {};
  const basis: Record<string, SuggestionBasis> = {};

  for (const field of fields) {
    const last = ref.values[field.id];
    if (typeof last !== 'number') continue; // no history for this field

    if (field.id === 'weight' && nudgesWeight) {
      const nudge = applyAdaptationToNudge(rpeNudgeKg(ref.rpe), adaptation);
      const next = Math.max(0, last + nudge);
      values[field.id] = next;
      basis[field.id] = nudge > 0 ? 'nudge-up' : nudge < 0 ? 'nudge-down' : 'carry-forward';
    } else {
      values[field.id] = last;
      basis[field.id] = 'carry-forward';
    }
  }

  return {
    modality,
    values,
    basis,
    reference: session.blockName
      ? { performedAt: session.performedAt, blockName: session.blockName }
      : { performedAt: session.performedAt },
  };
}
