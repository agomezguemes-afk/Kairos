// Engine v2 · phase 2 — Banister fitness-fatigue model with a Kalman filter
// over its parameters. Spec: docs/engine/ENGINE-v2.md.
//
// Physiology fixes the structure (two exponentially decaying responses to
// the same impulse, fatigue faster than fitness, non-negative gains) and the
// priors; each person's data fit p0, k1, k2 recursively, with covariance,
// so every output carries its uncertainty.

import { bestSetE1rm, sessionLoad } from '../adaptive/metrics';
import type { SessionLog } from '../adaptive/types';

export const DAY_MS = 86_400_000;

export interface FFParams {
  /** Fitness decay constant (days). Banister 1975; Clarke & Skiba 2013. */
  tau1: number;
  /** Fatigue decay constant (days); must stay below tau1. */
  tau2: number;
}

export const DEFAULT_TAUS: FFParams = { tau1: 42, tau2: 7 };
export const TAU1_GRID = [28, 35, 42, 50];
export const TAU2_GRID = [5, 7, 10];

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

/** θ = [p0, k1, k2] prior (spec §Fase 2). */
const PRIOR_MEAN: Vec3 = [0, 0.05, 0.15];
const PRIOR_COV: Mat3 = [
  [9, 0, 0],
  [0, 0.05 ** 2, 0],
  [0, 0, 0.1 ** 2],
];
/** Daily parameter drift: physiology changes, so the model slowly forgets. */
const Q_DIAG: Vec3 = [0.05 ** 2, 0.0005 ** 2, 0.001 ** 2];
/** Day-to-day noise of the strength index (% squared). */
export const OBS_VAR = 16;

// ── Observations ────────────────────────────────────────────────────

export interface Observation {
  day: number;
  /** Strength index: % above the person's own per-exercise reference. */
  y: number;
}

/**
 * Per-session strength index. Each exercise is scaled against the median
 * e1RM of its first three exposures, so different lifts share one personal
 * scale. Sessions without usable strength sets give no observation.
 */
export function strengthObservations(sessions: SessionLog[], dayOf: (iso: string) => number) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime(),
  );
  const seen = new Map<string, number[]>();
  const out: Observation[] = [];
  for (const s of sorted) {
    const idx: number[] = [];
    for (const m of s.movements) {
      const e = bestSetE1rm(m.sets.filter((x) => (x.reps ?? 99) <= 10));
      if (e === null || e <= 0) continue;
      const hist = seen.get(m.movementId) ?? [];
      hist.push(e);
      seen.set(m.movementId, hist);
      const first = hist.slice(0, 3).sort((a, b) => a - b);
      const ref = first[Math.floor((first.length - 1) / 2)];
      // The reference exposures themselves are informative only once the
      // reference is settled; before that they'd anchor y to ~0 by design.
      if (hist.length > 3) idx.push(100 * (e / ref - 1));
    }
    if (idx.length)
      out.push({ day: dayOf(s.endedAt), y: idx.reduce((a, b) => a + b, 0) / idx.length });
  }
  return out;
}

/** Daily impulse in UA/100 (session-RPE × minutes / 100). */
export function dailyImpulses(sessions: SessionLog[], dayOf: (iso: string) => number) {
  const w = new Map<number, number>();
  for (const s of sessions) {
    const d = dayOf(s.endedAt);
    w.set(d, (w.get(d) ?? 0) + sessionLoad(s) / 100);
  }
  return w;
}

// ── Linear algebra (3×3, enough for θ) ──────────────────────────────

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const matVec = (m: Mat3, v: Vec3): Vec3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const cloneM = (m: Mat3): Mat3 => [[...m[0]], [...m[1]], [...m[2]]] as Mat3;

// ── Filter ──────────────────────────────────────────────────────────

export interface DayState {
  day: number;
  fitness: number;
  fatigue: number;
  /** Predictive mean of the strength index for that day (%). */
  mean: number;
  /** Predictive variance, parameter uncertainty + observation noise. */
  variance: number;
  /** Net form k1·g − k2·h (%), the part training controls. */
  form: number;
  observed?: number;
  /** Prediction made before this day's observation (one step ahead). */
  predicted: number;
  predictedVar: number;
}

