// Engine v2 · phase 3 — per-region muscular recovery with a personal rate.
// Spec: docs/engine/ENGINE-v2.md §Recuperación por región muscular.

import type { CheckIn } from '../adaptive/checkins';
import type { MovementLog, SessionLog } from '../adaptive/types';

export type Region = 'legs' | 'posterior' | 'pull' | 'push' | 'core' | 'grip' | 'calves';

export const REGION_LABEL: Record<Region, string> = {
  legs: 'Piernas',
  posterior: 'Cadena posterior',
  pull: 'Tracción',
  push: 'Empuje',
  core: 'Core',
  grip: 'Agarre',
  calves: 'Gemelos',
};

/** Region weights per catalogue movement (0–1). Unknown movements load nothing. */
export const MOVEMENT_REGIONS: Record<string, Partial<Record<Region, number>>> = {
  back_squat: { legs: 1, posterior: 0.5, core: 0.3 },
  romanian_deadlift: { posterior: 1, grip: 0.4, core: 0.3 },
  pull_up: { pull: 1, grip: 0.6, core: 0.2 },
  one_arm_row: { pull: 0.9, grip: 0.4 },
  step_up: { legs: 0.8, posterior: 0.4 },
  split_squat: { legs: 0.9, posterior: 0.4 },
  calf_raise: { calves: 1 },
  max_hang: { grip: 1, pull: 0.3 },
  repeaters: { grip: 1, pull: 0.3 },
  core_lever: { core: 1, pull: 0.3 },
  court_intervals: { legs: 0.5, calves: 0.5 },
  lateral_shuffle: { legs: 0.6, calves: 0.4 },
  rotational_throw: { core: 0.8, push: 0.3 },
  easy_run: { legs: 0.3, calves: 0.4 },
  run_intervals: { legs: 0.5, calves: 0.5 },
  long_run: { legs: 0.5, calves: 0.6 },
  loaded_hike: { legs: 0.6, posterior: 0.3, calves: 0.4 },
  z2_ride: { legs: 0.4 },
  sweet_spot: { legs: 0.6 },
  swim_aerobic: { pull: 0.4, push: 0.3 },
  box_jump: { legs: 0.7, calves: 0.5 },
  sprints: { legs: 0.6, posterior: 0.5, calves: 0.5 },
  hip_mobility: {},
  shoulder_mobility: {},
};

/** Plyometric / eccentric-heavy movements damage more (×1.2). */
const ECCENTRIC = new Set(['box_jump', 'sprints', 'romanian_deadlift', 'long_run']);
const HOUR_MS = 3_600_000;
/** Damage of a typical hard session: 12 sets at RIR 1 on one region. */
const F_REF = 12 * (1 + 0.15 * 2);
export const RATE_GRID = [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6, 1.8];
const RATE_PRIOR_SD = 0.3;

interface Hit {
  at: number;
  region: Region;
  damage: number;
  sets: number;
}

/** Set-equivalents of one logged movement, so endurance work also counts. */
function setEquivalents(m: MovementLog): { sets: number; intensity: number } {
  const done = m.sets.filter((s) => s.completed);
  if (!done.length) return { sets: 0, intensity: 0 };
  const strength = done.some((s) => s.reps !== undefined);
  if (strength) {
    const avgRir = done.reduce((a, s) => a + (s.rir ?? 2), 0) / done.length;
    return { sets: done.length, intensity: 1 + 0.15 * Math.max(0, 3 - avgRir) };
  }
  // Steady/interval work: 20 min ≈ one moderate set.
  const minutes = done.reduce((a, s) => a + (s.durationSec ?? 0), 0) / 60;
  return { sets: minutes / 20, intensity: 0.6 };
}

export function regionHits(sessions: SessionLog[]): Hit[] {
  const hits: Hit[] = [];
  for (const s of sessions) {
    const at = new Date(s.endedAt).getTime();
    if (!Number.isFinite(at)) continue;
    for (const m of s.movements) {
      const map = MOVEMENT_REGIONS[m.movementId];
      if (!map) continue;
      const { sets, intensity } = setEquivalents(m);
      const ecc = ECCENTRIC.has(m.movementId) ? 1.2 : 1;
      for (const [r, w] of Object.entries(map) as [Region, number][]) {
        if (w > 0 && sets > 0)
          hits.push({ at, region: r, damage: sets * w * intensity * ecc, sets });
      }
    }
  }
  return hits;
}

/** τ in hours: slower recovery after more volume; m is the personal rate. */
const tauHours = (sets: number, m: number) => m * 24 * (1 + 0.25 * Math.log(1 + sets));

