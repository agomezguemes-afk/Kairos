// Time-to-event models: how likely is the next session (adherence) and how
// likely is pain to come back (recurrence). Both are Bayesian Weibull
// proportional-hazards models (Ibrahim, Chen & Sinha 2001):
//
//   h(t | x) = θ·k·t^(k−1)·e^(βx)
//
// Given the shape k and β, θ has a conjugate Gamma posterior, so the model
// is a small grid over (k, β) with θ integrated out exactly. Right-censoring
// (the current gap, still open) enters only through the exposure Σ t^k e^βx.

import type { CheckIn } from '../adaptive/checkins';
import type { Experiment } from '../adaptive/experiments';
import type { SessionLog } from '../adaptive/types';
import { logGamma } from './changepoint';

const DAY_MS = 86_400_000;
const T_FLOOR = 0.25;

export interface SurvivalObs {
  /** Days until the event, or until now when censored. */
  t: number;
  event: boolean;
  /** Binary covariate (proportional hazards); 0 when absent. */
  x?: number;
}

export interface WeibullPrior {
  shapes: number[];
  /** Log-normal prior on the shape: centre and SD on the log scale. */
  shapeCentre: number;
  shapeLogSd: number;
  /** Prior median time-to-event (days) at x = 0. */
  median: number;
  /** Gamma shape for θ: low = weak. */
  a0: number;
  betas: number[];
  betaSd: number;
}

export interface WeibullPoint {
  k: number;
  beta: number;
  a: number;
  b: number;
  w: number;
}

export interface WeibullPosterior {
  grid: WeibullPoint[];
  events: number;
  observations: number;
}

export function fitWeibull(obs: SurvivalObs[], prior: WeibullPrior): WeibullPosterior {
  const d = obs.filter((o) => o.event).length;
  const raw: (WeibullPoint & { lml: number })[] = [];
  for (const k of prior.shapes) {
    // E[θ] = ln2 / median^k puts the prior median where literature says.
    const b0 = (prior.a0 * prior.median ** k) / Math.LN2;
    for (const beta of prior.betas) {
      let exposure = 0;
      let eventTerm = 0;
      for (const o of obs) {
        const t = Math.max(T_FLOOR, o.t);
        const x = o.x ?? 0;
        exposure += t ** k * Math.exp(beta * x);
        if (o.event) eventTerm += Math.log(k) + (k - 1) * Math.log(t) + beta * x;
      }
      const a = prior.a0 + d;
      const b = b0 + exposure;
      const lml =
        eventTerm +
        prior.a0 * Math.log(b0) -
        logGamma(prior.a0) +
        logGamma(a) -
        a * Math.log(b) -
        Math.log(k / prior.shapeCentre) ** 2 / (2 * prior.shapeLogSd ** 2) -
        beta ** 2 / (2 * prior.betaSd ** 2);
      raw.push({ k, beta, a, b, w: 0, lml });
    }
  }
  const max = Math.max(...raw.map((r) => r.lml));
  const total = raw.reduce((s, r) => s + Math.exp(r.lml - max), 0);
  return {
    grid: raw.map(({ lml, ...p }) => ({ ...p, w: Math.exp(lml - max) / total })),
    events: d,
    observations: obs.length,
  };
}

/** Posterior predictive survival P(T > t | x). */
export function survivalAt(post: WeibullPosterior, t: number, x = 0): number {
  const tt = Math.max(0, t);
  return post.grid.reduce(
    (s, p) => s + p.w * (p.b / (p.b + tt ** p.k * Math.exp(p.beta * x))) ** p.a,
    0,
  );
}

/** P(event within the next `dt` days | no event for `t0` days). */
export function riskWithin(post: WeibullPosterior, t0: number, dt: number, x = 0): number {
  const s0 = survivalAt(post, t0, x);
  if (s0 <= 1e-12) return 1;
  return Math.max(0, Math.min(1, 1 - survivalAt(post, t0 + dt, x) / s0));
}

/** Hazard ratio e^β: posterior mean and ~90 % interval over the grid. */
export function hazardRatio(post: WeibullPosterior): { mean: number; lo: number; hi: number } {
  const byBeta = new Map<number, number>();
  for (const p of post.grid) byBeta.set(p.beta, (byBeta.get(p.beta) ?? 0) + p.w);
  const sorted = [...byBeta.entries()].sort((a, b) => a[0] - b[0]);
  let acc = 0;
  let lo = sorted[0][0];
  let hi = sorted[sorted.length - 1][0];
  let loSet = false;
  for (const [beta, w] of sorted) {
    acc += w;
    if (!loSet && acc >= 0.05) {
      lo = beta;
      loSet = true;
    }
    if (acc >= 0.95) {
      hi = beta;
      break;
    }
  }
  const mean = sorted.reduce((s, [beta, w]) => s + w * Math.exp(beta), 0);
  return { mean, lo: Math.exp(lo), hi: Math.exp(hi) };
}

// ── Adherence ───────────────────────────────────────────────────────

