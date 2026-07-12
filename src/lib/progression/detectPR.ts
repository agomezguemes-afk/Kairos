// KAIROS — Progression engine: per-field PR detection.
//
// Compares a just-completed value against the historical best for one
// exercise+field. Generalized across modalities: weight/reps/distance/calories
// are higher-is-better, pace is lower-is-better (a faster min/km). Fields that
// don't track PRs (heartRate, rir, duration…) return null.
//
// First-ever performance is NOT a PR — there is nothing to beat. This mirrors
// the in-session weight×reps detector (components/workout/lib/prDetection.ts),
// which this module complements: that one fires the live badge for lifts, this
// one is the general per-field engine the M4-UI PR moment will read for any
// modality (fastest 500 m, longest row, most calories).

import { prFieldDirection } from './modality';
import type { ExerciseHistory, PRDetection } from './types';

/** Collect every historical value recorded for `field`, across all sessions. */
function priorValues(history: ExerciseHistory, field: string): number[] {
  const out: number[] = [];
  for (const session of history.sessions) {
    for (const s of session.sets) {
      const v = s.values[field];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out.push(v);
    }
  }
  return out;
}

/**
 * Detect whether `value` is a personal record for `field` given the exercise's
 * history. Returns null when the field doesn't track PRs, the value is invalid,
 * there is no prior history, or the value fails to beat the best.
 */
export function detectPR(input: {
  field: string;
  value: number;
  history: ExerciseHistory;
}): PRDetection | null {
  const { field, value, history } = input;
  const direction = prFieldDirection(field);
  if (!direction) return null;
  if (!Number.isFinite(value) || value <= 0) return null;

  const prior = priorValues(history, field);
  if (prior.length === 0) return null; // nothing to beat → first time isn't a PR

  const previousBest = direction === 'higher' ? Math.max(...prior) : Math.min(...prior);
  const isPR = direction === 'higher' ? value > previousBest : value < previousBest;
  if (!isPR) return null;

  return {
    field,
    direction,
    value,
    previousBest,
    delta: Math.round(Math.abs(value - previousBest) * 100) / 100,
  };
}
