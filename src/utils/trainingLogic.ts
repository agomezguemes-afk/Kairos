import { MuscleGroup, TrainingType } from '../types/training';

export function determineTrainingType(muscleGroups: MuscleGroup[]): TrainingType {
  if (muscleGroups.length === 0) {
    throw new Error('No muscle groups selected');
  }

  const upperBodyGroups: MuscleGroup[] = ['biceps', 'triceps', 'pecho', 'espalda', 'hombro'];
  const lowerBodyGroups: MuscleGroup[] = ['pierna'];

  const hasUpper = muscleGroups.some(group => upperBodyGroups.includes(group));
  const hasLower = muscleGroups.some(group => lowerBodyGroups.includes(group));

  if (hasUpper && hasLower) {
    return 'full_body';
  } else if (hasLower) {
    return 'tren_inferior';
  } else {
    return 'tren_superior';
  }
}

export function getTrainingName(type: TrainingType, muscleGroups: MuscleGroup[]): string {
  const typeNames = {
    tren_superior: 'Tren Superior',
    tren_inferior: 'Tren Inferior',
    full_body: 'Full Body',
  };

  const groupNames: Record<MuscleGroup, string> = {
    pierna: 'Pierna',
    biceps: 'Bíceps',
    triceps: 'Tríceps',
    pecho: 'Pecho',
    espalda: 'Espalda',
    hombro: 'Hombro',
  };

  if (muscleGroups.length <= 2) {
    return muscleGroups.map(g => groupNames[g]).join(' + ');
  }

  return typeNames[type];
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
