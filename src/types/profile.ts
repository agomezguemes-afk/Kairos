// KAIROS — User Profile Types
// Collected during onboarding, persisted in AsyncStorage.

import type { Discipline } from './core';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal =
  | 'strength'
  | 'endurance'
  | 'weight_loss'
  | 'wellness'
  | 'muscle_gain'
  | 'flexibility';

export interface UserProfile {
  id: string;
  displayName: string | null;
  fitnessLevel: FitnessLevel | null;
  primaryGoal: FitnessGoal | null;
  disciplines: Discipline[];
  weeklyFrequency: number | null;
  age: number | null;
  weight: number | null; // kg
  height: number | null; // cm
  onboardingCompletedAt: string | null; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export function createEmptyProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: `user_${Date.now()}`,
    displayName: null,
    fitnessLevel: null,
    primaryGoal: null,
    disciplines: [],
    weeklyFrequency: null,
    age: null,
    weight: null,
    height: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const FITNESS_LEVEL_OPTIONS: { value: FitnessLevel; label: string; emoji: string }[] = [
  { value: 'beginner', label: 'Principiante', emoji: '🌱' },
  { value: 'intermediate', label: 'Intermedio', emoji: '💪' },
  { value: 'advanced', label: 'Avanzado', emoji: '🏆' },
];

export const FITNESS_GOAL_OPTIONS: { value: FitnessGoal; label: string; emoji: string }[] = [
  { value: 'strength', label: 'Fuerza', emoji: '🏋️' },
  { value: 'endurance', label: 'Resistencia', emoji: '🏃' },
  { value: 'muscle_gain', label: 'Ganar músculo', emoji: '💪' },
  { value: 'weight_loss', label: 'Perder grasa', emoji: '⚖️' },
  { value: 'wellness', label: 'Bienestar general', emoji: '🧘' },
  { value: 'flexibility', label: 'Flexibilidad', emoji: '🤸' },
];

export const DISCIPLINE_OPTIONS: { value: Discipline; label: string; emoji: string }[] = [
  { value: 'strength', label: 'Strength', emoji: '🏋️' },
  { value: 'running', label: 'Running', emoji: '🏃' },
  { value: 'calisthenics', label: 'Calisthenics', emoji: '🤸' },
  { value: 'mobility', label: 'Mobility', emoji: '🧘' },
  { value: 'team_sport', label: 'Team sport', emoji: '⚽' },
  { value: 'cycling', label: 'Cycling', emoji: '🚴' },
  { value: 'swimming', label: 'Swimming', emoji: '🏊' },
  { value: 'general', label: 'General', emoji: '💪' },
];

export const FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '2 días' },
  { value: 3, label: '3 días' },
  { value: 4, label: '4 días' },
  { value: 5, label: '5 días' },
  { value: 6, label: '6 días' },
  { value: 7, label: 'Todos los días' },
];