export interface FFResult {
  params: FFParams;
  theta: Vec3;
  cov: Mat3;
  days: DayState[];
  observations: number;
  /** Σ log N(innovation; 0, S): model evidence used to pick τ. */
  logLik: number;
}

/**
 * Run the model from the first logged day to `untilDay` (inclusive).
 * Day indices are integers (days since epoch) so gaps are exact.
 */
export function runFitnessFatigue(
  impulses: Map<number, number>,
  observations: Observation[],
  untilDay: number,
  params: FFParams = DEFAULT_TAUS,
): FFResult {
  const startDays = [...impulses.keys(), ...observations.map((o) => o.day)];
  const start = startDays.length ? Math.min(...startDays) : untilDay;
  const obsByDay = new Map<number, number[]>();
  for (const o of observations) obsByDay.set(o.day, [...(obsByDay.get(o.day) ?? []), o.y]);

  const d1 = Math.exp(-1 / params.tau1);
  const d2 = Math.exp(-1 / params.tau2);
  let g = 0;
  let h = 0;
  let theta: Vec3 = [...PRIOR_MEAN];
  let P = cloneM(PRIOR_COV);
  let logLik = 0;
  let n = 0;
  const days: DayState[] = [];

  for (let day = start; day <= untilDay; day++) {
    const w = impulses.get(day) ?? 0;
    g = g * d1 + w;
    h = h * d2 + w;
    for (let i = 0; i < 3; i++) P[i][i] += Q_DIAG[i];
    const phi: Vec3 = [1, g, -h];
    // One-step-ahead prediction, before today's observation updates θ:
    // the honest residual for learning check-in effects (phase 3).
    const predicted = dot(phi, theta);
    const predictedVar = dot(phi, matVec(P, phi)) + OBS_VAR;

    for (const y of obsByDay.get(day) ?? []) {
      const Pphi = matVec(P, phi);
      const S = dot(phi, Pphi) + OBS_VAR;
      const e = y - dot(phi, theta);
      logLik += -0.5 * (Math.log(2 * Math.PI * S) + (e * e) / S);
      const K: Vec3 = [Pphi[0] / S, Pphi[1] / S, Pphi[2] / S];
      theta = [theta[0] + K[0] * e, theta[1] + K[1] * e, theta[2] + K[2] * e];
      // Joseph-free form is fine at this size; symmetrise to keep P PSD.
      const next = cloneM(P);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) next[i][j] = P[i][j] - K[i] * Pphi[j];
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) next[i][j] = next[j][i] = (next[i][j] + next[j][i]) / 2;
      P = next;
      // Physiological constraint: gains can't be negative.
      theta = [theta[0], Math.max(0, theta[1]), Math.max(0, theta[2])];
      n++;
    }

    const varTheta = dot(phi, matVec(P, phi));
    days.push({
      day,
      fitness: g,
      fatigue: h,
      mean: dot(phi, theta),
      variance: varTheta + OBS_VAR,
      form: theta[1] * g - theta[2] * h,
      observed: obsByDay.get(day)?.[0],
      predicted,
      predictedVar,
    });
  }
  return { params, theta, cov: P, days, observations: n, logLik };
}

/**
 * Nightly τ selection: marginal likelihood over a small grid plus a
 * log-normal prior centred on the literature values (spec §Estimación).
 */
export function fitTaus(
  impulses: Map<number, number>,
  observations: Observation[],
  untilDay: number,
): FFResult {
  let best: { score: number; res: FFResult } | null = null;
  for (const tau1 of TAU1_GRID) {
    for (const tau2 of TAU2_GRID) {
      if (tau2 >= tau1) continue;
      const res = runFitnessFatigue(impulses, observations, untilDay, { tau1, tau2 });
      const prior =
        -((Math.log(tau1 / DEFAULT_TAUS.tau1) / 0.3) ** 2) / 2 -
        (Math.log(tau2 / DEFAULT_TAUS.tau2) / 0.35) ** 2 / 2;
      const score = res.logLik + prior;
      if (!best || score > best.score) best = { score, res };
    }
  }
  return best!.res;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normCdf(x: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const y =
    1 -
    t *
      (0.254829592 +
        t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export const dayIndex = (iso: string | Date) =>
  Math.floor((typeof iso === 'string' ? new Date(iso) : iso).getTime() / DAY_MS);
