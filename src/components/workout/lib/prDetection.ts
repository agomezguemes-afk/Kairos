// Live PR detection for the active workout — the single source of PR truth for
// the in-session badge.
//
// Consolidation (M4-UI): the previous version understood weight×reps only and
// matched history by exerciseId — so it never fired for endurance work, nor for
// the fresh exercise ids that Kai-built blocks carry. This wraps the generalized
// per-field engine (src/lib/progression/detectPR) as the ONE detection source:
//   - endurance PRs (fastest pace, farthest distance, most calories) come
//     straight from the per-field engine,
//   - strength keeps its composite semantics (max weight, most reps AT your top
//     weight, biggest set by volume) because those can't be expressed as a pure
//     per-field compare — "reps at this weight" is the canonical lifting PR and
//     an all-time reps compare would be silently killed by high-rep warmups.
// Both branches read ONE digested history (libraryId › normalized name), so the
// old exerciseId-only match is retired and cross-block / Kai-built blocks work.
//
// Result priority mirrors the old detector for strength (weight › reps › volume)
// and appends endurance, so no strength badge that fired before stops firing.

import type { FieldValue, FieldDefinition } from '../../../types/core';
import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import { readExerciseHistory, detectPR as detectFieldPR } from '../../../lib/progression';
import type { ExerciseHistory } from '../../../lib/progression';

export type PRKind =
  | 'max-weight'
  | 'max-reps-at-weight'
  | 'max-volume-set'
  | 'fastest-pace'
  | 'longest-distance'
  | 'most-calories';

export interface PRResult {
  kind: PRKind;
  /** Positive magnitude for the headline (+2.5 kg, +1 rep, −8 s/km…). */
  delta: number;
  /** Display unit for the delta ('kg', 'rep', 'kg·rep', or the field's unit). */
  unit: string;
}

/** Endurance fields checked, in display priority, once strength has passed. */
const ENDURANCE_PR_FIELDS = ['distance', 'calories', 'pace'] as const;
type EnduranceField = (typeof ENDURANCE_PR_FIELDS)[number];

function num(v: FieldValue | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Prior strength bests, from the digested (already exclude-filtered) history. */
interface StrengthBests {
  maxWeight: number;
  repsAtWeight: Map<number, number>;
  maxVolume: number;
  saw: boolean;
}

function strengthBests(history: ExerciseHistory): StrengthBests {
  const repsAtWeight = new Map<number, number>();
  let maxWeight = 0;
  let maxVolume = 0;
  let saw = false;
  for (const session of history.sessions) {
    for (const s of session.sets) {
      const w = num(s.values['weight']);
      const r = num(s.values['reps']);
      if (w == null || r == null || w <= 0 || r <= 0) continue;
      saw = true;
      if (w > maxWeight) maxWeight = w;
      const cur = repsAtWeight.get(w) ?? 0;
      if (r > cur) repsAtWeight.set(w, r);
      const vol = w * r;
      if (vol > maxVolume) maxVolume = vol;
    }
  }
  return { maxWeight, repsAtWeight, maxVolume, saw };
}

function detectStrengthPR(weight: number, reps: number, bests: StrengthBests): PRResult | null {
  if (!bests.saw) return null; // no prior strength history → first set isn't a PR
  if (weight > bests.maxWeight) {
    return { kind: 'max-weight', delta: round(weight - bests.maxWeight), unit: 'kg' };
  }
  if (weight >= bests.maxWeight) {
    const prev = bests.repsAtWeight.get(weight) ?? 0;
    if (reps > prev) return { kind: 'max-reps-at-weight', delta: reps - prev, unit: 'rep' };
  }
  const vol = weight * reps;
  if (vol > bests.maxVolume) {
    return { kind: 'max-volume-set', delta: round(vol - bests.maxVolume), unit: 'kg·rep' };
  }
  return null;
}

function enduranceKind(field: EnduranceField): PRKind {
  if (field === 'distance') return 'longest-distance';
  if (field === 'calories') return 'most-calories';
  return 'fastest-pace';
}

/**
 * Detect the single best personal record for a just-completed set. Strength
 * composites take priority (weight › reps-at-weight › volume), then endurance
 * per-field PRs (distance › calories › pace). Returns null when nothing beats
 * history, when there's no prior history to beat, or when values are invalid.
 */
export function detectPR(input: {
  exercise: { id: string; name: string; libraryId?: string; fields: FieldDefinition[] };
  /** Full field map of the completed set (persisted values merged with drafts). */
  values: Record<string, FieldValue>;
  history: WorkoutHistoryEntry[];
  /** Exclude the in-progress session's own entry if it has been persisted. */
  excludeEntryId?: string;
}): PRResult | null {
  const { exercise, values, history, excludeEntryId } = input;

  const scoped = excludeEntryId ? history.filter((e) => e.id !== excludeEntryId) : history;
  const digested = readExerciseHistory(scoped, {
    name: exercise.name,
    libraryId: exercise.libraryId,
  });

  // --- Strength branch: preserved composite semantics ---
  const weight = num(values['weight']);
  const reps = num(values['reps']);
  if (weight != null && weight > 0 && reps != null && reps > 0) {
    const pr = detectStrengthPR(weight, reps, strengthBests(digested));
    if (pr) return pr;
  }

  // --- Endurance branch: generalized per-field engine ---
  const defines = new Set(exercise.fields.map((f) => f.id));
  for (const field of ENDURANCE_PR_FIELDS) {
    if (!defines.has(field)) continue;
    const v = num(values[field]);
    if (v == null) continue;
    const pr = detectFieldPR({ field, value: v, history: digested });
    if (!pr) continue;
    const unit = exercise.fields.find((f) => f.id === field)?.unit;
    return { kind: enduranceKind(field), delta: pr.delta, unit: unit ?? '' };
  }

  return null;
}

function stripTrailingZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/** Format a pace improvement as whole seconds saved per unit distance. */
function formatPaceDelta(delta: number, unit: string): string {
  const secs = Math.round(delta * 60);
  const denom = unit.includes('/') ? `/${unit.split('/')[1]}` : '';
  return `-${secs} s${denom}`;
}

/** Short user-facing delta: "+2.5 kg", "+1 rep", "+0.5 km", "-8 s/km". */
export function formatPRDelta(pr: PRResult): string {
  switch (pr.kind) {
    case 'max-weight':
      return `+${stripTrailingZero(pr.delta)} kg`;
    case 'max-reps-at-weight':
      return `+${pr.delta} ${pr.delta === 1 ? 'rep' : 'reps'}`;
    case 'max-volume-set':
      return `Volumen +${stripTrailingZero(pr.delta)}`;
    case 'longest-distance':
    case 'most-calories':
      return pr.unit
        ? `+${stripTrailingZero(pr.delta)} ${pr.unit}`
        : `+${stripTrailingZero(pr.delta)}`;
    case 'fastest-pace':
      return formatPaceDelta(pr.delta, pr.unit);
  }
}

/** Sober label per kind, no exclamations (Kai voice). */
export const PR_LABEL: Record<PRKind, string> = {
  'max-weight': 'Nuevo máximo',
  'max-reps-at-weight': 'Reps al máximo',
  'max-volume-set': 'Set más alto',
  'fastest-pace': 'Ritmo más rápido',
  'longest-distance': 'Distancia más larga',
  'most-calories': 'Más calorías',
};