/**
 * Damage older than this is below e⁻⁹ of its size even at the slowest rate
 * and largest volume (τ ≤ ~80 h): skipping it changes nothing measurable
 * and keeps every lookup independent of how long the history is.
 */
export const RECOVERY_WINDOW_MS = 30 * 24 * HOUR_MS;

export function recoveredAt(hits: Hit[], region: Region, t: number, m: number): number {
  let F = 0;
  for (const h of hits) {
    if (h.region !== region || h.at > t || t - h.at > RECOVERY_WINDOW_MS) continue;
    F += h.damage * Math.exp(-(t - h.at) / HOUR_MS / tauHours(h.sets, m));
  }
  return 1 - Math.min(1, F / F_REF);
}

// ── Personal recovery rate from soreness reports (cumulative logit) ──

const CUTS = [0.5, 1.5, 2.5, 3.5];
const SLOPE = 4;
const sig = (x: number) => 1 / (1 + Math.exp(-x));

/** P(soreness = k | worst-region fatigue f) under a cumulative-logit model. */
export function sorenessLikelihood(k: number, fatigue: number): number {
  const eta = SLOPE * fatigue;
  const cdf = (j: number) => (j <= 0 ? 0 : j >= 5 ? 1 : sig(CUTS[j - 1] - eta));
  return Math.max(1e-6, cdf(k) - cdf(k - 1));
}

export interface RatePosterior {
  /** Posterior mean of the personal rate m (1 = literature average). */
  mean: number;
  sd: number;
  reports: number;
}

/** First index with at ≥ t in hits sorted by time. */
function lowerBound(hits: Hit[], t: number): number {
  let lo = 0;
  let hi = hits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid].at < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function recoveryRate(sessions: SessionLog[], checkins: CheckIn[]): RatePosterior {
  const hits = regionHits(sessions).sort((a, b) => a.at - b.at);
  const reports = checkins.filter((c) => c.kind === 'pre' && c.soreness !== undefined);
  const regions = Object.keys(REGION_LABEL) as Region[];
  // Each report only sees the hits inside the window: O(reports × recent hits).
  const windows = reports.map((c) => {
    const t = new Date(c.at).getTime();
    return {
      t,
      k: c.soreness!,
      hits: hits.slice(lowerBound(hits, t - RECOVERY_WINDOW_MS), lowerBound(hits, t + 1)),
    };
  });
  const logPost = RATE_GRID.map((m) => {
    let lp = -((Math.log(m) / RATE_PRIOR_SD) ** 2) / 2;
    for (const w of windows) {
      const worst = Math.max(...regions.map((r) => 1 - recoveredAt(w.hits, r, w.t, m)));
      lp += Math.log(sorenessLikelihood(w.k, worst));
    }
    return lp;
  });
  const max = Math.max(...logPost);
  const w = logPost.map((l) => Math.exp(l - max));
  const z = w.reduce((a, b) => a + b, 0);
  const mean = RATE_GRID.reduce((a, m, i) => a + (m * w[i]) / z, 0);
  const sd = Math.sqrt(RATE_GRID.reduce((a, m, i) => a + ((m - mean) ** 2 * w[i]) / z, 0));
  return { mean, sd, reports: reports.length };
}

export interface RegionStatus {
  region: Region;
  label: string;
  recovered: number;
  /** Hours until ≥ 90 % recovered (0 if already). Capped at 7 days. */
  hoursToReady: number;
}

export function recoveryStatus(sessions: SessionLog[], now: Date, m: number): RegionStatus[] {
  const hits = regionHits(sessions);
  const t = now.getTime();
  return (Object.keys(REGION_LABEL) as Region[]).map((region) => {
    const recovered = recoveredAt(hits, region, t, m);
    let hoursToReady = 0;
    if (recovered < 0.9) {
      hoursToReady = 168;
      for (let h = 1; h <= 168; h++) {
        if (recoveredAt(hits, region, t + h * HOUR_MS, m) >= 0.9) {
          hoursToReady = h;
          break;
        }
      }
    }
    return { region, label: REGION_LABEL[region], recovered, hoursToReady };
  });
}

/** Region weights of a planned session (movement ids), normalised to max 1. */
export function sessionRegions(movementIds: string[]): Partial<Record<Region, number>> {
  const out: Partial<Record<Region, number>> = {};
  for (const id of movementIds) {
    for (const [r, w] of Object.entries(MOVEMENT_REGIONS[id] ?? {}) as [Region, number][]) {
      out[r] = Math.max(out[r] ?? 0, w);
    }
  }
  return out;
}
