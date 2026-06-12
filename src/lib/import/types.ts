// Common intermediate representation for external workout imports.
// Both parsers (Strong, Hevy) normalize into this; toHistory.ts maps it onto
// Kairos' WorkoutHistoryEntry model.

export interface ImportedSet {
  weight: number | null;
  reps: number | null;
  rpe?: number;
  distanceKm?: number;
  durationSec?: number;
  /** 'warmup' mirrors Kairos SetKind; everything else imports as working. */
  isWarmup?: boolean;
}

export interface ImportedExercise {
  name: string;
  sets: ImportedSet[];
}

export interface ImportedWorkout {
  name: string;
  startedAt: number;
  /** Epoch ms; null when the source had no end time/duration. */
  endedAt: number | null;
  exercises: ImportedExercise[];
}

export type ImportFormat = 'strong' | 'hevy';

export interface ImportParseResult {
  format: ImportFormat;
  workouts: ImportedWorkout[];
  /** Non-fatal anomalies (skipped rows, unparseable dates…). */
  warnings: string[];
}

export interface ImportPreview {
  format: ImportFormat;
  workoutCount: number;
  exerciseCount: number;
  setCount: number;
  dateRange: { from: number; to: number } | null;
  warnings: string[];
}

export function buildPreview(result: ImportParseResult): ImportPreview {
  const exerciseNames = new Set<string>();
  let setCount = 0;
  let from = Infinity;
  let to = -Infinity;
  for (const w of result.workouts) {
    from = Math.min(from, w.startedAt);
    to = Math.max(to, w.startedAt);
    for (const ex of w.exercises) {
      exerciseNames.add(ex.name.toLowerCase());
      setCount += ex.sets.length;
    }
  }
  return {
    format: result.format,
    workoutCount: result.workouts.length,
    exerciseCount: exerciseNames.size,
    setCount,
    dateRange: result.workouts.length > 0 ? { from, to } : null,
    warnings: result.warnings,
  };
}
