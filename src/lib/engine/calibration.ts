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
  /** 1 = it happened. A folded archive bin carries the observed share (0–1). */
  outcome: number;
  /** Weight, 1 by default: older forecasts count less, never nothing. */
  w?: number;
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

/** Prequential refits: exact up to here, then whenever the past grows by 5 %. */
const PREQ_EXACT = 50;
const PREQ_GROWTH = 1.05;

const clip = (p: number) => Math.min(1 - P_CLIP, Math.max(P_CLIP, p));
const logit = (p: number) => Math.log(clip(p) / (1 - clip(p)));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const IDENTITY: Recalibration = { a: 0, b: 1, sdA: PRIOR_SD_A, sdB: PRIOR_SD_B, n: 0 };

/**
 * Bayesian logistic recalibration (Platt 1999 with a prior; Cox 1958 for the
 * calibration slope): MAP by damped Newton, Laplace approximation for the
 * uncertainty. With few forecasts the prior keeps it near the identity.
 *
 * Damping matters: forecasts cluster near the clip bounds (load choices sit
 * above 0.97), where a plain Newton step overshoots the saturated sigmoid and
 * stops wherever iteration 30 lands. The slope is projected to b ≥ 0 because
 * a negative slope would reverse the order of the forecasts.
 */
export function fitRecalibration(
  forecasts: Pick<Forecast, 'p' | 'outcome' | 'w'>[],
  /** Start Newton here (e.g. the fit on a slightly shorter past): same MAP, fewer steps. */
  start?: Pick<Recalibration, 'a' | 'b'>,
): Recalibration {
  if (!forecasts.length) return IDENTITY;
  const xs = forecasts.map((f) => logit(f.p));

  // log(1 + e^η) without overflow.
  const softplus = (eta: number) =>
    eta > 0 ? eta + Math.log1p(Math.exp(-eta)) : Math.log1p(Math.exp(eta));
  const logPost = (a: number, b: number) => {
    let lp = -0.5 * (a / PRIOR_SD_A) ** 2 - 0.5 * ((b - 1) / PRIOR_SD_B) ** 2;
    forecasts.forEach((f, i) => {
      const eta = a + b * xs[i];
      lp += (f.w ?? 1) * (f.outcome * eta - softplus(eta));
    });
    return lp;
  };
  const curvature = (a: number, b: number) => {
    let g1 = -a / PRIOR_SD_A ** 2;
    let g2 = -(b - 1) / PRIOR_SD_B ** 2;
    let h11 = 1 / PRIOR_SD_A ** 2;
    let h12 = 0;
    let h22 = 1 / PRIOR_SD_B ** 2;
    forecasts.forEach((f, i) => {
      const x = xs[i];
      const s = sigmoid(a + b * x);
      const k = f.w ?? 1;
      const w = k * s * (1 - s);
      g1 += k * (f.outcome - s);
      g2 += k * (f.outcome - s) * x;
      h11 += w;
      h12 += w * x;
      h22 += w * x * x;
    });
    return { g1, g2, h11, h12, h22 };
  };

  let a = start?.a ?? 0;
  let b = Math.max(0, start?.b ?? 1);
  let lp = logPost(a, b);
  for (let iter = 0; iter < 100; iter++) {
    const { g1, g2, h11, h12, h22 } = curvature(a, b);
    const det = h11 * h22 - h12 * h12;
    let da = (h22 * g1 - h12 * g2) / det;
    let db = (h11 * g2 - h12 * g1) / det;
    // On the b = 0 boundary with the slope pushing further down, the constrained
    // optimum is a 1-D problem in a; a projected 2-D step would stall short of it.
    if (b === 0 && db < 0) {
      da = g1 / h11;
      db = 0;
    }
    let t = 1;
    let accepted = false;
    while (t > 1e-8) {
      const na = a + t * da;
      const nb = Math.max(0, b + t * db);
      const nlp = logPost(na, nb);
      if (Number.isFinite(nlp) && nlp >= lp) {
        const moved = Math.abs(na - a) + Math.abs(nb - b);
        a = na;
        b = nb;
        lp = nlp;
        accepted = moved > 1e-10;
        break;
      }
      t /= 2;
    }
    if (!accepted) break;
  }
  const { h11, h12, h22 } = curvature(a, b);
  const det = h11 * h22 - h12 * h12;
  return {
    a,
    b,
    sdA: Math.sqrt(h22 / det),
    sdB: Math.sqrt(h11 / det),
    n: forecasts.reduce((a, f) => a + (f.w ?? 1), 0),
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
    const n = inBin.reduce((a, f) => a + (f.w ?? 1), 0);
    const k = inBin.reduce((a, f) => a + (f.w ?? 1) * f.outcome, 0);
    const [observedLo, observedHi] = wilson(k, n);
    out.push({
      lo,
      hi,
      n,
      forecast: n ? inBin.reduce((a, f) => a + (f.w ?? 1) * f.p, 0) / n : (lo + hi) / 2,
      observed: n ? k / n : 0,
      observedLo,
      observedHi,
    });
  }
  return out;
}

export function calibrationReport(input: Forecast[]): CalibrationReport {
  // Archived bins (at = '') sort first: they are the oldest evidence.
  const forecasts = [...input].sort((x, y) => x.at.localeCompare(y.at));
  const n = forecasts.reduce((a, f) => a + (f.w ?? 1), 0);
  let brier = 0;
  let brierRef = 0;
  let corrected = 0;
  let k = 0;
  let seen = 0;
  // Prequential correction: each forecast is corrected with a fit on the past
  // only. Refitting at every step was O(n²) and blew the foreground budget
  // (~0.6 s at 1.5k forecasts on desktop). Exact for the first PREQ_EXACT
  // steps; after that the fit is refreshed whenever the past has grown by
  // PREQ_GROWTH, warm-started from the previous one: still past-only, and a
  // 5 % longer past barely moves a posterior built on dozens of points.
  let fitPast: Recalibration = IDENTITY;
  let fittedAt = 0;
  forecasts.forEach((f, i) => {
    const w = f.w ?? 1;
    brier += w * brierOf(f.p, f.outcome);
    // Running base rate with a Beta(1,1) prior: the forecaster who knows nothing.
    brierRef += w * brierOf((1 + k) / (2 + seen), f.outcome);
    if (i > 0 && (i <= PREQ_EXACT || i >= fittedAt * PREQ_GROWTH)) {
      fitPast = fitRecalibration(forecasts.slice(0, i), fitPast);
      fittedAt = i;
    }
    corrected += w * brierOf(recalibrate(f.p, i > 0 ? fitPast : null), f.outcome);
    k += w * f.outcome;
    seen += w;
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
