// Shape of an entry in the exercise knowledge base.
//
// One ExerciseEntry covers a canonical movement with its aliases, equipment,
// muscle map, and progression/regression links. Entries are *static data* —
// they live in const arrays so the bundler can tree-shake and so the AI sees
// a coherent, curated catalog even on first run.

import type { Discipline } from '../../../../types/core';

/**
 * High-level movement pattern for filtering / balance analysis.
 */
export type MovementPattern =
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'core_anti_extension'
  | 'core_anti_rotation'
  | 'rotation'
  | 'carry'
  | 'isolation'
  | 'locomotion' // running, cycling, rowing, swimming
  | 'mobility'
  | 'plyometric'
  | 'sport_skill';

export type MuscleGroup =
  | 'chest'
  | 'back_lats'
  | 'back_upper'
  | 'back_lower'
  | 'shoulders_front'
  | 'shoulders_side'
  | 'shoulders_rear'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'hip_flexors'
  | 'adductors'
  | 'abductors'
  | 'cardiovascular'
  | 'full_body';

export type Equipment =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell_plates'
  | 'kettlebell'
  | 'resistance_bands'
  | 'pull_up_bar'
  | 'machine'
  | 'cable'
  | 'bench'
  | 'box'
  | 'medicine_ball'
  | 'jump_rope'
  | 'foam_roller'
  | 'yoga_mat'
  | 'rings'
  | 'parallettes'
  | 'rower'
  | 'treadmill'
  | 'bike'
  | 'pool'
  | 'open_space'
  | 'ball';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export type NaturalMetric =
  | 'reps'
  | 'weight'
  | 'time'
  | 'distance'
  | 'pace'
  | 'rpe'
  | 'rir'
  | 'heart_rate'
  | 'cadence'
  | 'calories'
  | 'rounds';

export interface ExerciseEntry {
  /** Stable id used for cross-referencing progressions/regressions. */
  id: string;
  /** Canonical name in Spanish (we are a Spanish-first app). */
  name: string;
  /** Other ways the user might describe it (English + common variations). */
  aliases: string[];
  disciplines: Discipline[];
  pattern: MovementPattern;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  /** Minimum recommended level. */
  minLevel: Level;
  /** ids of harder variants the user can graduate to. */
  progressions?: string[];
  /** ids of easier variants. */
  regressions?: string[];
  /** Conditions where this is risky (lower-back issue, knee, shoulder, etc.). */
  contraindications?: string[];
  /** Metrics that make sense to track. Drives auto-field selection. */
  naturalMetrics: NaturalMetric[];
  /** Free-form tags ("compound", "warmup", "explosive"…) for filtering. */
  tags?: string[];
  /** One-line coaching cue. */
  cue?: string;
}
