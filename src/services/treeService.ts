// KAIROS — Tree Service
// Pure functions for progress tree calculations.

import type { TreeType, TreeProgress, TreeMetrics, TreeTypeConfig } from '../types/tree';
import { TREE_CONFIGS } from '../types/tree';
import type { WorkoutBlock, ExerciseSet } from '../types/core';
import { getBlockExercises } from '../types/core';

// ======================== PROGRESS CALCULATION ========================

/** Get the raw metric value for the given tree type. */
export function getMetricValue(type: TreeType, metrics: TreeMetrics): number {
  switch (type) {
    case 'oak':
      return metrics.totalVolume;
    case 'palm':
      return metrics.totalDistance;
    case 'bamboo':
      return metrics.totalActiveDays;
    case 'cactus':
      return metrics.totalPRs;
  }
}

/** Calculate level and progress from metrics. */
export function calculateProgress(type: TreeType, metrics: TreeMetrics): TreeProgress {
  const config = TREE_CONFIGS[type];
  const value = getMetricValue(type, metrics);
  const { thresholds } = config;

  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }

  const nextThreshold = level < 5 ? thresholds[level] : null;
  const prevThreshold = level > 0 ? thresholds[level - 1] : 0;

  let percentToNext = 0;
  if (nextThreshold !== null) {
    const range = nextThreshold - prevThreshold;
    const progress = value - prevThreshold;
    percentToNext = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 0;
  } else {
    percentToNext = 100;
  }

  return {
    treeType: type,
    level,
    currentValue: value,
    nextThreshold,
    percentToNext,
  };
}

// ======================== METRIC AGGREGATION ========================

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Compute full metrics from all blocks (scan all completed sets).
 * Called on load to rebuild from source of truth.
 */
export function computeMetricsFromBlocks(
  blocks: WorkoutBlock[],
  prCount: number,
): TreeMetrics {
  let totalVolume = 0;
  let totalDistance = 0;
  const activeDays = new Set<string>();

  for (const block of blocks) {
    for (const ex of getBlockExercises(block)) {
      const hasWeight = ex.fields.some((f) => f.id === 'weight');
      const hasReps = ex.fields.some((f) => f.id === 'reps');
      const hasDistance = ex.fields.some((f) => f.id === 'distance');

      for (const set of ex.sets) {
        if (!set.completed) continue;

        // Track active day
        if (set.completed_at) {
          activeDays.add(toDateKey(new Date(set.completed_at)));
        }

        // Volume (kg * reps)
        if (hasWeight && hasReps) {
          const w = typeof set.values['weight'] === 'number' ? (set.values['weight'] as number) : 0;
          const r = typeof set.values['reps'] === 'number' ? (set.values['reps'] as number) : 0;
          totalVolume += w * r;
        }

        // Distance (km)
        if (hasDistance) {
          const d = typeof set.values['distance'] === 'number' ? (set.values['distance'] as number) : 0;
          totalDistance += d;
        }
      }
    }
  }

  return {
    totalVolume: Math.round(totalVolume),
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalActiveDays: activeDays.size,
    totalPRs: prCount,
    activeDaySet: Array.from(activeDays),
  };
}

/**
 * Incrementally update metrics when a single set is completed.
 * Faster than recomputing from all blocks.
 */
export function updateMetricsForSet(
  prev: TreeMetrics,
  set: ExerciseSet,
  exerciseFields: { id: string; type: string }[],
): TreeMetrics {
  const next = { ...prev, activeDaySet: [...prev.activeDaySet] };
  const today = toDateKey(new Date());

  // Active day
  if (!next.activeDaySet.includes(today)) {
    next.activeDaySet.push(today);
    next.totalActiveDays = next.activeDaySet.length;
  }

  // Volume
  const hasWeight = exerciseFields.some((f) => f.id === 'weight');
  const hasReps = exerciseFields.some((f) => f.id === 'reps');
  if (hasWeight && hasReps) {
    const w = typeof set.values['weight'] === 'number' ? (set.values['weight'] as number) : 0;
    const r = typeof set.values['reps'] === 'number' ? (set.values['reps'] as number) : 0;
    next.totalVolume = Math.round(prev.totalVolume + w * r);
  }

  // Distance
  const hasDistance = exerciseFields.some((f) => f.id === 'distance');
  if (hasDistance) {
    const d = typeof set.values['distance'] === 'number' ? (set.values['distance'] as number) : 0;
    next.totalDistance = Math.round((prev.totalDistance + d) * 10) / 10;
  }

  return next;
}

/** Bump PR count. */
export function incrementPRCount(prev: TreeMetrics): TreeMetrics {
  return { ...prev, totalPRs: prev.totalPRs + 1 };
}
