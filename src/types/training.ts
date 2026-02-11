// ========== TIPOS DE ENTRENAMIENTO ==========

export type MuscleGroup = 
  | 'pierna'
  | 'biceps'
  | 'triceps'
  | 'pecho'
  | 'espalda'
  | 'hombro';

export type TrainingType = 
  | 'tren_superior'
  | 'tren_inferior'
  | 'full_body';

export interface MuscleGroupOption {
  id: MuscleGroup;
  name: string;
  emoji: string;
  category: 'upper' | 'lower';
}

export interface TrainingSession {
  id: string;
  date: Date;
  muscleGroups: MuscleGroup[];
  trainingType: TrainingType;
  duration: number; // minutos
  timestamp: number;
}

export interface TrainingStats {
  totalSessions: number;
  currentStreak: number;
  totalMinutes: number;
  lastSession?: TrainingSession;
}

// Constantes
export const MUSCLE_GROUPS: MuscleGroupOption[] = [
  { id: 'pecho', name: 'Pecho', emoji: '💪', category: 'upper' },
  { id: 'espalda', name: 'Espalda', emoji: '🦾', category: 'upper' },
  { id: 'hombro', name: 'Hombro', emoji: '🏋️', category: 'upper' },
  { id: 'biceps', name: 'Bíceps', emoji: '💪', category: 'upper' },
  { id: 'triceps', name: 'Tríceps', emoji: '🔥', category: 'upper' },
  { id: 'pierna', name: 'Pierna', emoji: '🦵', category: 'lower' },
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120];
