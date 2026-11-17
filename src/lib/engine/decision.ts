// Engine v2 · phase 4 — load decision under asymmetric loss and contextual
// Thompson sampling for the progression type. Spec: ENGINE-v2.md §Fase 4.

import type { SetLog } from '../adaptive/types';
import { normCdf } from './fitnessFatigue';

// ── Load decision ───────────────────────────────────────────────────

/** Failing a progression costs λ× what succeeding gains. */
export const LOSS_RATIO = 1.5;

/** Epley corrected by reps in reserve: the load's true rep capacity. */
/**
 * λ grows with the chance of pain coming back: λ = 1.5·(1 + 2·risk). At a
 * 25 % two-week risk a single step needs p > 0.69 instead of 0.6.
 */
export const lossRatioFor = (painRisk = 0) =>
  LOSS_RATIO * (1 + 2 * Math.max(0, Math.min(1, painRisk)));

export const capacityOf = (load: number, reps: number, rir = 0) => load * (1 + (reps + rir) / 30);

export interface LoadChoice {
  load: number;
  /** P(completing the target at this load). */
  probability: number;
  utility: number;
  candidates: { load: number; probability: number; utility: number }[];
  capacity: { mean: number; sd: number };
}

/**
 * Pick the next load from {current, +1, +2 increments} by expected utility
 * U = Δ·(p − λ(1 − p)). With λ = 1.5 one increment is taken only when
 * p > 0.6: waiting a session is cheaper than failing one.
 */
export function chooseLoad(opts: {
  current: number;
  increment: number;
  lastSets: SetLog[];
  /** Best-set capacities of earlier exposures, oldest first (for the SD). */
  history?: number[];
  repsMin: number;
  rirTarget: number;
  /** Cost of a failed step vs a won one; rises with pain-recurrence risk. */
  lossRatio?: number;
}): LoadChoice {
  const { current, increment, lastSets, history = [], repsMin, rirTarget } = opts;
  const lossRatio = opts.lossRatio ?? LOSS_RATIO;
  const caps = lastSets
    .filter((s) => s.completed && s.reps !== undefined && (s.reps ?? 0) <= 12)
    .map((s) => capacityOf(s.loadKg ?? current, s.reps!, s.rir ?? 0));
  const mean = caps.length ? Math.max(...caps) : capacityOf(current, repsMin, rirTarget);
  // Residual SD of recent capacities around their own trend, floored at 2.5 %.
  const recent = [...history.slice(-4), mean];
  let resid = 0;
  if (recent.length >= 3) {
    const n = recent.length;
    const xs = recent.map((_, i) => i);
    const mx = (n - 1) / 2;
    const my = recent.reduce((a, b) => a + b, 0) / n;
    const slope =
      xs.reduce((a, x, i) => a + (x - mx) * (recent[i] - my), 0) /
      xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    resid = Math.sqrt(
      recent.reduce((a, y, i) => a + (y - (my + slope * (i - mx))) ** 2, 0) / (n - 2),
    );
  }
  const sd = Math.max(0.025 * mean, resid);

  const candidates = [0, 1, 2].map((delta) => {
    const load = current + delta * increment;
    const required = capacityOf(load, repsMin, rirTarget);
    const probability = 1 - normCdf((required - mean) / sd);
    const utility = delta === 0 ? 0 : delta * (probability - lossRatio * (1 - probability));
    return { load, probability, utility };
  });
  const best = candidates.reduce((a, b) => (b.utility > a.utility ? b : a));
  return { ...best, candidates, capacity: { mean, sd } };
}

// ── Contextual Thompson sampling ────────────────────────────────────

export type Arm = 'increase_load' | 'add_set';
export interface ArmContext {
  band: 'go' | 'easy' | 'rest';
  debtHigh: boolean;
}
export interface ArmOutcome {
  arm: Arm;
  context?: ArmContext;
  success: boolean;
}

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gamma(k, 1) sample (Marsaglia & Tsang 2000). */
function sampleGamma(k: number, rng: () => number): number {
  if (k < 1) return sampleGamma(k + 1, rng) * Math.pow(rng(), 1 / k);
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      // Box–Muller normal.
      x = Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

export function sampleBeta(a: number, b: number, rng: () => number): number {
  const x = sampleGamma(a, rng);
  return x / (x + sampleGamma(b, rng));
}

const sameContext = (a?: ArmContext, b?: ArmContext) =>
  !!a && !!b && a.band === b.band && a.debtHigh === b.debtHigh;

/** Beta posterior of an arm in a context, partially pooled with the arm overall. */
export function armPosterior(arm: Arm, outcomes: ArmOutcome[], context?: ArmContext) {
  const mine = outcomes.filter((o) => o.arm === arm);
  const s = mine.filter((o) => o.success).length;
  const f = mine.length - s;
  const local = mine.filter((o) => sameContext(o.context, context));
  const ls = local.filter((o) => o.success).length;
  const lf = local.length - ls;
  // Global evidence counts half outside its context (partial pooling).
  return {
    a: 1 + ls + 0.5 * (s - ls),
    b: 1 + lf + 0.5 * (f - lf),
    n: mine.length,
    ln: local.length,
  };
}

export function thompsonChoice(
  arms: Arm[],
  outcomes: ArmOutcome[],
  context: ArmContext | undefined,
  rng: () => number,
): { arm: Arm; samples: Record<string, number> } {
  const samples: Record<string, number> = {};
  for (const arm of arms) {
    const p = armPosterior(arm, outcomes, context);
    samples[arm] = sampleBeta(p.a, p.b, rng);
  }
  const arm = arms.reduce((best, a) => (samples[a] > samples[best] ? a : best));
  return { arm, samples };
}
