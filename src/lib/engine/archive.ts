// Long-term memory. Recent sessions are kept in full detail; older ones are
// not thrown away but compressed: forecasts into weighted reliability bins,
// remembered days into prototypes (weighted centroids of similar days with
// how they usually went). Everything decays with age, so a year-old pattern
// still counts, but less than last month's. This keeps every pass the same
// size however long the history gets.

import type { Forecast } from './calibration';
import type { DecisionContext, Episode } from './memory';
import { similarity } from './memory';

import { decay } from './cache';

const BINS = 10;
const MAX_PROTOTYPES = 32;
/** Similar enough to merge into an existing prototype. */
const MERGE_SIMILARITY = 0.6;

export interface Bin {
  /** Weight, Σw·p and Σw·outcome, all as of `ref`. */
  w: number;
  sp: number;
  sy: number;
}

export interface FamilyArchive {
  /** Time the sums are expressed at (ms). */
  ref: number;
  /** Forecasts at or before this time are already folded in (ms). */
  foldedUntil: number;
  bins: Bin[];
}

export interface Prototype {
  context: DecisionContext;
  action: Episode['action'];
  /** Weight as of `at`. */
  w: number;
  /** Weighted share of bad outcomes. */
  badShare: number;
  /** Last time it absorbed a day (ms). */
  at: number;
}

export interface Archive {
  readiness: FamilyArchive;
  adherence: FamilyArchive;
  pain: FamilyArchive;
  prototypes: Prototype[];
  /** Episodes at or before this time are already in the prototypes (ms). */
  episodesUntil: number;
}

const emptyFamily = (): FamilyArchive => ({
  ref: 0,
  foldedUntil: 0,
  bins: Array.from({ length: BINS }, () => ({ w: 0, sp: 0, sy: 0 })),
});

export const emptyArchive = (): Archive => ({
  readiness: emptyFamily(),
  adherence: emptyFamily(),
  pain: emptyFamily(),
  prototypes: [],
  episodesUntil: 0,
});

function rebase(f: FamilyArchive, now: number): FamilyArchive {
  if (f.ref === 0) return { ...f, ref: now };
  const k = decay(now - f.ref);
  return {
    ...f,
    ref: now,
    bins: f.bins.map((b) => ({ w: b.w * k, sp: b.sp * k, sy: b.sy * k })),
  };
}

/** Folds forecasts newer than `foldedUntil` into the bins, weighted by age. */
export function foldForecasts(f: FamilyArchive, forecasts: Forecast[], now: number): FamilyArchive {
  const fresh = forecasts.filter((x) => new Date(x.at).getTime() > f.foldedUntil);
  if (!fresh.length) return f;
  const out = rebase(f, now);
  const bins = out.bins.map((b) => ({ ...b }));
  let until = f.foldedUntil;
  for (const x of fresh) {
    const t = new Date(x.at).getTime();
    const w = decay(now - t);
    const b = bins[Math.min(BINS - 1, Math.floor(x.p * BINS))];
    b.w += w;
    b.sp += w * x.p;
    b.sy += w * x.outcome;
    until = Math.max(until, t);
  }
  return { ...out, bins, foldedUntil: until };
}

/** The folded past as weighted pseudo-forecasts, oldest-first for prequential scoring. */
export function archivedForecasts(f: FamilyArchive, now: number): Forecast[] {
  const k = f.ref ? decay(now - f.ref) : 1;
  return f.bins
    .filter((b) => b.w * k > 0.01)
    .map((b) => ({ at: '', p: b.sp / b.w, outcome: b.sy / b.w, w: b.w * k }));
}

/** Folds remembered days into the nearest prototype, or starts a new one. */
export function foldEpisodes(
  protos: Prototype[],
  episodes: Episode[],
  until: number,
  now: number,
): { prototypes: Prototype[]; until: number } {
  let out = protos.map((p) => ({ ...p, context: { ...p.context } }));
  let last = until;
  for (const e of episodes) {
    const t = new Date(e.at).getTime();
    if (t <= until) continue;
    last = Math.max(last, t);
    const w = decay(now - t);
    const bad = e.bad ? 1 : 0;
    let best: Prototype | null = null;
    let bestSim = MERGE_SIMILARITY;
    for (const p of out) {
      if (p.action !== e.action) continue;
      const s = similarity(p.context, e.context);
      if (s >= bestSim) {
        best = p;
        bestSim = s;
      }
    }
    if (best) merge(best, { context: e.context, action: e.action, w, badShare: bad, at: now }, now);
    else out.push({ context: { ...e.context }, action: e.action, w, badShare: bad, at: now });
  }
  // Bounded: the two closest prototypes of the same action become one.
  while (out.length > MAX_PROTOTYPES) {
    let pair: [number, number] = [0, 1];
    let top = -1;
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        if (out[i].action !== out[j].action) continue;
        const s = similarity(out[i].context, out[j].context);
        if (s > top) {
          top = s;
          pair = [i, j];
        }
      }
    merge(out[pair[0]], out[pair[1]], now);
    out = out.filter((_, i) => i !== pair[1]);
  }
  return { prototypes: out, until: last };
}

function merge(into: Prototype, add: Prototype, now: number) {
  const a = into.w * decay(now - into.at);
  const b = add.w * decay(now - add.at);
  const w = a + b;
  if (w <= 0) return;
  for (const k of Object.keys(into.context) as (keyof DecisionContext)[])
    into.context[k] = (into.context[k] * a + add.context[k] * b) / w;
  into.badShare = (into.badShare * a + add.badShare * b) / w;
  into.w = w;
  into.at = now;
}

/** Prototypes as weighted cases for recall. */
export function prototypeEpisodes(protos: Prototype[], now: number): Episode[] {
  return protos.map((p, i) => ({
    sessionId: `proto-${i}`,
    at: new Date(p.at).toISOString(),
    context: p.context,
    action: p.action,
    completion: 1,
    perf: null,
    pain: false,
    bad: p.badShare >= 0.5,
    weight: p.w * decay(now - p.at),
    badShare: p.badShare,
  }));
}
