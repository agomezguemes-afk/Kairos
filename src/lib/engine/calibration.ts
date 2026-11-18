// Calibration: does the engine mean what it says? When it says 70 %, it
// should be right about 70 % of the time. Spec: ENGINE-v2.md §Calibración.
//
// Scores are prequential (Dawid 1984): each forecast is judged against
// what happened, and every reference or correction used to judge forecast
// i is fitted only on forecasts before i. Nothing here peeks ahead.

import { normCdf } from './fitnessFatigue';

/** A probability forecast and what happened. */
export interface Forecast {
  /** When the forecast was (re)made, ISO. */
  at: string;
  p: number;
  outcome: 0 | 1;
}

/** A forecast with a predictive distribution and the observed value. */
export interface IntervalForecast {
  at: string;
  mean: number;
  sd: number;
  y: number;
}

/** σ(a + b·logit p): a = optimism/pessimism, b < 1 = too extreme. */
export interface Recalibration {
  a: number;
  b: number;
  sdA: number;
  sdB: number;
  n: number;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  n: number;
  /** Mean forecast in the bin. */
  forecast: number;
  /** Observed frequency, with an 80 % Wilson interval. */
  observed: number;
  observedLo: number;
  observedHi: number;
}

export type CalibrationVerdict =
  | 'learning'
  | 'calibrated'
  | 'overconfident'
  | 'underconfident'
  | 'optimistic'
  | 'pessimistic';

export interface CalibrationReport {
  n: number;
  /** Mean squared error of the forecasts (0 = perfect, 0.25 = coin). */
  brier: number;
  /** Brier of the running base rate: what knowing nothing scores. */
  brierRef: number;
  /** 1 − brier/brierRef: > 0 means the engine beats the base rate. */
  skill: number;
  /** Same after the prequential correction is applied. */
  correctedBrier: number;
  correctedSkill: number;
  /** Expected calibration error (weighted |forecast − observed| over bins). */
  ece: number;
  bins: ReliabilityBin[];
  fit: Recalibration;
  /** P(b < 0.8): the forecasts are clearly more extreme than the data back. */
  pOverconfident: number;
  /** P(b > 1.25): clearly too timid. */
  pUnderconfident: number;
  /** P(a < −0.25): reality clearly comes in below the forecast. */
  pOptimistic: number;
  /** P(a > 0.25): reality clearly comes in above it. */
  pPessimistic: number;
  verdict: CalibrationVerdict;
}

export interface IntervalReport {
  n: number;
  /** Mean standardised error: > 0 = reality above the forecast. */
  bias: number;
  /** RMS standardised error: 1 = spread right, > 1 = intervals too narrow. */
  spread: number;
  /** Share of outcomes inside the 80 % interval. */
  coverage80: number;
  /** Posterior mean of the variance factor the intervals need (1 = none). */
  varianceFactor: number;
}

/** Below this, the report says "learning" and the correction stays ~identity. */
export const CALIBRATION_MIN = 15;

/** Priors: a ~ N(0, 0.3²), b ~ N(1, 0.3²). Identity until data argue. */
const PRIOR_SD_A = 0.3;
const PRIOR_SD_B = 0.3;
const P_CLIP = 0.02;
const Z80 = 1.2816;
/**
 * A verdict needs 80 % posterior mass beyond a margin that matters: slope
 * outside [0.8, 1.25], intercept beyond ±0.25 logits (~6 points near 50 %).
 * Without the margin, enough data makes any trivial wobble a "finding".
 */
const VERDICT_P = 0.8;
const SLOPE_LOW = 0.8;
const SLOPE_HIGH = 1.25;
const BIAS = 0.25;

const clip = (p: number) => Math.min(1 - P_CLIP, Math.max(P_CLIP, p));
const logit = (p: number) => Math.log(clip(p) / (1 - clip(p)));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const IDENTITY: Recalibration = { a: 0, b: 1, sdA: PRIOR_SD_A, sdB: PRIOR_SD_B, n: 0 };

/**
 * Bayesian logistic recalibration (Platt 1999 with a prior; Cox 1958 for the
 * calibration slope): MAP by Newton–Raphson, Laplace approximation for the
 * uncertainty. With few forecasts the prior keeps it near the identity.
 */
export function fitRecalibration(forecasts: Pick<Forecast, 'p' | 'outcome'>[]): Recalibration {
  if (!forecasts.length) return IDENTITY;
  const xs = forecasts.map((f) => logit(f.p));
  let a = 0;
  let b = 1;
  let h11 = 0;
  let h12 = 0;
  let h22 = 0;
  for (let iter = 0; iter < 30; iter++) {
    let g1 = -a / PRIOR_SD_A ** 2;
    let g2 = -(b - 1) / PRIOR_SD_B ** 2;
    h11 = 1 / PRIOR_SD_A ** 2;
    h12 = 0;
    h22 = 1 / PRIOR_SD_B ** 2;
    forecasts.forEach((f, i) => {
      const x = xs[i];
      const s = sigmoid(a + b * x);
      const w = s * (1 - s);
      g1 += f.outcome - s;
      g2 += (f.outcome - s) * x;
      h11 += w;
      h12 += w * x;
      h22 += w * x * x;
    });
    // Newton step with the (positive-definite) negative Hessian.
    const det = h11 * h22 - h12 * h12;
    const da = (h22 * g1 - h12 * g2) / det;
    const db = (h11 * g2 - h12 * g1) / det;
    a += da;
    b += db;
    if (Math.abs(da) + Math.abs(db) < 1e-8) break;
  }
  const det = h11 * h22 - h12 * h12;
  return {
    a,
    b,
    sdA: Math.sqrt(h22 / det),
    sdB: Math.sqrt(h11 / det),
    n: forecasts.length,
  };
}

