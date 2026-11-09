// n-of-1 experiments. An accepted suggestion is not a one-off edit: it is a
// hypothesis ("you can handle 42.5 kg for 4×10") with a review date. At
// review the engine compares what the logs show with what the user says,
// keeps or reverts the change, and records whether this *kind* of change
// works for this person. That record (the response profile) is what makes
// the next proposals personal instead of textbook.

import { getMovement } from './catalog';
import type {
  MovementLog,
  MovementTarget,
  SessionLog,
  Suggestion,
  SuggestionKind,
  ValueSnapshot,
} from './types';

export type Verdict = 'yes' | 'partly' | 'no';
export type Feel = 'easy' | 'ok' | 'hard' | 'pain';
export type ExperimentStatus = 'running' | 'review' | 'kept' | 'reverted';

export interface ExperimentAnswers {
  /** Did you do it as proposed? */
  did: Verdict;
  /** Did you hit the target? */
  achieved: Verdict;
  feel: Feel;
}

export interface Experiment {
  id: string;
  suggestionId: string;
  kind: SuggestionKind;
  /** The movement whose logs decide the outcome (the replacement for swaps). */
  movementId: string;
  draftSessionId?: string;
  startedAt: string;
  /** Review opens at this date even without enough exposures. */
  reviewAfter: string;
  minExposures: number;
  baseline?: ValueSnapshot;
  target?: ValueSnapshot;
  status: ExperimentStatus;
  objective?: ObjectiveResult;
  answers?: ExperimentAnswers;
  success?: boolean;
  closedAt?: string;
}

export interface ObjectiveResult {
  verdict: Verdict | 'unknown';
  exposures: number;
  evidence: string[];
}

const DAY_MS = 86_400_000;
export const REVIEW_DAYS = 14;
export const MIN_EXPOSURES = 2;

/** Accepted/adjusted suggestion → running experiment. */
export function startExperiment(
  s: Suggestion,
  now: Date = new Date(),
  adjustedTo?: number,
): Experiment {
  const target = s.to && adjustedTo !== undefined ? { ...s.to, value: adjustedTo } : s.to;
  // A hold is a one-week recovery bet; everything else gets two exposures.
  const days = s.kind === 'hold' ? 7 : REVIEW_DAYS;
  return {
    id: `exp:${s.id}`,
    suggestionId: s.id,
    kind: s.kind,
    movementId: s.replacementMovementId ?? s.movementId,
    draftSessionId: s.draftSessionId,
    startedAt: now.toISOString(),
    reviewAfter: new Date(now.getTime() + days * DAY_MS).toISOString(),
    minExposures: s.kind === 'hold' ? 1 : MIN_EXPOSURES,
    baseline: s.from,
    target,
    status: 'running',
  };
}

function exposuresOf(exp: Experiment, sessions: SessionLog[]): MovementLog[] {
  const since = new Date(exp.startedAt).getTime();
  const after = sessions
    .filter((s) => new Date(s.endedAt).getTime() > since)
    .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
  if (exp.kind === 'hold' || exp.kind === 'reduce_days') {
    // Any session counts as an exposure of a whole-week hold.
    return after.map(() => ({ movementId: '', target: {}, sets: [] }));
  }
  return after.flatMap((s) => s.movements.filter((m) => m.movementId === exp.movementId));
}

const pct = (a: number, b: number) => (b > 0 ? a / b : 0);

function grade(ratio: number): Verdict {
  if (ratio >= 0.95) return 'yes';
  if (ratio >= 0.75) return 'partly';
  return 'no';
}

