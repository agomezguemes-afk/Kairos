// Detect personal records the instant a set is logged.
// PR categories (in priority order — first match wins):
//   - max-weight: weight > all prior completed sets for this exerciseId
//   - max-weight-reps: weight ≥ prior max-weight AND reps > prior reps at that weight
//   - max-volume-set: weight×reps > prior best weight×reps
// We compare against ExerciseHistorySummary.performedSets across all history.
// "Prior" excludes the just-completed set (caller should pass the entry id of
// the in-progress session if it has been persisted; otherwise pass undefined).

import type { WorkoutHistoryEntry } from '../../../store/workoutStore';

export type PRKind = 'max-weight' | 'max-reps-at-weight' | 'max-volume-set';

export interface PRResult {
  kind: PRKind;
  /** Numeric delta for headline. e.g., +2.5 (kg) for max-weight; +1 (rep) for reps. */
  delta: number;
  /** Units string. */
  unit: 'kg' | 'rep' | 'kg·rep';
}

export interface CompletedSetInput {
  weight: number | null;
  reps: number | null;
}

export function detectPR(input: {
  exerciseId: string;
  set: CompletedSetInput;
  history: WorkoutHistoryEntry[];
  excludeEntryId?: string;
}): PRResult | null {
  const { exerciseId, set, history, excludeEntryId } = input;
  if (set.weight == null || set.weight <= 0) return null;
  if (set.reps == null || set.reps <= 0) return null;

  let priorMaxWeight = 0;
  let priorMaxRepsAtWeight = new Map<number, number>(); // weight → maxReps at that weight
  let priorMaxVolume = 0;
  // "sawHistory" = we have at least one prior entry recording this exercise
  // (even if all its sets were skipped/uncompleted). A truly first-ever set
  // with no exercise history at all is NOT a PR — there's nothing to beat.
  let sawHistory = false;

  for (const entry of history) {
    if (entry.id === excludeEntryId) continue;
    const exHist = entry.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exHist) continue;
    sawHistory = true;
    if (!exHist.performedSets) continue;
    for (const ps of exHist.performedSets) {
      if (!ps.completed) continue;
      if (ps.weight == null || ps.reps == null) continue;
      if (ps.weight <= 0 || ps.reps <= 0) continue;
      if (ps.weight > priorMaxWeight) priorMaxWeight = ps.weight;
      const cur = priorMaxRepsAtWeight.get(ps.weight) ?? 0;
      if (ps.reps > cur) priorMaxRepsAtWeight.set(ps.weight, ps.reps);
      const vol = ps.weight * ps.reps;
      if (vol > priorMaxVolume) priorMaxVolume = vol;
    }
  }

  // No prior history at all for this exercise → first set isn't a PR.
  if (!sawHistory) return null;

  // 1. Max weight PR.
  if (set.weight > priorMaxWeight) {
    return { kind: 'max-weight', delta: round(set.weight - priorMaxWeight), unit: 'kg' };
  }

  // 2. Max reps at this weight (only when weight matches or exceeds prior max).
  if (set.weight >= priorMaxWeight) {
    const prevRepsHere = priorMaxRepsAtWeight.get(set.weight) ?? 0;
    if (set.reps > prevRepsHere) {
      return { kind: 'max-reps-at-weight', delta: set.reps - prevRepsHere, unit: 'rep' };
    }
  }

  // 3. Max volume set.
  const vol = set.weight * set.reps;
  if (vol > priorMaxVolume) {
    return { kind: 'max-volume-set', delta: round(vol - priorMaxVolume), unit: 'kg·rep' };
  }

  return null;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Short user-facing label: "+2.5 kg", "+1 rep", "Volumen +25". */
export function formatPRDelta(pr: PRResult): string {
  const prefix = pr.delta > 0 ? '+' : '';
  if (pr.unit === 'kg') return `${prefix}${stripTrailingZero(pr.delta)} kg`;
  if (pr.unit === 'rep') return `${prefix}${pr.delta} ${pr.delta === 1 ? 'rep' : 'reps'}`;
  return `Volumen ${prefix}${stripTrailingZero(pr.delta)}`;
}

function stripTrailingZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

/** Sober label per kind, no exclamations. */
export const PR_LABEL: Record<PRKind, string> = {
  'max-weight':         'Nuevo máximo',
  'max-reps-at-weight': 'Reps al máximo',
  'max-volume-set':     'Set más alto',
};
