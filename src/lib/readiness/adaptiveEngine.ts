// KAIROS — Adaptive Readiness Engine (Phase 1)
//
// Fuses a personal HRV/sleep baseline with the existing training-load
// signals (readiness.ts), the user's stated goal, and real adherence, into
// a single AdaptationSignal. Every function here is pure, deterministic
// arithmetic (mean/stddev/z-score/weighted average) — no ML, no trained
// model. See docs/superpowers/specs/2026-07-23-adaptive-readiness-design.md.
//
// Deliberately decoupled from readiness.ts (no import in either direction
// except readiness.ts → this module) so there's no circular dependency:
// readiness.ts calls into this engine, this engine never reaches back.

import type { BiometricSample } from '../health/types';
import type { FitnessGoal } from '../../types/profile';

const MS_PER_DAY = 24 * 3600 * 1000;
const BASELINE_WINDOW_DAYS = 14;
const MIN_CONFIDENT_SAMPLES = 7;

export interface BiometricBaseline {
  hrvMean: number | null;
  hrvStdDev: number | null;
  sleepMean: number | null;
  sleepStdDev: number | null;
  /** The LESSER of the two metrics' non-null counts — honest confidence,
   *  never overclaimed when one metric is entirely unmeasured. */
  sampleCount: number;
  confident: boolean;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function finiteNumbers(values: (number | null)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Compute the personal baseline from the trailing BASELINE_WINDOW_DAYS of
 * samples. `now` exposed so tests can pin time.
 */
export function computeBiometricBaseline(
  samples: BiometricSample[],
  now = Date.now(),
): BiometricBaseline {
  const cutoff = now - BASELINE_WINDOW_DAYS * MS_PER_DAY;
  const inWindow = samples.filter((s) => new Date(s.date).getTime() >= cutoff);

  const hrvValues = finiteNumbers(inWindow.map((s) => s.hrvMs));
  const sleepValues = finiteNumbers(inWindow.map((s) => s.sleepHours));

  const hrvMean = hrvValues.length > 0 ? mean(hrvValues) : null;
  const sleepMean = sleepValues.length > 0 ? mean(sleepValues) : null;
  const sampleCount = Math.min(hrvValues.length, sleepValues.length);

  return {
    hrvMean,
    hrvStdDev: hrvMean != null ? stdDev(hrvValues, hrvMean) : null,
    sleepMean,
    sleepStdDev: sleepMean != null ? stdDev(sleepValues, sleepMean) : null,
    sampleCount,
    confident: sampleCount >= MIN_CONFIDENT_SAMPLES,
  };
}

const Z_SCORE_CLAMP = 2;

/** null when stdDev is 0 — no variance to compare against, so no signal. */
function zScoreNormalized(
  value: number,
  baselineMean: number,
  baselineStdDev: number,
): number | null {
  if (baselineStdDev === 0) return null;
  const z = (value - baselineMean) / baselineStdDev;
  const clamped = Math.max(-Z_SCORE_CLAMP, Math.min(Z_SCORE_CLAMP, z));
  return clamped / Z_SCORE_CLAMP; // → [-1, 1]
}

export interface RecoverySample {
  hrvMs: number | null;
  sleepHours: number | null;
}

/**
 * Score today's recovery relative to the personal baseline, in [-1, 1].
 * Returns null when neither metric has both a today-value and a baseline
 * mean/stdDev — missing data must never be reported as "average" (0).
 */
export function scoreRecoverySignal(
  today: RecoverySample,
  baseline: BiometricBaseline,
): number | null {
  const scores: number[] = [];

  if (typeof today.hrvMs === 'number' && baseline.hrvMean != null && baseline.hrvStdDev != null) {
    const z = zScoreNormalized(today.hrvMs, baseline.hrvMean, baseline.hrvStdDev);
    if (z != null) scores.push(z);
  }
  if (
    typeof today.sleepHours === 'number' &&
    baseline.sleepMean != null &&
    baseline.sleepStdDev != null
  ) {
    const z = zScoreNormalized(today.sleepHours, baseline.sleepMean, baseline.sleepStdDev);
    if (z != null) scores.push(z);
  }

  if (scores.length === 0) return null;
  return mean(scores);
}

/**
 * Maps the existing training-load dimensions (each 0-100, from
 * readiness.ts's energia/fuerza/recuperacion) onto the same [-1, 1] scale
 * the fusion works in. Takes plain numbers, not a ReadinessSnapshot import —
 * keeps this module decoupled from readiness.ts (which depends on this
 * module, not the other way around).
 */
export function deriveTrainingLoadSignal(
  energia: number,
  fuerza: number,
  recuperacion: number,
): number {
  const avg = (energia + fuerza + recuperacion) / 3;
  return Math.max(-1, Math.min(1, (avg - 50) / 50));
}

/**
 * Adherence signal in [-1, 0] from real behavior — no biometrics needed.
 * Under-training relative to weeklyFrequency nudges toward "ease back in
 * gently"; over-training nudges toward caution. Adherence never pushes the
 * fused signal positive on its own — it only ever flags a reason for
 * caution or neutrality, matching the "never invent a push" rule (spec §6.2).
 */
export function scoreAdherence(sessionsLast7Days: number, weeklyFrequency: number | null): number {
  if (weeklyFrequency == null || weeklyFrequency <= 0) return 0;
  const ratio = sessionsLast7Days / weeklyFrequency;
  if (ratio < 0.5) return -0.6;
  if (ratio < 0.85) return -0.2;
  if (ratio <= 1.3) return 0;
  return -0.4;
}

interface GoalResponseCurve {
  down: number;
  up: number;
}

/** Asymmetric response per goal: `down` scales a negative (deload) signal,
 *  `up` scales a positive (push) signal. Strength/muscle_gain react faster
 *  to back off than to push (protect PRs/CNS); wellness/flexibility are
 *  gentler both ways. */
const GOAL_RESPONSE: Record<FitnessGoal, GoalResponseCurve> = {
  strength: { down: 1.3, up: 0.7 },
  muscle_gain: { down: 1.2, up: 0.8 },
  endurance: { down: 1.0, up: 1.0 },
  wellness: { down: 0.9, up: 0.9 },
  weight_loss: { down: 1.0, up: 1.0 },
  flexibility: { down: 0.8, up: 0.8 },
};

const NEUTRAL_CURVE: GoalResponseCurve = { down: 1.0, up: 1.0 };

function applyGoalCurve(value: number, goal: FitnessGoal | null): number {
  const curve = goal ? GOAL_RESPONSE[goal] : NEUTRAL_CURVE;
  const scaled = value < 0 ? value * curve.down : value * curve.up;
  return Math.max(-1, Math.min(1, scaled));
}

const FUSION_WEIGHTS = { recovery: 0.5, load: 0.3, adherence: 0.2 } as const;

export interface AdaptationInputs {
  recoverySignal: number | null;
  recoveryConfident: boolean;
  trainingLoadSignal: number;
  /** False only for a brand-new user with zero workout history. */
  hasTrainingHistory: boolean;
  adherenceSignal: number;
  goal: FitnessGoal | null;
}

export interface AdaptationSignal {
  /** -1 (strongly deload) .. 0 (neutral) .. +1 (cleared to push) */
  value: number;
  confidence: 'low' | 'medium' | 'high';
  /** Which input most drove the value — for grounded, non-generic copy. */
  dominant: 'recovery' | 'load' | 'adherence' | 'neutral';
}

/** Fuses recovery + training load + adherence into one signal, then applies
 *  the goal-weighted response curve. See spec §5.5 for the full rationale. */
export function computeAdaptationSignal(inputs: AdaptationInputs): AdaptationSignal {
  type ComponentKey = 'recovery' | 'load' | 'adherence';
  const components: { key: ComponentKey; value: number; weight: number }[] = [];

  if (inputs.recoverySignal != null && inputs.recoveryConfident) {
    components.push({
      key: 'recovery',
      value: inputs.recoverySignal,
      weight: FUSION_WEIGHTS.recovery,
    });
  }
  components.push({ key: 'load', value: inputs.trainingLoadSignal, weight: FUSION_WEIGHTS.load });
  components.push({
    key: 'adherence',
    value: inputs.adherenceSignal,
    weight: FUSION_WEIGHTS.adherence,
  });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const fused = components.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight;
  const value = applyGoalCurve(fused, inputs.goal);

  const dominant = components.reduce<{ key: AdaptationSignal['dominant']; contribution: number }>(
    (best, c) => {
      const contribution = Math.abs(c.value * c.weight);
      return contribution > best.contribution ? { key: c.key, contribution } : best;
    },
    { key: 'neutral', contribution: 0 },
  ).key;

  const confidence: AdaptationSignal['confidence'] =
    inputs.recoverySignal != null && inputs.recoveryConfident
      ? 'high'
      : inputs.hasTrainingHistory
        ? 'medium'
        : 'low';

  return { value, confidence, dominant };
}