/** What the logs say, independent of how the user felt about it. */
export function objectiveCheck(exp: Experiment, sessions: SessionLog[]): ObjectiveResult {
  const logs = exposuresOf(exp, sessions);
  if (!logs.length) return { verdict: 'unknown', exposures: 0, evidence: [] };
  const last = logs[logs.length - 1];
  const t = exp.target?.value;
  const evidence: string[] = [];

  switch (exp.kind) {
    case 'increase_load':
    case 'deload':
    case 'add_reps':
    case 'add_set': {
      const goalSets = last.target.sets ?? last.sets.length;
      const min = last.target.repsMin ?? 1;
      const good = last.sets.filter(
        (s) =>
          s.completed &&
          (s.reps ?? 0) >= min &&
          (t === undefined || exp.kind !== 'increase_load' || (s.loadKg ?? 0) >= t - 0.01),
      ).length;
      evidence.push(`Última vez: ${good}/${goalSets} series válidas${t ? ` a ${t} kg` : ''}`);
      return { verdict: grade(pct(good, goalSets)), exposures: logs.length, evidence };
    }
    case 'extend_duration': {
      const min = Math.max(...last.sets.map((s) => (s.durationSec ?? 0) / 60));
      evidence.push(`Última vez: ${Math.round(min)} min de ${t ?? '?'}`);
      return { verdict: t ? grade(pct(min, t)) : 'unknown', exposures: logs.length, evidence };
    }
    case 'extend_distance': {
      const km = Math.max(...last.sets.map((s) => s.distanceKm ?? 0));
      evidence.push(`Última vez: ${km} km de ${t ?? '?'}`);
      return { verdict: t ? grade(pct(km, t)) : 'unknown', exposures: logs.length, evidence };
    }
    case 'add_interval': {
      const done = last.sets.filter((s) => s.completed).length;
      evidence.push(`Última vez: ${done} de ${t ?? last.sets.length} intervalos`);
      return {
        verdict: grade(pct(done, t ?? last.sets.length)),
        exposures: logs.length,
        evidence,
      };
    }
    case 'new_movement': {
      // For a new stimulus, sticking with it is the outcome that matters.
      const m = getMovement(exp.movementId);
      evidence.push(
        `${m?.name ?? 'Ejercicio'} hecho ${logs.length} ${logs.length === 1 ? 'vez' : 'veces'}`,
      );
      return {
        verdict: logs.length >= exp.minExposures ? 'yes' : 'partly',
        exposures: logs.length,
        evidence,
      };
    }
    case 'reduce_days':
      // Whether a lighter plan suits you is a judgement only you can make.
      return { verdict: 'unknown', exposures: logs.length, evidence };
    case 'hold': {
      const rpes = sessions
        .filter((s) => new Date(s.endedAt).getTime() > new Date(exp.startedAt).getTime())
        .map((s) => s.rpe);
      const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
      evidence.push(`Esfuerzo medio esta semana: ${avg.toFixed(1)}/10`);
      return {
        verdict: avg <= 6.5 ? 'yes' : avg <= 7.5 ? 'partly' : 'no',
        exposures: rpes.length,
        evidence,
      };
    }
  }
}

export function isDueForReview(exp: Experiment, sessions: SessionLog[], now: Date): boolean {
  if (exp.status !== 'running') return false;
  const n = exposuresOf(exp, sessions).length;
  return n >= exp.minExposures || now.getTime() >= new Date(exp.reviewAfter).getTime();
}

/**
 * Close an experiment. Pain always reverts. Otherwise the logs decide when
 * they can; the user's word decides when the logs can't (no exposures, or
 * a kind the logs only partly capture).
 */
export function resolveExperiment(
  exp: Experiment,
  answers: ExperimentAnswers,
  objective: ObjectiveResult,
  now: Date = new Date(),
): Experiment {
  let success: boolean;
  if (answers.feel === 'pain' || answers.did === 'no') success = false;
  else if (objective.verdict === 'yes') success = answers.achieved !== 'no';
  else if (objective.verdict === 'no') success = false;
  else success = answers.achieved === 'yes' && answers.feel !== 'hard';
  return {
    ...exp,
    answers,
    objective,
    success,
    status: success ? 'kept' : 'reverted',
    closedAt: now.toISOString(),
  };
}

/** Plan patch that undoes a reverted change, when the change is reversible. */
export function revertPatch(exp: Experiment): Partial<MovementTarget> | null {
  const v = exp.baseline?.value;
  if (v === undefined) return null;
  switch (exp.kind) {
    case 'increase_load':
    case 'deload':
      return { loadKg: v };
    case 'extend_duration':
      return { durationMin: v };
    case 'extend_distance':
      return { distanceKm: v };
    default:
      return null;
  }
}

// ── Response profile ────────────────────────────────────────────────

export interface KindStats {
  tried: number;
  worked: number;
  /** Posterior mean of a Beta(2,2) prior: starts neutral at 0.5. */
  affinity: number;
}

export type ResponseProfile = Partial<Record<SuggestionKind, KindStats>>;

export function responseProfile(experiments: Experiment[]): ResponseProfile {
  const out: ResponseProfile = {};
  for (const e of experiments) {
    if (e.status !== 'kept' && e.status !== 'reverted') continue;
    const k = (out[e.kind] ??= { tried: 0, worked: 0, affinity: 0.5 });
    k.tried += 1;
    if (e.success) k.worked += 1;
  }
  for (const k of Object.values(out)) {
    if (k) k.affinity = (2 + k.worked) / (4 + k.tried);
  }
  return out;
}

export function affinityOf(profile: ResponseProfile | undefined, kind: SuggestionKind): number {
  return profile?.[kind]?.affinity ?? 0.5;
}

/** A kind has proven not to work for this person once it fails this often. */
export function isUnresponsive(
  profile: ResponseProfile | undefined,
  kind: SuggestionKind,
): boolean {
  const k = profile?.[kind];
  return !!k && k.tried >= 3 && k.affinity < 0.4;
}
