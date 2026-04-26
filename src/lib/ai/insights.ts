import { useWorkoutStore, type WorkoutHistoryEntry } from '../../store/workoutStore';
import { callGroq, isGroqAvailable } from './groq';

const PLATEAU_THRESHOLD = 0.02; // <2% improvement counts as flat
const MIN_WEEKS_STALLED = 3;
const MAX_INSIGHTS_PER_RUN = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PlateauInfo {
  exerciseId: string;
  exerciseName: string;
  weeksStalled: number;
  lastMax: number;
  suggestion?: string;
}

interface WeeklyPoint {
  weekIndex: number;
  maxWeight: number;
  volume: number;
}

function weekIndexFromTimestamp(t: number): number {
  return Math.floor(t / (7 * MS_PER_DAY));
}

/**
 * Detect plateaus per exercise: best max-weight across consecutive weeks
 * has not improved by more than PLATEAU_THRESHOLD for at least MIN_WEEKS_STALLED weeks.
 */
export function detectPlateaus(history: WorkoutHistoryEntry[]): PlateauInfo[] {
  if (history.length === 0) return [];

  const byExercise = new Map<string, { name: string; weeks: Map<number, WeeklyPoint> }>();
  for (const entry of history) {
    const wIdx = weekIndexFromTimestamp(entry.startedAt);
    for (const ex of entry.exercises) {
      let bucket = byExercise.get(ex.exerciseId);
      if (!bucket) {
        bucket = { name: ex.name, weeks: new Map() };
        byExercise.set(ex.exerciseId, bucket);
      }
      const prev = bucket.weeks.get(wIdx);
      if (!prev) {
        bucket.weeks.set(wIdx, {
          weekIndex: wIdx,
          maxWeight: ex.maxWeight,
          volume: ex.totalVolume,
        });
      } else {
        prev.maxWeight = Math.max(prev.maxWeight, ex.maxWeight);
        prev.volume += ex.totalVolume;
      }
    }
  }

  const plateaus: PlateauInfo[] = [];

  for (const [exerciseId, bucket] of byExercise) {
    const weeks: WeeklyPoint[] = [...bucket.weeks.values()].sort(
      (a, b) => a.weekIndex - b.weekIndex,
    );
    if (weeks.length < MIN_WEEKS_STALLED) continue;

    // Walk back from latest week and count consecutive flat weeks.
    let stalled = 0;
    let bestSeen = 0;
    for (let i = weeks.length - 2; i >= 0; i--) {
      bestSeen = Math.max(bestSeen, weeks[i].maxWeight);
    }
    const latest = weeks[weeks.length - 1];
    // Compare each prior week to the running max-before-it; if the latest never beats
    // the prior best by > threshold, it's a plateau.
    let priorBest = 0;
    for (let i = 0; i < weeks.length - 1; i++) {
      priorBest = Math.max(priorBest, weeks[i].maxWeight);
    }
    if (priorBest === 0) continue;
    const ratio = latest.maxWeight / priorBest;

    if (ratio < 1 + PLATEAU_THRESHOLD) {
      // Count consecutive flat weeks ending at latest.
      stalled = 1;
      for (let i = weeks.length - 2; i >= 0; i--) {
        const earlierBest = Math.max(...weeks.slice(0, i + 1).map((w) => w.maxWeight));
        if (weeks[i].maxWeight / Math.max(1, earlierBest) >= 1 + PLATEAU_THRESHOLD) break;
        stalled += 1;
      }
      if (stalled >= MIN_WEEKS_STALLED && latest.maxWeight > 0) {
        plateaus.push({
          exerciseId,
          exerciseName: bucket.name,
          weeksStalled: stalled,
          lastMax: latest.maxWeight,
        });
      }
    }
  }

  return plateaus
    .sort((a, b) => b.weeksStalled - a.weeksStalled)
    .slice(0, MAX_INSIGHTS_PER_RUN);
}

const COACH_SYSTEM = `Eres Kairos Coach. Responde en español, en máximo 3 frases, con tono amable y científico. Da una sugerencia concreta y accionable.`;

export async function requestInsight(plateau: PlateauInfo): Promise<string> {
  if (!isGroqAvailable()) {
    return `${plateau.exerciseName}: llevas ${plateau.weeksStalled} semanas estancado en ${plateau.lastMax}kg. Prueba con un microciclo de descarga (50% volumen) y sube 2.5kg la siguiente semana.`;
  }
  const user = `El usuario está estancado en "${plateau.exerciseName}" desde hace ${plateau.weeksStalled} semanas. Su mejor peso reciente es ${plateau.lastMax}kg. Dale una sugerencia concreta y amable en máximo 3 frases.`;
  const text = await callGroq(
    [
      { role: 'system', content: COACH_SYSTEM },
      { role: 'user', content: user },
    ],
    { temperature: 0.6, maxTokens: 220 },
  );
  return text.trim() || `${plateau.exerciseName}: prueba a variar series/repeticiones esta semana.`;
}

/**
 * Run after finishWorkout. Detects plateaus from the last ~12 weeks of history
 * and stores any generated insights in the store. Non-blocking.
 */
export async function runPostWorkoutInsights(): Promise<void> {
  const state = useWorkoutStore.getState();
  const cutoff = Date.now() - 12 * 7 * MS_PER_DAY;
  const recent = state.workoutHistory.filter((h) => h.startedAt >= cutoff);
  const plateaus = detectPlateaus(recent);
  if (plateaus.length === 0) return;

  for (const p of plateaus) {
    try {
      const text = await requestInsight(p);
      if (text) useWorkoutStore.getState().addInsight(text);
    } catch {
      // swallow — proactive feature; never blocks UX
    }
  }
}
