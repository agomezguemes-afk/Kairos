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
  icon: string;
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
  { id: 'pecho', name: 'Pecho', icon: 'chest', category: 'upper' },
  { id: 'espalda', name: 'Espalda', icon: 'back', category: 'upper' },
  { id: 'hombro', name: 'Hombro', icon: 'shoulder', category: 'upper' },
  { id: 'biceps', name: 'Bíceps', icon: 'biceps', category: 'upper' },
  { id: 'triceps', name: 'Tríceps', icon: 'triceps', category: 'upper' },
  { id: 'pierna', name: 'Pierna', icon: 'leg', category: 'lower' },
];

export const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120];
