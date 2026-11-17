// Engine v2 · phase 4 — Bayesian online changepoint detection (Adams &
// MacKay 2007) on a movement's progression rate. Each regime has an unknown
// mean rate μ and variance σ² with a Normal-Inverse-Gamma prior; the
// predictive is Student-t. Spec: docs/engine/ENGINE-v2.md §Fase 4.

export interface NIG {
  mu: number;
  kappa: number;
  alpha: number;
  beta: number;
}

export const RATE_PRIOR: NIG = { mu: 0.5, kappa: 1, alpha: 1, beta: 1 };
export const HAZARD = 1 / 10;
/** Below this rate (% per exposure) a regime counts as a plateau. */
export const PLATEAU_RATE = 0.5;

function logGamma(z: number): number {
  // Lanczos approximation (g = 7), accurate to ~1e-13 for z > 0.
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** log Student-t predictive of x under NIG parameters. */
function logPredictive(x: number, p: NIG): number {
  const nu = 2 * p.alpha;
  const scale2 = (p.beta * (p.kappa + 1)) / (p.alpha * p.kappa);
  const z = (x - p.mu) ** 2 / (nu * scale2);
  return (
    logGamma((nu + 1) / 2) -
    logGamma(nu / 2) -
    0.5 * Math.log(nu * Math.PI * scale2) -
    ((nu + 1) / 2) * Math.log1p(z)
  );
}

function update(p: NIG, x: number): NIG {
  return {
    mu: (p.kappa * p.mu + x) / (p.kappa + 1),
    kappa: p.kappa + 1,
    alpha: p.alpha + 0.5,
    beta: p.beta + (p.kappa * (x - p.mu) ** 2) / (2 * (p.kappa + 1)),
  };
}

/** Student-t CDF via the regularized incomplete beta (continued fraction). */
function tCdf(t: number, nu: number): number {
  const x = nu / (nu + t * t);
  const ib = incBeta(x, nu / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // The symmetric relation keeps the continued fraction convergent
  // (codeplea/incbeta, after Numerical Recipes 6.4).
  if (x > (a + 1) / (a + b + 2)) return 1 - incBeta(1 - x, b, a);
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  // Lentz's continued fraction (Numerical Recipes 6.4).
  let f = 1;
  let c = 1;
  let d = 0;
  for (let i = 0; i <= 200; i++) {
    const m = Math.floor(i / 2);
    let num: number;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-10) break;
  }
  return front * (f - 1);
}

export interface ProgressionState {
  /** P(run length = r) after the last observation. */
  runLength: number[];
  /** P(the regime changed at the last or previous step). */
  changeProbability: number;
  /** P(μ < PLATEAU_RATE) mixed over run lengths. */
  plateauProbability: number;
  /** Expected run length of the current regime. */
  expectedRun: number;
  /** Mixture posterior mean of the current rate (% per exposure). */
  rate: number;
  increments: number;
}

export function progressionState(increments: number[], prior: NIG = RATE_PRIOR): ProgressionState {
  let probs = [1];
  let params: NIG[] = [prior];
  let change = 0;
  for (const x of increments) {
    const pred = params.map((p) => Math.exp(logPredictive(x, p)));
    const growth = probs.map((pr, r) => pr * pred[r] * (1 - HAZARD));
    const cp = probs.reduce((a, pr, r) => a + pr * pred[r] * HAZARD, 0);
    const next = [cp, ...growth];
    const z = next.reduce((a, b) => a + b, 0);
    probs = next.map((v) => v / z);
    params = [prior, ...params.map((p) => update(p, x))];
    change = probs[0] + (probs[1] ?? 0);
  }
  // Mixture over regimes for the current rate.
  let plateau = 0;
  let rate = 0;
  let expectedRun = 0;
  probs.forEach((pr, r) => {
    const p = params[r];
    const nu = 2 * p.alpha;
    const sdMu = Math.sqrt(p.beta / (p.alpha * p.kappa));
    plateau += pr * tCdf((PLATEAU_RATE - p.mu) / sdMu, nu);
    rate += pr * p.mu;
    expectedRun += pr * r;
  });
  return {
    runLength: probs,
    changeProbability: increments.length >= 2 ? change : 0,
    plateauProbability: plateau,
    expectedRun,
    rate,
    increments: increments.length,
  };
}

/** % increments between consecutive positive values. */
export function increments(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] > 0) out.push(100 * (series[i] / series[i - 1] - 1));
  }
  return out;
}

export function isPlateau(s: ProgressionState): boolean {
  return s.increments >= 3 && s.expectedRun >= 2 && s.plateauProbability > 0.75;
}
