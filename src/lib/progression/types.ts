// KAIROS — Progression engine: shared types.
//
// "Memoria que compone": the next session opens visibly smarter. These types
// describe the compact, per-exercise view of history the engine reads, and the
// suggestions it produces. Pure data — no store, no transport. The store's
// WorkoutHistoryEntry is the raw input; ExerciseHistory is the digested,
// exercise-scoped shape the pure functions operate on.

/**
 * Coarse training modality, classified from an exercise's dynamic fields.
 *   - strength:  has weight and/or reps (and no endurance field)
 *   - endurance: has pace/distance/calories (and no strength field)
 *   - hybrid:    has both (sled push = weight + distance; cal row = reps + cal)
 *   - unknown:   neither signal (pure mobility: duration + feeling, custom-only)
 * Hybrid sessions ARE the product — mixed-field exercises resolve to 'hybrid'.
 */
export type Modality = 'strength' | 'endurance' | 'hybrid' | 'unknown';

/** Identity used to match one exercise across sessions. */
export interface ExerciseRef {
  /** Display name — matched via normalized form (case/whitespace-insensitive). */
  name: string;
  /** Stable library identity when cloned from the library; wins over name. */
  libraryId?: string;
}

/** One completed set's numeric field values, lifted from history. */
export interface HistoricalSet {
  /** fieldId → numeric value. Non-numeric / empty fields are omitted. */
  values: Record<string, number>;
  /** RPE 1..10 if the set was rated. Drives the strength nudge. */
  rpe?: number;
}

/** One past session that contained the exercise, completed sets only. */
export interface HistoricalSession {
  /** ms epoch when the session ended. */
  performedAt: number;
  blockName?: string;
  /** Completed sets, in performed order. Never empty (empty sessions dropped). */
  sets: HistoricalSet[];
}

/** All prior performances of one exercise, most-recent session first. */
export interface ExerciseHistory {
  /** Normalized name used as the match key. */
  key: string;
  libraryId?: string;
  sessions: HistoricalSession[];
}

/** How a suggested value was arrived at — surfaced as a UI chip later. */
export type SuggestionBasis = 'carry-forward' | 'nudge-up' | 'nudge-down';

/** Pre-fill suggestion for one exercise. */
export interface SuggestedValues {
  modality: Modality;
  /** fieldId → suggested numeric value. Empty when there's no usable history. */
  values: Record<string, number>;
  /** fieldId → basis, parallel to `values`. */
  basis: Record<string, SuggestionBasis>;
  /** The reference session the carry-forward came from, or null. */
  reference: { performedAt: number; blockName?: string } | null;
}

/** Direction that counts as an improvement for a given field. */
export type PRDirection = 'higher' | 'lower';

/** A detected personal record on a single exercise+field. */
export interface PRDetection {
  field: string;
  direction: PRDirection;
  /** The new best (the value just completed). */
  value: number;
  /** The best prior to this value. */
  previousBest: number;
  /** Positive magnitude of the improvement (|value − previousBest|). */
  delta: number;
}
