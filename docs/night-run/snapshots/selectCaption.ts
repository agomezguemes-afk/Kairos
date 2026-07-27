// KAIROS — Modo Sesión: qué caption gana bajo el objetivo gigante.
//
// Nine features stack on ActiveWorkoutScreen; this is the one precedence rule
// most prone to a silent regression: nudge intra-sesión (06) > sugerido
// entre-sesiones (05) > nada. Lived inline in a useMemo of the screen (where
// vitest can't reach it because it doesn't render). Extracted here as a single,
// pure source of truth. Spec: docs/night-run/BRIEF-10.md.

import type { FieldValue } from '../../../types/core';
import type { InSessionNudge, SuggestionBasis } from '../../../lib/progression';
import { describeSuggestion, describeInSessionNudge, type RationaleCaption } from './suggestionRationale';

export interface CaptionInput {
  changing: boolean;
  inSessionNudge: InSessionNudge | null;
  suggestion: { values: Record<string, number>; basis: Record<string, SuggestionBasis> } | null;
  currentValues: Record<string, FieldValue>; // { ...currentSet.values, ...draftValues }
}

// Precedencia: en cambio de ejercicio, nada. Si hay nudge intra-sesión, manda
// (y se oculta si el usuario editó el peso lejos del sugerido). Si no, cae al
// sugerido entre-sesiones. null = sin caption.
export function selectSuggestionCaption(input: CaptionInput): RationaleCaption | null {
  if (input.changing) return null;
  if (input.inSessionNudge) {
    return input.currentValues['weight'] === input.inSessionNudge.nextWeight
      ? describeInSessionNudge(input.inSessionNudge)
      : null;
  }
  if (input.suggestion) return describeSuggestion(input.suggestion, input.currentValues);
  return null;
}
