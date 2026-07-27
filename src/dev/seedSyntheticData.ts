// KAIROS — DEV ONLY: synthetic history seed for simulator demos.
//
// Generates workout history FROM the real block generators (starter templates +
// hybrid preset) so exercise names and field ids match what Kai builds — that's
// what makes the progression cue ("Con tus números de la última vez"), the
// pre-filled values and the PR badges fire with believable data. Idempotent via
// importWorkoutHistory's (startedAt, blockName) dedupe + day-anchored dates.
//
// Never ships: guarded by __DEV__ and SEED_SYNTHETIC. Delete freely.

import { useWorkoutStore } from '../store/workoutStore';
import type { WorkoutHistoryEntry, ExerciseHistorySummary } from '../store/workoutStore';
import { getBlockExercises } from '../types/core';
import type { ExerciseCard, WorkoutBlock } from '../types/core';
import { inferBriefFromText, briefToStarterAnswers } from '../lib/ai/conversation/brief';
import { buildStarterBlocks } from '../lib/routines/starterTemplates';
import { buildHybridRaceBlock } from '../lib/routines/hybridPreset';

export const SEED_SYNTHETIC = true;

const SEED_USER = 'user_001';

/** Plausible demo value per semantic field id. Session n (0-based) trends up. */
function demoValue(fieldId: string, exIndex: number, session: number): number {
  switch (fieldId) {
    case 'weight':
      return 40 + exIndex * 10 + session * 2.5;
    case 'reps':
      return 8;
    case 'pace': // min/km — lower is better, so it improves down
      return 5.5 - session * 0.2;
    case 'distance':
      return 2.5 + session * 0.5;
    case 'calories':
      return 12 + session * 2;
    case 'duration':
    case 'time':
      return 30;
    default:
      return 10 + session;
  }
}

/** 18:00 local, `daysAgo` days back — stable within a day for dedupe. */
function sessionStamp(daysAgo: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(18, 0, 0, 0);
  return d.getTime();
}

function summarizeExercise(
  ex: ExerciseCard,
  exIndex: number,
  session: number,
  isLastSession: boolean,
): ExerciseHistorySummary {
  const setCount = Math.max(ex.sets.length, 3);
  const performedSets = Array.from({ length: setCount }, () => {
    const values: Record<string, number> = {};
    for (const f of ex.fields) values[f.id] = demoValue(f.id, exIndex, session);
    const weight = typeof values['weight'] === 'number' ? values['weight'] : null;
    const reps = typeof values['reps'] === 'number' ? values['reps'] : null;
    return {
      weight,
      reps,
      completed: true,
      // Last session's sets at RPE 6 → "was easy" → Kai suggests +2.5 kg today.
      rpe: isLastSession ? 6 : 7,
      notes: null,
      values,
    };
  });

  const weights = performedSets.map((s) => s.weight ?? 0);
  const volume = performedSets.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);
  return {
    exerciseId: ex.id,
    libraryId: ex.libraryId,
    name: ex.name,
    maxWeight: Math.max(...weights, 0),
    totalVolume: volume,
    setsCompleted: performedSets.length,
    performedSets,
  };
}

function entryFor(block: WorkoutBlock, session: number, daysAgo: number): WorkoutHistoryEntry {
  const exercises = getBlockExercises(block);
  const isLast = daysAgo <= 3;
  const summaries = exercises.map((ex, i) => summarizeExercise(ex, i, session, isLast));
  const startedAt = sessionStamp(daysAgo);
  return {
    id: `seed-${block.name.toLowerCase().replace(/\s+/g, '-')}-${session}`,
    blockId: block.id,
    blockName: block.name,
    source: 'free',
    startedAt,
    endedAt: startedAt + 45 * 60 * 1000,
    exerciseCount: summaries.length,
    setCount: summaries.reduce((a, s) => a + s.setsCompleted, 0),
    totalVolume: summaries.reduce((a, s) => a + s.totalVolume, 0),
    durationSec: 45 * 60,
    exercises: summaries,
  };
}

function doSeed(): void {
  const store = useWorkoutStore.getState();

  // Skip onboarding so the sim lands on the populated home.
  const now = new Date().toISOString();
  useWorkoutStore.setState((s) => ({
    onboardingCompletedAt: s.onboardingCompletedAt ?? now,
    tourCompletedAt: s.tourCompletedAt ?? now,
    userName: s.userName || 'Álvaro',
  }));

  // Blocks come from the same generators Kai uses → names/field ids match.
  const legs = buildStarterBlocks(
    briefToStarterAnswers(inferBriefFromText('piernas 40 minutos en casa')),
    SEED_USER,
    0,
  )[0];
  const run = buildStarterBlocks(
    briefToStarterAnswers(inferBriefFromText('salir a correr 30 minutos suaves')),
    SEED_USER,
    0,
  )[0];
  const hybrid = buildHybridRaceBlock();

  const entries: WorkoutHistoryEntry[] = [
    entryFor(legs, 0, 10),
    entryFor(legs, 1, 3), // most recent legs → RPE 6 → +2.5 kg suggestion
    entryFor(run, 0, 7),
    entryFor(run, 1, 2), // pace improves 5.5 → 5.3
    entryFor(hybrid, 0, 5),
  ];

  const added = store.importWorkoutHistory(entries);
  if (added > 0) console.log(`[seed] synthetic history: +${added} sessions`);
}

/** Call once from App start. No-op outside dev or when disabled. */
export function seedSyntheticData(): void {
  if (!__DEV__ || !SEED_SYNTHETIC) return;
  const persist = useWorkoutStore.persist;
  const run = () => {
    try {
      doSeed();
    } catch (e) {
      console.warn('[seed] failed:', e);
    }
  };
  if (persist?.hasHydrated?.()) run();
  else persist?.onFinishHydration?.(run);
}