/** A gap this long is a lapse: the usual definition of dropping out of a routine. */
export const LAPSE_DAYS = 14;

export const ADHERENCE_PRIOR = (daysPerWeek: number): WeibullPrior => ({
  // Rising hazard (k > 1): the longer since the last session, the more
  // likely the next one, for someone with a routine.
  shapes: [0.7, 0.9, 1.1, 1.4, 1.8, 2.3, 3],
  shapeCentre: 1.5,
  shapeLogSd: 0.5,
  median: 7 / Math.max(1, daysPerWeek),
  a0: 2,
  betas: [-1, -0.5, 0, 0.5, 1],
  betaSd: 0.5,
});

export interface Adherence {
  /** Days since the last session. */
  gapDays: number;
  /** P(training within the next 3 / 7 days). */
  within3: number;
  within7: number;
  /** P(this gap reaches LAPSE_DAYS). */
  lapseRisk: number;
  /** Effect of a very hard last session (RPE ≥ 8) on the next session's hazard. */
  hardHazardRatio: { mean: number; lo: number; hi: number };
  gaps: number;
  /** True once enough gaps back the estimate. */
  informed: boolean;
}

const hard = (s: SessionLog) => (s.rpe >= 8 ? 1 : 0);

export function adherence(
  sessions: SessionLog[],
  now: Date = new Date(),
  daysPerWeek = 3,
): Adherence | null {
  if (!sessions.length) return null;
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  const obs: SurvivalObs[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const t =
      (new Date(sorted[i].startedAt).getTime() - new Date(sorted[i - 1].endedAt).getTime()) /
      DAY_MS;
    // Two logs on the same outing are one session, not a zero-day gap.
    if (t < 0.2) continue;
    obs.push({ t, event: true, x: hard(sorted[i - 1]) });
  }
  const last = sorted[sorted.length - 1];
  const gapDays = Math.max(0, (now.getTime() - new Date(last.endedAt).getTime()) / DAY_MS);
  const x = hard(last);
  obs.push({ t: gapDays, event: false, x });
  const post = fitWeibull(obs, ADHERENCE_PRIOR(daysPerWeek));
  const lapseRisk =
    gapDays >= LAPSE_DAYS ? 1 : survivalAt(post, LAPSE_DAYS, x) / survivalAt(post, gapDays, x);
  return {
    gapDays,
    within3: riskWithin(post, gapDays, 3, x),
    within7: riskWithin(post, gapDays, 7, x),
    lapseRisk: Math.max(0, Math.min(1, lapseRisk)),
    hardHazardRatio: hazardRatio(post),
    gaps: post.events,
    informed: post.events >= 5,
  };
}

// ── Pain recurrence ─────────────────────────────────────────────────

/** Reports closer than this belong to the same episode. */
const EPISODE_MERGE_DAYS = 7;

export const PAIN_PRIOR: WeibullPrior = {
  // Falling hazard (k < 1): recurrence is likeliest soon after an episode
  // (da Silva et al. 2019). Median and shape are priors to review.
  shapes: [0.5, 0.65, 0.8, 1, 1.25],
  shapeCentre: 0.8,
  shapeLogSd: 0.35,
  median: 120,
  a0: 2,
  betas: [0],
  betaSd: 1,
};

export interface PainRecurrence {
  episodes: number;
  daysSince: number;
  /** P(a new episode within 14 days). */
  risk14: number;
  /** True while the last episode is still recent: no load progression. */
  active: boolean;
}

export function painEpisodes(checkins: CheckIn[], experiments: Experiment[] = []): number[] {
  const times = [
    ...checkins.filter((c) => c.pain).map((c) => new Date(c.at).getTime()),
    ...experiments
      .filter((e) => e.answers?.feel === 'pain' && e.closedAt)
      .map((e) => new Date(e.closedAt!).getTime()),
  ].sort((a, b) => a - b);
  // Each episode is represented by its last report: recurrence is timed
  // from when the pain was last there, not from when it began.
  const episodes: number[] = [];
  for (const t of times) {
    const prev = episodes[episodes.length - 1];
    if (prev !== undefined && t - prev <= EPISODE_MERGE_DAYS * DAY_MS)
      episodes[episodes.length - 1] = t;
    else episodes.push(t);
  }
  return episodes;
}

export function painRecurrence(
  checkins: CheckIn[],
  experiments: Experiment[] = [],
  now: Date = new Date(),
): PainRecurrence | null {
  const eps = painEpisodes(checkins, experiments).filter((t) => t <= now.getTime());
  if (!eps.length) return null;
  const obs: SurvivalObs[] = [];
  for (let i = 1; i < eps.length; i++) obs.push({ t: (eps[i] - eps[i - 1]) / DAY_MS, event: true });
  const daysSince = (now.getTime() - eps[eps.length - 1]) / DAY_MS;
  obs.push({ t: daysSince, event: false });
  const post = fitWeibull(obs, PAIN_PRIOR);
  return {
    episodes: eps.length,
    daysSince,
    risk14: riskWithin(post, daysSince, 14),
    active: daysSince < 3,
  };
}
