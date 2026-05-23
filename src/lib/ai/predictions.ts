import { useWorkoutStore, type WorkoutHistoryEntry } from '../../store/workoutStore';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MilestonePrediction {
  exerciseId: string;
  exerciseName: string;
  metric: 'weight' | 'reps';
  current: number;
  target: number;
  daysToTarget: number;
  date: string; // ISO yyyy-mm-dd
  ratePerWeek: number;
}

interface Sample {
  t: number; // days since epoch
  v: number;
}

/**
 * Linear regression. Returns slope (per day) and intercept.
 * Empty / colinear samples → slope 0.
 */
function linearRegression(samples: Sample[]): { slope: number; intercept: number } {
  const n = samples.length;
  if (n < 2) return { slope: 0, intercept: samples[0]?.v ?? 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (const s of samples) {
    sx += s.t;
    sy += s.v;
    sxy += s.t * s.v;
    sx2 += s.t * s.t;
  }
  const denom = n * sx2 - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function fmtIsoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Predicts when an exercise will reach a goal, based on history.
 * - For weight goals: regress max weight over time (days).
 * - For reps goals: regress max reps over time.
 *
 * Returns null when insufficient data, no positive slope, or already past goal.
 */
export function predictMilestone(
  exerciseId: string,
  history: WorkoutHistoryEntry[],
  goal: { weight?: number; reps?: number },
): MilestonePrediction | null {
  if (history.length === 0) return null;

  const samples: Sample[] = [];
  let lastName = '';
  let lastValue = 0;

  for (const h of history) {
    const ex = h.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    lastName = ex.name;
    const day = Math.floor(h.startedAt / MS_PER_DAY);
    if (goal.weight !== undefined) {
      if (ex.maxWeight > 0) {
        samples.push({ t: day, v: ex.maxWeight });
        if (h.startedAt > (samples[samples.length - 2]?.t ?? 0)) lastValue = ex.maxWeight;
      }
    } else if (goal.reps !== undefined && ex.setsCompleted > 0) {
      // Use sets completed as a coarse rep proxy.
      samples.push({ t: day, v: ex.setsCompleted });
      lastValue = ex.setsCompleted;
    }
  }

  if (samples.length < 2) return null;

  // Sort and drop duplicate-day samples (keep the max per day).
  const byDay = new Map<number, number>();
  for (const s of samples) {
    byDay.set(s.t, Math.max(byDay.get(s.t) ?? -Infinity, s.v));
  }
  const uniq: Sample[] = [...byDay.entries()]
    .map(([t, v]) => ({ t, v }))
    .sort((a, b) => a.t - b.t);
  if (uniq.length < 2) return null;

  const { slope, intercept } = linearRegression(uniq);
  const target = goal.weight ?? goal.reps ?? 0;
  if (target <= 0) return null;

  const todayDay = Math.floor(Date.now() / MS_PER_DAY);
  const currentEstimate = slope * todayDay + intercept;
  const latest = uniq[uniq.length - 1].v;
  const current = Math.max(latest, currentEstimate);

  if (current >= target) return null;
  if (slope <= 0) return null;

  const daysFromEpochToTarget = (target - intercept) / slope;
  const daysToTarget = Math.ceil(daysFromEpochToTarget - todayDay);
  if (!isFinite(daysToTarget) || daysToTarget <= 0 || daysToTarget > 365 * 2) return null;

  const dateMs = (todayDay + daysToTarget) * MS_PER_DAY;

  return {
    exerciseId,
    exerciseName: lastName,
    metric: goal.weight !== undefined ? 'weight' : 'reps',
    current: Math.round(current * 10) / 10,
    target,
    daysToTarget,
    date: fmtIsoDate(dateMs),
    ratePerWeek: Math.round(slope * 7 * 10) / 10,
  };
}

function fmtSpanishDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

export function buildPredictionInsight(p: MilestonePrediction): string {
  const unit = p.metric === 'weight' ? 'kg' : 'reps';
  return `Si sigues así, alcanzarás ${p.target} ${unit} en ${p.exerciseName} el ${fmtSpanishDate(p.date)}.`;
}

/**
 * Iterates over every exercise with a defined goal and emits prediction insights.
 */
export function runPredictionInsights(): string[] {
  const state = useWorkoutStore.getState();
  const goalsByExerciseId = new Map<string, { weight?: number; reps?: number }>();

  for (const block of state.blocks) {
    for (const node of block.content) {
      if (node.type !== 'exercise') continue;
      const ex = node.data.exercise;
      if (ex.goalWeight === undefined && ex.goalReps === undefined) continue;
      goalsByExerciseId.set(ex.id, {
        weight: ex.goalWeight,
        reps: ex.goalReps,
      });
    }
  }

  const insights: string[] = [];
  for (const [exerciseId, goal] of goalsByExerciseId) {
    const p = predictMilestone(exerciseId, state.workoutHistory, goal);
    if (p) insights.push(buildPredictionInsight(p));
  }
  return insights;
}