/** The forecast as the person should read it, given the engine's track record. */
export function recalibrate(p: number, fit: Recalibration | null | undefined): number {
  if (!fit || fit.n === 0) return p;
  return sigmoid(fit.a + fit.b * logit(p));
}

const brierOf = (p: number, y: number) => (p - y) ** 2;

/** Wilson score interval (80 %), honest for small bins. */
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const phat = k / n;
  const z2 = Z80 * Z80;
  const centre = (phat + z2 / (2 * n)) / (1 + z2 / n);
  const half = (Z80 * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function reliability(forecasts: Forecast[], bins = 5): ReliabilityBin[] {
  const out: ReliabilityBin[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = i / bins;
    const hi = (i + 1) / bins;
    const inBin = forecasts.filter((f) => f.p >= lo && (f.p < hi || (i === bins - 1 && f.p <= hi)));
    const k = inBin.reduce((a, f) => a + f.outcome, 0);
    const [observedLo, observedHi] = wilson(k, inBin.length);
    out.push({
      lo,
      hi,
      n: inBin.length,
      forecast: inBin.length ? inBin.reduce((a, f) => a + f.p, 0) / inBin.length : (lo + hi) / 2,
      observed: inBin.length ? k / inBin.length : 0,
      observedLo,
      observedHi,
    });
  }
  return out;
}

export function calibrationReport(input: Forecast[]): CalibrationReport {
  const forecasts = [...input].sort((x, y) => x.at.localeCompare(y.at));
  const n = forecasts.length;
  let brier = 0;
  let brierRef = 0;
  let corrected = 0;
  let k = 0;
  forecasts.forEach((f, i) => {
    brier += brierOf(f.p, f.outcome);
    // Running base rate with a Beta(1,1) prior: the forecaster who knows nothing.
    brierRef += brierOf((1 + k) / (2 + i), f.outcome);
    // Correction fitted on the past only, applied to this forecast.
    const past = forecasts.slice(0, i);
    corrected += brierOf(recalibrate(f.p, fitRecalibration(past)), f.outcome);
    k += f.outcome;
  });
  const bins = reliability(forecasts);
  const fit = fitRecalibration(forecasts);
  const ece = n ? bins.reduce((a, b) => a + (b.n / n) * Math.abs(b.forecast - b.observed), 0) : 0;
  const pOverconfident = normCdf((SLOPE_LOW - fit.b) / fit.sdB);
  const pUnderconfident = normCdf((fit.b - SLOPE_HIGH) / fit.sdB);
  const pOptimistic = normCdf((-BIAS - fit.a) / fit.sdA);
  const pPessimistic = normCdf((fit.a - BIAS) / fit.sdA);
  let verdict: CalibrationVerdict = 'calibrated';
  if (n < CALIBRATION_MIN) verdict = 'learning';
  else if (pOverconfident > VERDICT_P) verdict = 'overconfident';
  else if (pUnderconfident > VERDICT_P) verdict = 'underconfident';
  else if (pOptimistic > VERDICT_P) verdict = 'optimistic';
  else if (pPessimistic > VERDICT_P) verdict = 'pessimistic';
  const safe = (x: number) => (n ? x / n : 0);
  const skill = brierRef > 0 ? 1 - brier / brierRef : 0;
  return {
    n,
    brier: safe(brier),
    brierRef: safe(brierRef),
    skill,
    correctedBrier: safe(corrected),
    correctedSkill: brierRef > 0 ? 1 - corrected / brierRef : 0,
    ece,
    bins,
    fit,
    pOverconfident,
    pUnderconfident,
    pOptimistic,
    pPessimistic,
    verdict,
  };
}

/**
 * Interval check on standardised errors z = (y − mean)/sd. The variance
 * factor has an inverse-gamma posterior with prior mean 1 (α₀ = 3, β₀ = 2):
 * it only moves once several outcomes land outside where they should.
 */
export function intervalReport(forecasts: IntervalForecast[]): IntervalReport {
  const zs = forecasts.filter((f) => f.sd > 0).map((f) => (f.y - f.mean) / f.sd);
  const n = zs.length;
  if (!n) return { n: 0, bias: 0, spread: 1, coverage80: 0, varianceFactor: 1 };
  const ss = zs.reduce((a, z) => a + z * z, 0);
  const alpha = 3 + n / 2;
  const beta = 2 + ss / 2;
  return {
    n,
    bias: zs.reduce((a, z) => a + z, 0) / n,
    spread: Math.sqrt(ss / n),
    coverage80: zs.filter((z) => Math.abs(z) <= Z80).length / n,
    varianceFactor: beta / (alpha - 1),
  };
}
