// Load and trend metrics. Chosen for robustness with sparse consumer data:
// session-RPE as the universal load currency, HR-based TRIMP only as a
// refinement when a sensor was present. No ACWR injury-risk claims — the
// evidence doesn't support them; we only compare against the user's own norm.

import type { HeartRateZone, SessionLog, SetLog } from './types';

const DAY_MS = 86_400_000;

/** Foster session-RPE: effort (0–10) × minutes. */
export function sessionLoad(log: Pick<SessionLog, 'rpe' | 'durationMin'>): number {
  const rpe = Math.min(10, Math.max(0, log.rpe));
  return Math.round(rpe * Math.max(0, log.durationMin));
}

export function hrZone(hr: number, hrMax: number): HeartRateZone {
  const pct = hr / hrMax;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

/** Edwards TRIMP: minutes in zone weighted 1–5. */
export function edwardsTrimp(zoneSeconds: readonly number[]): number {
  return Math.round(zoneSeconds.reduce((sum, sec, i) => sum + (sec / 60) * (i + 1), 0));
}

/** Tanaka et al. — more accurate than 220-age for adults. */
export function estimateHrMax(age: number): number {
  return Math.round(208 - 0.7 * age);
}

export type LoadBand = 'baseline' | 'lighter' | 'steady' | 'higher' | 'spike';

export interface LoadTrend {
  acute: number;
  /** Average weekly load over the previous 28 days. */
  chronicWeekly: number;
  ratio: number | null;
  band: LoadBand;
}

/** Last 7 days vs the user's own 28-day weekly average (Apple Training Load style). */
export function loadTrend(logs: SessionLog[], now: Date = new Date()): LoadTrend {
  const t = now.getTime();
  let acute = 0;
  let chronic = 0;
  let oldest = t;
  for (const log of logs) {
    const at = new Date(log.endedAt).getTime();
    const age = t - at;
    if (age < 0) continue;
    if (age <= 7 * DAY_MS) acute += sessionLoad(log);
    if (age <= 28 * DAY_MS) {
      chronic += sessionLoad(log);
      oldest = Math.min(oldest, at);
    }
  }
  // Without ~2 weeks of history a ratio is noise; say so instead.
  const spanDays = (t - oldest) / DAY_MS;
  if (spanDays < 14 || chronic === 0) {
    return { acute, chronicWeekly: chronic / 4, ratio: null, band: 'baseline' };
  }
  const weeks = Math.min(4, spanDays / 7);
  const chronicWeekly = chronic / weeks;
  const ratio = acute / chronicWeekly;
  const band: LoadBand =
    ratio < 0.8 ? 'lighter' : ratio <= 1.3 ? 'steady' : ratio <= 1.5 ? 'higher' : 'spike';
  return { acute, chronicWeekly: Math.round(chronicWeekly), ratio: Number(ratio.toFixed(2)), band };
}

/** Epley e1RM. Unreliable above 10 reps, so we refuse rather than mislead. */
export function estimateOneRepMax(loadKg: number, reps: number): number | null {
  if (reps < 1 || reps > 10 || loadKg <= 0) return null;
  if (reps === 1) return loadKg;
  return Number((loadKg * (1 + reps / 30)).toFixed(1));
}

export function bestSetE1rm(sets: SetLog[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.completed || s.reps === undefined || s.loadKg === undefined) continue;
    const e = estimateOneRepMax(s.loadKg, s.reps);
    if (e !== null && (best === null || e > best)) best = e;
  }
  return best;
}

/** Theil–Sen slope: median of pairwise slopes, robust to a bad day or two. */
export function theilSenSlope(ys: number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    for (let j = i + 1; j < ys.length; j++) slopes.push((ys[j] - ys[i]) / (j - i));
  }
  if (!slopes.length) return 0;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
}

export function roundTo(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(2));
}
