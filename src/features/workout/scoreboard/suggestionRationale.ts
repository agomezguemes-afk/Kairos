// The "Sugerido" line stops guessing and quotes the progression engine: the
// suggestNextValues basis already knows WHY (nudge-up = last set was easy,
// RPE≤7; nudge-down = it was a grind, RPE≥10; carry-forward = hold). This
// module only translates {values, basis} to the sober Spanish line the user
// sees/hears — pure, no store, no history. Spec: docs/night-run/BRIEF-05.md.

import type { FieldValue } from '../../../types/core';
import type { InSessionNudge, SuggestionBasis } from '../../../lib/progression';
import { WEIGHT_NUDGE_KG } from '../../../lib/progression';
import { stripZero } from './format';

const MINUS = '−'; // U+2212 — typographic minus, aligns with tabular numerals

export interface RationaleCaption {
  text: string;
  spoken: string;
}

/**
 * Translate the engine's suggestion (values + basis) into the line the user
 * sees/hears. Returns null when there is no suggestion (no history) or when
 * the user already edited the target — their own number speaks for itself.
 */
export function describeSuggestion(
  suggestion: { values: Record<string, number>; basis: Record<string, SuggestionBasis> },
  currentValues: Record<string, FieldValue>,
): RationaleCaption | null {
  const keys = Object.keys(suggestion.values);
  if (keys.length === 0) return null;

  const edited = keys.some((k) => currentValues[k] !== suggestion.values[k]);
  if (edited) return null;

  const kg = stripZero(WEIGHT_NUDGE_KG);
  switch (suggestion.basis['weight']) {
    case 'nudge-up':
      return {
        text: `Sugerido +${kg} kg · la última fue fácil`,
        spoken: `Objetivo sugerido, ${kg} kilos más que la última porque la última serie fue fácil`,
      };
    case 'nudge-down':
      return {
        text: `Sugerido ${MINUS}${kg} kg · la última costó`,
        spoken: `Objetivo sugerido, ${kg} kilos menos que la última porque la última serie costó`,
      };
    default:
      // weight carry-forward, or no weight field at all (reps/pace carry).
      return {
        text: 'Sugerido · igual que la última',
        spoken: 'Objetivo sugerido, igual que la última vez',
      };
  }
}

/**
 * The INTRA-session advisor's line (BRIEF-06): "la serie anterior", not "la
 * última [sesión]" — the reference is the set just done, minutes ago.
 */
export function describeInSessionNudge(nudge: InSessionNudge): RationaleCaption {
  const kg = stripZero(Math.abs(nudge.deltaKg));
  return nudge.reason === 'easy'
    ? {
        text: `Sugerido +${kg} kg · la serie anterior fue fácil`,
        spoken: `Objetivo sugerido, ${kg} kilos más porque la serie anterior fue fácil`,
      }
    : {
        text: `Sugerido ${MINUS}${kg} kg · la serie anterior costó`,
        spoken: `Objetivo sugerido, ${kg} kilos menos porque la serie anterior costó`,
      };
}
