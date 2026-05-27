import type { WorkoutHistoryEntry } from '../../../store/workoutStore';

export interface SessionDelta {
  /** Difference in total volume (kg). Positive = current session heavier. */
  volume: number;
  /** Difference in completed sets. */
  sets: number;
  /** Difference in max weight across all exercises. */
  maxWeight: number;
  /** Number of exercises where current session beat previous. */
  improvedExercises: number;
  /** Number of exercises where current session matched or fell below previous. */
  regressedExercises: number;
}

export interface ComparisonResult {
  previous: WorkoutHistoryEntry | null;
  delta: SessionDelta | null;
  /** ratio of completed sets to planned (0..1). null when no planned data. */
  adherence: number | null;
}

/**
 * Compare the just-finished entry against the most recent prior entry
 * for the same blockId.
 */
export function compareToPrevious(
  current: WorkoutHistoryEntry,
  history: WorkoutHistoryEntry[],
): ComparisonResult {
  const previous =
    history.find(
      (h) => h.id !== current.id && h.blockId === current.blockId && h.endedAt < current.endedAt,
    ) ?? null;

  // Adherence: planned set count from current.exercises (sum of plannedSetsCount).
  let plannedTotal = 0;
  for (const ex of current.exercises) {
    plannedTotal += ex.plannedSetsCount ?? 0;
  }
  const adherence = plannedTotal > 0 ? current.setCount / plannedTotal : null;

  if (!previous) return { previous: null, delta: null, adherence };

  const prevMax = previous.exercises.reduce((m, e) => Math.max(m, e.maxWeight), 0);
  const curMax = current.exercises.reduce((m, e) => Math.max(m, e.maxWeight), 0);

  let improved = 0;
  let regressed = 0;
  for (const cur of current.exercises) {
    const prev = previous.exercises.find((p) => p.exerciseId === cur.exerciseId);
    if (!prev) continue;
    if (cur.totalVolume > prev.totalVolume + 0.01) improved++;
    else regressed++;
  }

  return {
    previous,
    delta: {
      volume: current.totalVolume - previous.totalVolume,
      sets: current.setCount - previous.setCount,
      maxWeight: curMax - prevMax,
      improvedExercises: improved,
      regressedExercises: regressed,
    },
    adherence,
  };
}

export type SuggestionTone = 'progress' | 'maintain' | 'regress' | 'first';

export interface Suggestion {
  tone: SuggestionTone;
  message: string;
}

/**
 * Deterministic next-action message. Sober tone, no motivational fluff.
 * Caller should never overwrite the message — keep it consistent.
 */
export function nextActionSuggestion(c: ComparisonResult): Suggestion {
  if (!c.previous || !c.delta) {
    return { tone: 'first', message: 'Primera sesión registrada. La usaremos como referencia.' };
  }
  const a = c.adherence ?? 1;
  const dv = c.delta.volume;
  const dmw = c.delta.maxWeight;

  if (a < 0.85) {
    return { tone: 'regress', message: 'Repite carga la próxima sesión antes de subir.' };
  }
  if (dmw > 0 && dv > 0) {
    return { tone: 'progress', message: 'Carga superior y volumen superior. Buen margen para progresar.' };
  }
  if (dv > 0) {
    return { tone: 'progress', message: 'Volumen superior a la última sesión.' };
  }
  if (Math.abs(dv) <= 0.01 && dmw === 0) {
    return { tone: 'maintain', message: 'Carga estable. Mantén el plan.' };
  }
  if (dv < 0) {
    return { tone: 'maintain', message: 'Volumen inferior. Repite bloque antes de subir.' };
  }
  return { tone: 'maintain', message: 'Sesión completada según plan.' };
}
