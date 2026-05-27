// HealthKit types — kept local to avoid type-import of an optional native module.

import type { Discipline } from '../../types/core';

/** HKWorkoutActivityType constants from HealthKit. Subset we map to. */
export enum HKWorkoutActivityType {
  FunctionalStrengthTraining = 35,
  TraditionalStrengthTraining = 50,
  Running = 37,
  Cycling = 13,
  Swimming = 46,
  Yoga = 57,
  FlexibilityWorkout = 16,
  SoccerLike = 41, // closest to "team sport"
  Other = 3000,
}

export const DISCIPLINE_TO_HK: Record<Discipline, HKWorkoutActivityType> = {
  strength:      HKWorkoutActivityType.TraditionalStrengthTraining,
  calisthenics:  HKWorkoutActivityType.FunctionalStrengthTraining,
  running:       HKWorkoutActivityType.Running,
  cycling:       HKWorkoutActivityType.Cycling,
  swimming:      HKWorkoutActivityType.Swimming,
  mobility:      HKWorkoutActivityType.Yoga,
  team_sport:    HKWorkoutActivityType.SoccerLike,
  general:       HKWorkoutActivityType.Other,
};

export interface WriteWorkoutInput {
  discipline: Discipline;
  startMs: number;
  endMs: number;
  /** Optional kcal estimate. Computed via MET if not provided. */
  totalEnergyKcal?: number;
  /** Optional distance (m). Currently unused — reserved for running/cycling. */
  totalDistanceM?: number;
}

export interface HealthAvailability {
  /** react-native-health module is loadable at runtime. */
  moduleAvailable: boolean;
  /** User granted write permission for workouts. */
  workoutsAuthorized: boolean;
  /** Last error if any. */
  error: string | null;
}
