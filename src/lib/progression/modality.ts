// KAIROS — Progression engine: modality classification + field helpers.
//
// Classification is intentionally field-driven (not discipline-driven): a
// "strength" block can contain an erg piece, and a hybrid card mixes both. We
// read the exercise's own dynamic fields, exactly as the mission pins it:
//   weight/reps → strength · pace/distance/calories → endurance.

import type { FieldDefinition } from '../../types/core';
import type { Modality, PRDirection } from './types';

const STRENGTH_FIELD_IDS = new Set(['weight', 'reps']);
const ENDURANCE_FIELD_IDS = new Set(['pace', 'distance', 'calories']);

/**
 * Classify an exercise's modality from its field ids. Mixed-field exercises
 * (both a strength and an endurance signal) are 'hybrid' — the HYROX case is
 * first-class, not an edge to paper over. Neither signal → 'unknown' (pure
 * mobility, custom-only cards): carried forward without a nudge.
 */
export function classifyModality(fields: FieldDefinition[]): Modality {
  let strength = false;
  let endurance = false;
  for (const f of fields) {
    if (STRENGTH_FIELD_IDS.has(f.id)) strength = true;
    if (ENDURANCE_FIELD_IDS.has(f.id)) endurance = true;
  }
  if (strength && endurance) return 'hybrid';
  if (strength) return 'strength';
  if (endurance) return 'endurance';
  return 'unknown';
}

// PR direction per field. A field absent from this map does NOT track PRs
// (heartRate, rir, perceivedEffort, duration, rpe are subjective or ambiguous —
// a longer slow run is not a "duration PR"). Conservative on purpose in v1;
// widening this map is the only change needed to track more PRs later.
const PR_FIELD_DIRECTION: Record<string, PRDirection> = {
  weight: 'higher',
  reps: 'higher',
  distance: 'higher',
  calories: 'higher',
  progression: 'higher',
  pace: 'lower', // min/km — faster is a better time
};

/** PR direction for a field id, or null when the field doesn't track PRs. */
export function prFieldDirection(fieldId: string): PRDirection | null {
  return PR_FIELD_DIRECTION[fieldId] ?? null;
}

// "Press banca · 2/3" (superset cycle naming) → "press banca"; collapse
// whitespace so user-typed duplicates still correlate. Kept identical to the
// active-workout resolver so history matches consistently across the app.
export function normalizeExerciseName(name: string): string {
  return name
    .replace(/\s*·\s*\d+\/\d+\s*$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
