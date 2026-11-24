// n-of-1 trials. A reversible protocol choice (rest between sets) is
// tested on the person by alternating conditions in randomised pairs
// (ABBA BAAB …), the design used for single-patient trials (Duan, Kravitz
// & Schmid 2013). The engine runs them silently: the plan just shows the
// rest to take, and the winner stays once the evidence is decisive.
//
// Analysis: Bayesian linear regression
//   y_i = μ + γ·trend_i + δ·(B_i − ½) + β·sleep_i + ε_i,  ε ~ AR(1)
// with a Normal-Inverse-Gamma prior. Autocorrelation is handled by
// Prais–Winsten on a ρ grid weighted by marginal likelihood. δ (B − A, in
// % of performance) gets a Student-t mixture posterior; decisions use a
// region of practical equivalence (Kruschke 2018) and the Bayes factor by
// Savage–Dickey (Wagenmakers et al. 2010).

import type { CheckIn } from '../adaptive/checkins';
import type { MovementTarget, SessionLog } from '../adaptive/types';
import { logGamma, tCdf } from './changepoint';
import { safeCovariates, PHYSIO_DAG } from './dag';
import { capacityOf, seededRng } from './decision';
import { SLEEP_SHAPE, HOURS_FROM_SCALE } from './sleep';

export type Condition = 'A' | 'B';

export interface TrialTemplate {
  id: 'rest';
  question: string;
  A: { label: string; patch: Partial<MovementTarget> };
  B: { label: string; patch: Partial<MovementTarget> };
}

export const TRIAL_TEMPLATES: Record<TrialTemplate['id'], TrialTemplate> = {
  // Longer rests preserve reps across sets (Grgic et al. 2018); whether the
  // extra time pays off for this person is the question.
  rest: {
    id: 'rest',
    question: 'Descanso corto o largo entre series',
    A: { label: '2 min', patch: { restSec: 120 } },
    B: { label: '3,5 min', patch: { restSec: 210 } },
  },
};

export type TrialVerdict = 'A' | 'B' | 'same' | 'unclear';

export interface Trial {
  id: string;
  template: TrialTemplate['id'];
  movementId: string;
  draftSessionId?: string;
  startedAt: string;
  schedule: Condition[];
  status: 'running' | 'done' | 'stopped';
  result?: TrialAnalysis;
  closedAt?: string;
}

/** Smallest worthwhile change in session performance, in % (Hopkins 2004). */
export const TRIAL_SWC = 1;
export const TRIAL_PAIRS = 4;
const DECIDE_P = 0.9;
const MIN_PER_ARM = 2;

/** Randomised pairs: each pair is AB or BA, so trend can't masquerade as effect. */
export function abSchedule(seed: string, pairs = TRIAL_PAIRS): Condition[] {
  const rng = seededRng(seed);
  const out: Condition[] = [];
  for (let i = 0; i < pairs; i++)
    out.push(...((rng() < 0.5 ? ['A', 'B'] : ['B', 'A']) as Condition[]));
  return out;
}

export function createTrial(
  template: TrialTemplate['id'],
  movementId: string,
  now: Date,
  draftSessionId?: string,
): Trial {
  const id = `trial:${template}:${movementId}:${now.toISOString().slice(0, 10)}`;
  return {
    id,
    template,
    movementId,
    draftSessionId,
    startedAt: now.toISOString(),
    schedule: abSchedule(id),
    status: 'running',
  };
}

// ── Outcome extraction ──────────────────────────────────────────────

export interface TrialPoint {
  condition: Condition;
  /** Performance vs the pre-trial reference, in %. */
  y: number;
  /** Last night's sleep on the monotone shape scale, if checked in. */
  sleep?: number;
}

const DAY_MS = 86_400_000;

/** Mean RIR-corrected capacity over the sets: fatigue across sets shows here. */
function sessionCapacity(sets: SessionLog['movements'][number]['sets']): number | null {
  const caps = sets
    .filter(
      (s) => s.completed && s.reps !== undefined && (s.reps ?? 0) <= 15 && (s.loadKg ?? 0) > 0,
    )
    .map((s) => capacityOf(s.loadKg!, s.reps!, s.rir ?? 0));
  return caps.length ? caps.reduce((a, b) => a + b, 0) / caps.length : null;
}

function sleepBefore(checkins: CheckIn[], at: number): number | undefined {
  const c = [...checkins]
    .filter((x) => x.kind === 'pre' && new Date(x.at).getTime() <= at)
    .filter((x) => at - new Date(x.at).getTime() <= 0.75 * DAY_MS)
    .pop();
  if (!c) return undefined;
  if (c.sleep !== undefined) return SLEEP_SHAPE[c.sleep];
  if (c.sleepHours !== undefined) {
    // Nearest point of the 1–5 scale for measured hours.
    let best = 3;
    for (const [lvl, h] of Object.entries(HOURS_FROM_SCALE))
      if (Math.abs(h - c.sleepHours) < Math.abs(HOURS_FROM_SCALE[best] - c.sleepHours)) best = +lvl;
    return SLEEP_SHAPE[best];
  }
  return undefined;
}

