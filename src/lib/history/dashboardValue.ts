// dashboardValue — pure calculators for DashboardContentNode display.
//
// Block-scope metrics read from `calculateBlockStats` (operate on the
// current block). Exercise-scope metrics traverse `workoutHistory` via
// the M7a selectors, respecting the lookback window. All exports are
// pure and synchronous.
//
// Why split this from DashboardNode.tsx: the component renders one shape;
// the calculation has 10 branches and a clear contract. Tested in isolation.

import type {
  DashboardLookback,
  DashboardMetric,
  DashboardNodeData,
} from '../../types/content';
import { isExerciseScopedMetric } from '../../types/content';
import type { WorkoutBlock } from '../../types/core';
import { calculateBlockStats } from '../../types/core';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import {
  computeExerciseStats,
  getExerciseHistoryFor,
  type ExerciseSessionPoint,
} from './exerciseHistory';

export interface DashboardValue {
  /** Numeric value when applicable. null = empty / not available. */
  value: number | null;
  /** Formatted string (with unit if any). "—" when value is null. */
  formatted: string;
  /** Unit string, separated so the renderer can style it differently. */
  unit: string;
  /** Series for sparkline viz. Empty when no history. */
  sparkline: number[];
  /**
   * Optional secondary line ("last 4 sessions", "best ever 110 kg").
   * Renderer surfaces this in the support row.
   */
  caption: string | null;
  /**
   * Optional 0..100 progress completion for viz='progress'. Falls back
   * to value/sparkline when the metric isn't naturally a percentage.
   */
  progressPct: number | null;
  /** True when the data set is empty and the tile should hint at why. */
  isEmpty: boolean;
}

const MS_PER_DAY = 86400_000;

function lookbackToMs(l: DashboardLookback): number | null {
  switch (l) {
    case 'session': return 0; // handled specially
    case '4w':      return 28  * MS_PER_DAY;
    case '12w':     return 84  * MS_PER_DAY;
    case 'all':     return null;
  }
}

function filterByLookback(
  history: ExerciseSessionPoint[],
  lookback: DashboardLookback,
  nowMs: number,
): ExerciseSessionPoint[] {
  if (lookback === 'all') return history;
  if (lookback === 'session') {
    return history.length === 0 ? [] : [history[history.length - 1]];
  }
  const windowMs = lookbackToMs(lookback);
  if (windowMs == null) return history;
  const cutoff = nowMs - windowMs;
  return history.filter(p => p.at >= cutoff);
}

function trimZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function abbreviateK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return trimZero(n);
}

/**
 * Compute the value to display for a dashboard node.
 *
 * `nowMs` is injected so callers can test deterministically; default is Date.now().
 */
export function computeDashboardValue(
  data: DashboardNodeData,
  block: WorkoutBlock,
  workoutHistory: WorkoutHistoryEntry[],
  nowMs: number = Date.now(),
): DashboardValue {
  if (!isExerciseScopedMetric(data.metric)) {
    return computeBlockValue(data.metric, block);
  }
  return computeExerciseValue(data, workoutHistory, nowMs);
}

function computeBlockValue(
  metric: DashboardMetric,
  block: WorkoutBlock,
): DashboardValue {
  const stats = calculateBlockStats(block);
  switch (metric) {
    case 'total_volume': {
      const isEmpty = stats.total_volume === 0;
      return {
        value: stats.total_volume,
        formatted: isEmpty ? '—' : abbreviateK(stats.total_volume),
        unit: 'kg',
        sparkline: [],
        caption: null,
        progressPct: stats.total_sets > 0
          ? Math.round((stats.completed_sets / stats.total_sets) * 100)
          : 0,
        isEmpty,
      };
    }
    case 'completed_sets':
      return {
        value: stats.completed_sets,
        formatted: String(stats.completed_sets),
        unit: '',
        sparkline: [],
        caption: stats.total_sets > 0 ? `de ${stats.total_sets}` : null,
        progressPct: stats.total_sets > 0
          ? Math.round((stats.completed_sets / stats.total_sets) * 100)
          : 0,
        isEmpty: stats.total_sets === 0,
      };
    case 'total_exercises':
      return {
        value: stats.total_exercises,
        formatted: String(stats.total_exercises),
        unit: '',
        sparkline: [],
        caption: null,
        progressPct: null,
        isEmpty: stats.total_exercises === 0,
      };
    case 'completion_pct':
      return {
        value: stats.completion_percentage,
        formatted: String(stats.completion_percentage),
        unit: '%',
        sparkline: [],
        caption: stats.total_sets > 0
          ? `${stats.completed_sets}/${stats.total_sets} series`
          : null,
        progressPct: stats.completion_percentage,
        isEmpty: stats.total_sets === 0,
      };
    case 'estimated_duration':
      return {
        value: stats.estimated_duration,
        formatted: String(stats.estimated_duration),
        unit: 'min',
        sparkline: [],
        caption: null,
        progressPct: null,
        isEmpty: stats.total_sets === 0,
      };
    default:
      return emptyValue();
  }
}

