// WorkoutSummary pure-core — the verifiable heart of the end-of-session payoff.
//
// Extracted verbatim from WorkoutSummary.tsx so the PR loop and its label
// formatters can be tested without the React hook that owns the history index.
// `buildSessionPrs` takes an injectable `lookup` so the component keeps passing
// `(ref) => lookupExerciseHistory(ref, historyIndex)` while tests pass a stub.
//
// Behavior is IDENTICAL to the previous inline code — same PRs, same order.

import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import {
  detectPr,
  estimateOneRepMax,
  type ExerciseSessionPoint,
  type PrResult,
} from '../../../lib/history/exerciseHistory';
import { formatVolume } from '../../../lib/stats/weekStats';

/** Duration for the stats row: "0s" | "45s" | "5m" | "5m 03s" | "60m". */
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

/** Signed delta with a rounded magnitude. Uses U+2212 (−) for negatives. */
export function signedDelta(n: number, suffix: string): string {
  const rounded = Math.round(n);
  if (rounded > 0) return `+${rounded}${suffix}`;
  if (rounded < 0) return `−${Math.abs(rounded)}${suffix}`;
  return `0${suffix}`;
}

/** Gold PR chip label. Magnitude runs through formatVolume (integer kg). */
export function prDeltaLabel(pr: { kind: PrResult['kind']; delta: number }): string {
  const abs = formatVolume(Math.abs(pr.delta));
  const sign = pr.delta > 0 ? '+' : '−';
  switch (pr.kind) {
    case 'weight':
      return `${sign}${abs} kg`;
    case 'oneRm':
      return `${sign}${abs} kg 1RM`;
    case 'volume':
      return `${sign}${abs} kg vol.`;
    default:
      return '';
  }
}

export interface SummaryPr {
  name: string;
  delta: number;
  kind: PrResult['kind'];
}

/**
 * PRs auto-detected across the just-finished session.
 *
 * `lookup` injects each exercise's prior history — the component passes
 * `(ref) => lookupExerciseHistory(ref, historyIndex)`. The current entry is
 * already in that index (finishWorkout persisted before this runs), so
 * detectPr filters it out by matching `at === candidate.at`.
 *
 * Per-exercise: accumulate volume + top weight/reps from COMPLETED
 * performedSets; skip when there's no signal (topWeight null AND volume 0);
 * build the candidate point; keep the PR when isPr && kind && delta > 0.
 * Traversal order of `entry.exercises` is preserved.
 */
export function buildSessionPrs(
  entry: WorkoutHistoryEntry,
  lookup: (ref: { libraryId?: string; name: string }) => Parameters<typeof detectPr>[1],
): SummaryPr[] {
  const out: SummaryPr[] = [];
  for (const ex of entry.exercises) {
    const performed = ex.performedSets ?? [];
    let topWeight: number | null = null;
    let topReps: number | null = null;
    let volume = 0;
    for (const s of performed) {
      if (!s.completed) continue;
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      volume += w * r;
      if (s.weight != null && (topWeight == null || s.weight > topWeight)) {
        topWeight = s.weight;
        topReps = s.reps;
      }
    }
    if (topWeight == null && volume === 0) continue;

    const candidate: ExerciseSessionPoint = {
      at: entry.endedAt,
      date: new Date(entry.endedAt).toISOString().slice(0, 10),
      topWeight,
      topReps,
      volume,
      setsCompleted: ex.setsCompleted,
      estimatedOneRm: estimateOneRepMax(topWeight, topReps),
      libraryId: ex.libraryId,
    };
    const exHistory = lookup({ libraryId: ex.libraryId, name: ex.name });
    const pr = detectPr(candidate, exHistory);
    if (pr.isPr && pr.kind && pr.delta > 0) {
      out.push({ name: ex.name, delta: pr.delta, kind: pr.kind });
    }
  }
  return out;
}
