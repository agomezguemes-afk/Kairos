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

export type WorkoutPlace = 'home' | 'gym' | 'outdoors' | 'mixed';

export type EquipmentTag =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell_plates'
  | 'kettlebell'
  | 'resistance_bands'
  | 'pull_up_bar'
  | 'machines_full_gym'
  | 'cardio_equipment'
  | 'yoga_mat'
  | 'jump_rope';

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
  injuries: string | null;
  workoutPlace: WorkoutPlace | null;
  /** Standardised equipment tags + free-form note (multi-select + freeform). */
  equipment: EquipmentTag[];
  equipmentNotes: string | null;
  onboardingCompletedAt: string | null; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export const EQUIPMENT_OPTIONS: { value: EquipmentTag; label: string; icon: string }[] = [
  { value: 'bodyweight', label: 'Solo peso corporal', icon: 'calisthenics' },
  { value: 'dumbbells', label: 'Mancuernas', icon: 'weightlifting' },
  { value: 'barbell_plates', label: 'Barra + discos', icon: 'weightlifting' },
  { value: 'kettlebell', label: 'Kettlebell', icon: 'weightlifting' },
  { value: 'resistance_bands', label: 'Bandas elásticas', icon: 'mobility' },
  { value: 'pull_up_bar', label: 'Barra de dominadas', icon: 'calisthenics' },
  { value: 'machines_full_gym', label: 'Gimnasio / máquinas', icon: 'strength' },
  { value: 'cardio_equipment', label: 'Cardio (cinta, bici, remo)', icon: 'running' },
  { value: 'yoga_mat', label: 'Esterilla / yoga', icon: 'mobility' },
  { value: 'jump_rope', label: 'Cuerda de saltar', icon: 'team_sport' },
];

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
    injuries: null,
    workoutPlace: null,
    equipment: [],
    equipmentNotes: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const FITNESS_LEVEL_OPTIONS: { value: FitnessLevel; label: string; icon: string }[] = [
  { value: 'beginner', label: 'Principiante', icon: 'seedling' },
  { value: 'intermediate', label: 'Intermedio', icon: 'strength' },
  { value: 'advanced', label: 'Avanzado', icon: 'trophy' },
];

export const FITNESS_GOAL_OPTIONS: { value: FitnessGoal; label: string; icon: string }[] = [
  { value: 'strength', label: 'Fuerza', icon: 'weightlifting' },
  { value: 'endurance', label: 'Resistencia', icon: 'running' },
  { value: 'muscle_gain', label: 'Ganar músculo', icon: 'strength' },
  { value: 'weight_loss', label: 'Perder grasa', icon: 'pick.scale' },
  { value: 'wellness', label: 'Bienestar general', icon: 'mobility' },
  { value: 'flexibility', label: 'Flexibilidad', icon: 'calisthenics' },
];

export const DISCIPLINE_OPTIONS: { value: Discipline; label: string; icon: string }[] = [
  { value: 'strength', label: 'Strength', icon: 'weightlifting' },
  { value: 'running', label: 'Running', icon: 'running' },
  { value: 'calisthenics', label: 'Calisthenics', icon: 'calisthenics' },
  { value: 'mobility', label: 'Mobility', icon: 'mobility' },
  { value: 'team_sport', label: 'Team sport', icon: 'team_sport' },
  { value: 'cycling', label: 'Cycling', icon: 'cycling' },
  { value: 'swimming', label: 'Swimming', icon: 'swimming' },
  { value: 'general', label: 'General', icon: 'strength' },
];

export const FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '2 días' },
  { value: 3, label: '3 días' },
  { value: 4, label: '4 días' },
  { value: 5, label: '5 días' },
  { value: 6, label: '6 días' },
  { value: 7, label: 'Todos los días' },
];