function computeExerciseValue(
  data: DashboardNodeData,
  workoutHistory: WorkoutHistoryEntry[],
  nowMs: number,
): DashboardValue {
  // No binding yet — config-pending state.
  if (!data.exerciseId && !data.libraryId && !data.exerciseName) {
    return {
      ...emptyValue(),
      caption: 'Selecciona un ejercicio',
    };
  }

  const lookback: DashboardLookback = data.lookback ?? '4w';
  const ref = {
    libraryId: data.libraryId,
    name: data.exerciseName ?? '',
  };

  const fullHistory = getExerciseHistoryFor(ref, workoutHistory);
  const filtered = filterByLookback(fullHistory, lookback, nowMs);

  if (filtered.length === 0) {
    return {
      ...emptyValue(),
      caption: 'Sin sesiones registradas',
    };
  }

  // Stats computed on the filtered window so the sparkline tracks lookback,
  // but allTimeMax* references the full history for "best ever" captions.
  const filteredStats = computeExerciseStats(filtered);
  const allTimeStats = computeExerciseStats(fullHistory);
  const captionLookback = lookbackLabel(lookback);

  switch (data.metric) {
    case 'exercise_max_weight': {
      const maxIn = filteredStats.allTimeMaxWeight ?? 0;
      const maxAll = allTimeStats.allTimeMaxWeight ?? 0;
      const atAllTime = maxIn > 0 && maxIn >= maxAll - 0.01;
      return {
        value: maxIn || null,
        formatted: maxIn > 0 ? trimZero(maxIn) : '—',
        unit: 'kg',
        sparkline: filteredStats.sparkline,
        caption: atAllTime
          ? `Récord absoluto · ${captionLookback}`
          : maxAll > 0
            ? `Récord ${trimZero(maxAll)} kg · ${captionLookback}`
            : captionLookback,
        progressPct: maxAll > 0 ? Math.round((maxIn / maxAll) * 100) : null,
        isEmpty: maxIn === 0,
      };
    }
    case 'exercise_volume': {
      const totalVol = filtered.reduce((acc, p) => acc + p.volume, 0);
      return {
        value: totalVol || null,
        formatted: totalVol > 0 ? abbreviateK(totalVol) : '—',
        unit: 'kg',
        sparkline: filtered.map(p => p.volume),
        caption: `${filtered.length} ${filtered.length === 1 ? 'sesión' : 'sesiones'} · ${captionLookback}`,
        progressPct: null,
        isEmpty: totalVol === 0,
      };
    }
    case 'exercise_estimated_1rm': {
      const maxRm = filteredStats.allTimeMaxOneRm ?? 0;
      const maxRmAll = allTimeStats.allTimeMaxOneRm ?? 0;
      return {
        value: maxRm || null,
        formatted: maxRm > 0 ? trimZero(maxRm) : '—',
        unit: 'kg',
        sparkline: filtered.map(p => p.estimatedOneRm ?? 0),
        caption: maxRmAll > 0 && maxRm < maxRmAll - 0.01
          ? `1RM total ${trimZero(maxRmAll)} kg`
          : `Estimado (Epley) · ${captionLookback}`,
        progressPct: maxRmAll > 0 ? Math.round((maxRm / maxRmAll) * 100) : null,
        isEmpty: maxRm === 0,
      };
    }
    case 'exercise_freq': {
      const freq = filtered.length;
      // Express as sessions per week for 4w/12w windows.
      let perWeek: number | null = null;
      if (lookback === '4w')  perWeek = Math.round((freq / 4) * 10) / 10;
      if (lookback === '12w') perWeek = Math.round((freq / 12) * 10) / 10;
      return {
        value: freq,
        formatted: String(freq),
        unit: freq === 1 ? 'sesión' : 'sesiones',
        sparkline: [],
        caption: perWeek != null ? `${perWeek}/semana · ${captionLookback}` : captionLookback,
        progressPct: null,
        isEmpty: freq === 0,
      };
    }
    case 'exercise_last_top': {
      const last = filtered[filtered.length - 1];
      if (!last || last.topWeight == null) {
        return {
          ...emptyValue(),
          caption: 'Sin top set registrado',
        };
      }
      return {
        value: last.topWeight,
        formatted: trimZero(last.topWeight),
        unit: 'kg',
        sparkline: filtered.map(p => p.topWeight ?? 0),
        caption: last.topReps != null
          ? `× ${last.topReps} · ${formatRelative(nowMs - last.at)}`
          : formatRelative(nowMs - last.at),
        progressPct: null,
        isEmpty: false,
      };
    }
    default:
      return emptyValue();
  }
}

function emptyValue(): DashboardValue {
  return {
    value: null,
    formatted: '—',
    unit: '',
    sparkline: [],
    caption: null,
    progressPct: null,
    isEmpty: true,
  };
}

function lookbackLabel(l: DashboardLookback): string {
  switch (l) {
    case 'session': return 'última sesión';
    case '4w':      return '4 semanas';
    case '12w':     return '12 semanas';
    case 'all':     return 'todo el historial';
  }
}

function formatRelative(ms: number): string {
  const days = Math.floor(ms / MS_PER_DAY);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7)   return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'hace 1 semana';
  if (weeks < 8)   return `hace ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
}
