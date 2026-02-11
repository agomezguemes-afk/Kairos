// ========== TIPOS DE PROGRESO TEMPORAL ==========

export type DayEntryType = 'training' | 'rest' | 'empty';

export interface DayEntry {
  date: Date;
  type: DayEntryType;
  trainingData?: {
    muscleGroups: import('./training').MuscleGroup[];
    trainingType: import('./training').TrainingType;
    duration: number;
  };
  timestamp: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
}

export interface WeeklyLog {
  weekNumber: number;
  startDate: Date;
  days: DayEntry[];
  totalTrainings: number;
  totalMinutes: number;
}

// Helper para formateo de fechas (sin horas)
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

// Helper para comparar fechas
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
  * Helper para obtener día de la semana (0=Lun, 6=Dom)
  * Devuelve el índice del día de la semana con lunes como 0 y domingo como 6. 
  * Sirve para trabajar con fechas usando una convención basada en semanas laborables.
  * date: Fecha a partir de la cual se obtiene el día de la semana.
  * Returns:
  * Un número entre 0 y 6 que representa el día de la semana, donde 0 es lunes y 6 es domingo. 
  * */
export function getDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Convertir Dom=0 a Dom=6
}
