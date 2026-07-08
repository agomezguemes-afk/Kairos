// KAIROS — deriveSnapshot (pure).
//
// Bridges the real app data to Kai's brain WITHOUT importing the night-run's
// store (no collision): the caller passes a minimal, store-shaped snapshot and
// this derives the ActivitySnapshot that `brain.think` consumes — session
// cadence, per-domain counts, and a per-metric time series (so plateau/PR
// detection runs on real lifts). Pure → unit-tested; the app just maps its
// `workoutStore` into `StoreSnapshot` at the edge.

import type { ActivitySnapshot } from './brain';
import type { MetricPoint } from './metricTrend';

export interface HistoryExercise {
  name: string;
  /** Heaviest load that session (the series value for plateau/PR). */
  maxWeight: number;
  /** Stable id to group the same lift across sessions (falls back to name). */
  libraryId?: string;
}

export interface HistoryEntry {
  /** Session end time, ms. */
  endedAt: number;
  /** Discipline of the session (defaults to 'general'). */
  domain?: string;
  exercises: readonly HistoryExercise[];
}

export interface StoreSnapshot {
  history: readonly HistoryEntry[];
  blocksCount: number;
  streak: number;
}

const DAY = 24 * 3600 * 1000;

/**
 * Map a store-shaped snapshot into the ActivitySnapshot Kai's brain consumes.
 * Robust to garbage timestamps/values (dropped). `metricSeries` keys are the
 * lift's display name so proposals/reflections can speak it back.
 */
export function deriveSnapshot(store: StoreSnapshot, now: number): ActivitySnapshot {
  const clean = store.history
    .filter((h) => h && Number.isFinite(h.endedAt))
    .sort((a, b) => a.endedAt - b.endedAt);

  const last = clean[clean.length - 1];
  const daysSinceLastWorkout =
    last != null ? Math.max(0, Math.floor((now - last.endedAt) / DAY)) : null;

  const sevenDaysAgo = now - 7 * DAY;
  const sessionsLast7Days = clean.filter((h) => h.endedAt >= sevenDaysAgo).length;

  // Per-domain counts over the last 14 days (recent focus).
  const fourteenDaysAgo = now - 14 * DAY;
  const domainCounts: Record<string, number> = {};
  for (const h of clean) {
    if (h.endedAt < fourteenDaysAgo) continue;
    const d = typeof h.domain === 'string' && h.domain ? h.domain : 'general';
    domainCounts[d] = (domainCounts[d] ?? 0) + 1;
  }

  // Per-lift series (display name → points), for generic plateau/PR detection.
  const byLift = new Map<string, { name: string; points: MetricPoint[] }>();
  for (const h of clean) {
    for (const ex of h.exercises ?? []) {
      if (!ex || !Number.isFinite(ex.maxWeight) || typeof ex.name !== 'string' || !ex.name)
        continue;
      const key = ex.libraryId ?? ex.name.toLowerCase();
      let entry = byLift.get(key);
      if (!entry) {
        entry = { name: ex.name, points: [] };
        byLift.set(key, entry);
      }
      entry.points.push({ t: h.endedAt, value: ex.maxWeight });
    }
  }
  const metricSeries: Record<string, MetricPoint[]> = {};
  for (const { name, points } of byLift.values()) {
    // Only keep lifts with enough history to say anything (matches metricTrend).
    if (points.length >= 3) metricSeries[name] = points;
  }

  return {
    daysSinceLastWorkout,
    sessionsLast7Days,
    domainCounts,
    streak: store.streak,
    blocksCount: store.blocksCount,
    metricSeries,
  };
}