/** Exposures of the movement since the trial began, in order. */
export function trialExposures(trial: Trial, sessions: SessionLog[]): SessionLog[] {
  const since = new Date(trial.startedAt).getTime();
  return [...sessions]
    .filter((s) => new Date(s.endedAt).getTime() > since)
    .filter((s) => s.movements.some((m) => m.movementId === trial.movementId))
    .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
}

export function trialPoints(
  trial: Trial,
  sessions: SessionLog[],
  checkins: CheckIn[] = [],
): TrialPoint[] {
  const since = new Date(trial.startedAt).getTime();
  const before = [...sessions]
    .filter((s) => new Date(s.endedAt).getTime() <= since)
    .sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime())
    .map((s) => s.movements.find((m) => m.movementId === trial.movementId))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => sessionCapacity(m.sets))
    .filter((c): c is number => c !== null)
    .slice(-3)
    .sort((a, b) => a - b);
  const exposures = trialExposures(trial, sessions).slice(0, trial.schedule.length);
  const caps = exposures.map((s) =>
    sessionCapacity(s.movements.find((m) => m.movementId === trial.movementId)!.sets),
  );
  // The reference only sets the scale; the intercept absorbs its level.
  const ref = before.length
    ? before[Math.floor(before.length / 2)]
    : (caps.find((c): c is number => c !== null) ?? 0);
  if (ref <= 0) return [];
  const out: TrialPoint[] = [];
  exposures.forEach((s, i) => {
    const c = caps[i];
    if (c === null) return;
    out.push({
      condition: trial.schedule[i],
      y: 100 * (c / ref - 1),
      sleep: sleepBefore(checkins, new Date(s.startedAt).getTime()),
    });
  });
  return out;
}

// ── Bayesian regression ─────────────────────────────────────────────

function invert(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((row) => row.slice(n));
}

function logDet(m: number[][]): number {
  // Cholesky: the matrices here are symmetric positive definite.
  const n = m.length;
  const L = m.map(() => new Array<number>(n).fill(0));
  let ld = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        L[i][i] = Math.sqrt(Math.max(s, 1e-12));
        ld += 2 * Math.log(L[i][i]);
      } else L[i][j] = s / L[j][j];
    }
  }
  return ld;
}

interface NigFit {
  mean: number[];
  cov: number[][];
  a: number;
  b: number;
  logMl: number;
}

/** Conjugate NIG regression with zero prior mean and diagonal prior precision. */
function nigRegression(
  X: number[][],
  y: number[],
  precision: number[],
  a0: number,
  b0: number,
): NigFit {
  const n = y.length;
  const p = precision.length;
  const L0 = precision.map((v, i) => precision.map((_, j) => (i === j ? v : 0)));
  const Ln = L0.map((row, i) => row.map((v, j) => v + X.reduce((s, r) => s + r[i] * r[j], 0)));
  const cov = invert(Ln);
  const xty = Array.from({ length: p }, (_, i) => X.reduce((s, r, k) => s + r[i] * y[k], 0));
  const mean = cov.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0));
  const yty = y.reduce((s, v) => s + v * v, 0);
  const mLm = mean.reduce((s, mi, i) => s + mi * Ln[i].reduce((t, v, j) => t + v * mean[j], 0), 0);
  const a = a0 + n / 2;
  const b = b0 + 0.5 * (yty - mLm);
  const logMl =
    -0.5 * n * Math.log(2 * Math.PI) +
    0.5 * precision.reduce((s, v) => s + Math.log(v), 0) -
    0.5 * logDet(Ln) +
    a0 * Math.log(b0) -
    a * Math.log(b) +
    logGamma(a) -
    logGamma(a0);
  return { mean, cov, a, b, logMl };
}

const RHO_GRID = [0, 0.2, 0.4, 0.6];
const RHO_PRIOR = [0.4, 0.3, 0.2, 0.1];
/** σ² ~ IG(2, 4): residual SD around 2 % of performance. */
const A0 = 2;
const B0 = 4;
/** Prior precision (× 1/σ²): intercept, trend, effect, sleep. δ's prior SD ≈ 2 %. */
const PREC = { intercept: 0.01, trend: 0.25, effect: 1, sleep: 0.25 };

export interface TrialAnalysis {
  n: number;
  nA: number;
  nB: number;
  /** δ = B − A in % of performance: posterior mean and 90 % interval. */
  effect: { mean: number; lo: number; hi: number };
  pBBetter: number;
  /** P(δ > SWC), P(δ < −SWC), P(|δ| < SWC). */
  pBWorthwhile: number;
  pAWorthwhile: number;
  pEquivalent: number;
  /** Savage–Dickey Bayes factor for an effect vs none. */
  bf10: number;
  verdict: TrialVerdict;
  decided: boolean;
  covariates: string[];
  rho: number;
}

interface TComp {
  w: number;
  m: number;
  s: number;
  nu: number;
}

const mixCdf = (cs: TComp[], x: number) =>
  cs.reduce((acc, c) => acc + c.w * tCdf((x - c.m) / c.s, c.nu), 0);

