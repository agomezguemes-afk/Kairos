// Engine v2 · phase 3 — personal sensitivity to last night's sleep and to
// soreness. Monotone ordinal effects: the literature fixes the *shape* across
// levels 1–5, Bayesian linear regression learns the person's *scale* β from
// one-step-ahead residuals of the fitness-fatigue model.

import type { CheckIn } from '../adaptive/checkins';
import { dayIndex, type DayState } from './fitnessFatigue';
import { SLEEP_SHAPE, SORENESS_SHAPE } from './sleep';

export interface Sensitivity {
  /** β_sleep, β_soreness (% at the extreme of the scale). */
  mean: [number, number];
  cov: [[number, number], [number, number]];
  samples: number;
}

/** Priors: ≈3 % at the scale extreme (Fullagar 2015; Craven 2022; Cheung 2003). */
export const SENSITIVITY_PRIOR: Sensitivity = {
  mean: [3, 3],
  cov: [
    [1.5 ** 2, 0],
    [0, 1.5 ** 2],
  ],
  samples: 0,
};

export function features(c: CheckIn | undefined): [number, number] {
  return [
    c?.sleep !== undefined ? SLEEP_SHAPE[c.sleep] : 0,
    c?.soreness !== undefined ? SORENESS_SHAPE[c.soreness] : 0,
  ];
}

/** Latest pre check-in of each day. */
export function preByDay(checkins: CheckIn[]): Map<number, CheckIn> {
  const out = new Map<number, CheckIn>();
  for (const c of checkins) {
    if (c.kind !== 'pre') continue;
    const d = dayIndex(c.at);
    const prev = out.get(d);
    if (!prev || new Date(c.at) > new Date(prev.at)) out.set(d, c);
  }
  return out;
}

/**
 * Conjugate 2-D Bayesian regression r = β·x + ε on days that have both an
 * observed strength index and a same-day pre check-in. β is projected to
 * ≥ 0: worse sleep or more soreness never improves performance.
 */
export function learnSensitivity(days: DayState[], checkins: CheckIn[]): Sensitivity {
  const pre = preByDay(checkins);
  let [m0, m1] = SENSITIVITY_PRIOR.mean;
  let P = SENSITIVITY_PRIOR.cov.map((r) => [...r]) as [[number, number], [number, number]];
  let n = 0;
  for (const d of days) {
    if (d.observed === undefined) continue;
    const x = features(pre.get(d.day));
    if (x[0] === 0 && x[1] === 0) continue;
    const r = d.observed - d.predicted;
    const Px: [number, number] = [P[0][0] * x[0] + P[0][1] * x[1], P[1][0] * x[0] + P[1][1] * x[1]];
    const S = x[0] * Px[0] + x[1] * Px[1] + d.predictedVar;
    const e = r - (m0 * x[0] + m1 * x[1]);
    const K: [number, number] = [Px[0] / S, Px[1] / S];
    m0 = Math.max(0, m0 + K[0] * e);
    m1 = Math.max(0, m1 + K[1] * e);
    P = [
      [P[0][0] - K[0] * Px[0], P[0][1] - K[0] * Px[1]],
      [P[1][0] - K[1] * Px[0], P[1][1] - K[1] * Px[1]],
    ];
    n++;
  }
  return { mean: [m0, m1], cov: P, samples: n };
}

/** Effect (%) of a check-in under the learned sensitivity, with variance. */
export function checkInEffect(c: CheckIn | undefined, s: Sensitivity) {
  const x = features(c);
  return {
    sleep: { mean: s.mean[0] * x[0], variance: s.cov[0][0] * x[0] ** 2 },
    soreness: { mean: s.mean[1] * x[1], variance: s.cov[1][1] * x[1] ** 2 },
  };
}