function tPdf(x: number, m: number, s: number, nu: number): number {
  const z = (x - m) / s;
  return Math.exp(
    logGamma((nu + 1) / 2) -
      logGamma(nu / 2) -
      0.5 * Math.log(nu * Math.PI) -
      Math.log(s) -
      ((nu + 1) / 2) * Math.log1p((z * z) / nu),
  );
}

function mixQuantile(cs: TComp[], q: number): number {
  let lo = -100;
  let hi = 100;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (mixCdf(cs, mid) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function analyseTrial(
  points: TrialPoint[],
  opts: { complete?: boolean } = {},
): TrialAnalysis {
  const n = points.length;
  const nA = points.filter((p) => p.condition === 'A').length;
  const nB = n - nA;
  // Only covariates the causal graph allows: sleep is a cause of
  // performance that the rest interval can't change; soreness is not safe.
  const withSleep = points.filter((p) => p.sleep !== undefined);
  const sleepVar =
    withSleep.length >= 4 &&
    new Set(withSleep.map((p) => p.sleep)).size > 1 &&
    safeCovariates(PHYSIO_DAG, 'treatment', ['sleep']).includes('sleep');
  const sleepMean = sleepVar ? withSleep.reduce((s, p) => s + p.sleep!, 0) / withSleep.length : 0;
  const rows = points.map((p, i) => {
    const r = [1, n > 1 ? (2 * i) / (n - 1) - 1 : 0, p.condition === 'B' ? 0.5 : -0.5];
    if (sleepVar) r.push((p.sleep ?? sleepMean) - sleepMean);
    return r;
  });
  const precision = [PREC.intercept, PREC.trend, PREC.effect, ...(sleepVar ? [PREC.sleep] : [])];
  const y = points.map((p) => p.y);

  const comps: TComp[] = [];
  const logs: number[] = [];
  let bestRho = 0;
  RHO_GRID.forEach((rho, gi) => {
    // Prais–Winsten keeps the first observation, scaled.
    const k = Math.sqrt(1 - rho * rho);
    const Xs = rows.map((r, i) =>
      i === 0 ? r.map((v) => v * k) : r.map((v, j) => v - rho * rows[i - 1][j]),
    );
    const ys = y.map((v, i) => (i === 0 ? v * k : v - rho * y[i - 1]));
    const fit = nigRegression(Xs, ys, precision, A0, B0);
    logs.push(fit.logMl + 0.5 * Math.log(1 - rho * rho) + Math.log(RHO_PRIOR[gi]));
    comps.push({
      w: 0,
      m: fit.mean[2],
      s: Math.sqrt((fit.b / fit.a) * fit.cov[2][2]),
      nu: 2 * fit.a,
    });
  });
  const max = Math.max(...logs);
  const tot = logs.reduce((s, l) => s + Math.exp(l - max), 0);
  comps.forEach((c, i) => (c.w = Math.exp(logs[i] - max) / tot));
  bestRho = RHO_GRID[comps.reduce((bi, c, i) => (c.w > comps[bi].w ? i : bi), 0)];

  const mean = comps.reduce((s, c) => s + c.w * c.m, 0);
  const pBBetter = 1 - mixCdf(comps, 0);
  const pBWorthwhile = 1 - mixCdf(comps, TRIAL_SWC);
  const pAWorthwhile = mixCdf(comps, -TRIAL_SWC);
  const pEquivalent = Math.max(0, 1 - pBWorthwhile - pAWorthwhile);
  const priorAt0 = tPdf(0, 0, Math.sqrt(B0 / A0 / PREC.effect), 2 * A0);
  const postAt0 = comps.reduce((s, c) => s + c.w * tPdf(0, c.m, c.s, c.nu), 0);

  const enough = nA >= MIN_PER_ARM && nB >= MIN_PER_ARM;
  let verdict: TrialVerdict = 'unclear';
  if (enough) {
    if (pBWorthwhile >= DECIDE_P) verdict = 'B';
    else if (pAWorthwhile >= DECIDE_P) verdict = 'A';
    else if (pEquivalent >= DECIDE_P) verdict = 'same';
  }
  return {
    n,
    nA,
    nB,
    effect: { mean, lo: mixQuantile(comps, 0.05), hi: mixQuantile(comps, 0.95) },
    pBBetter,
    pBWorthwhile,
    pAWorthwhile,
    pEquivalent,
    bf10: postAt0 > 0 ? priorAt0 / postAt0 : Infinity,
    verdict,
    decided: verdict !== 'unclear' || !!opts.complete,
    covariates: sleepVar ? ['sleep'] : [],
    rho: bestRho,
  };
}

/** The condition the next exposure should use, or null once the schedule is spent. */
export function nextCondition(trial: Trial, sessions: SessionLog[]): Condition | null {
  const done = trialExposures(trial, sessions).length;
  return done < trial.schedule.length ? trial.schedule[done] : null;
}

/** What the plan keeps after a trial: the winner, or the shorter rest when it doesn't matter. */
export function winnerPatch(trial: Trial): Partial<MovementTarget> {
  const t = TRIAL_TEMPLATES[trial.template];
  return trial.result?.verdict === 'B' ? t.B.patch : t.A.patch;
}
