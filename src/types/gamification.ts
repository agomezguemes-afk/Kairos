// KAIROS — Gamification Types

export type ISOTimestamp = string;

// ======================== STREAK ========================

export interface Streak {
  current: number;
  longest: number;
  lastActivityDate: string | null; // YYYY-MM-DD
}

export function createEmptyStreak(): Streak {
  return { current: 0, longest: 0, lastActivityDate: null };
}

// ======================== BADGES ========================

export type BadgeId =
  | 'first_step'
  | 'streak_7'
  | 'streak_30'
  | 'volume_100'
  | 'explorer_5'
  | 'block_creator'
  | 'mission_complete';

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  icon: string;
  description: string;
}

export interface Badge {
  id: BadgeId;
  unlockedAt: ISOTimestamp;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_step',
    name: 'Primer paso',
    icon: 'first_step',
    description: 'Completa tu primera serie',
  },
  {
    id: 'streak_7',
    name: 'Iniciado',
    icon: 'streak',
    description: '7 días de racha consecutiva',
  },
  {
    id: 'streak_30',
    name: 'Constante',
    icon: 'streak_double',
    description: '30 días de racha consecutiva',
  },
  {
    id: 'volume_100',
    name: 'Volumen 1',
    icon: 'strength',
    description: '100 series completadas en total',
  },
  {
    id: 'explorer_5',
    name: 'Explorador',
    icon: 'target',
    description: 'Usa 5 ejercicios diferentes',
  },
  {
    id: 'block_creator',
    name: 'Bloqueador',
    icon: 'star',
    description: 'Crea tu primer bloque personalizado',
  },
  {
    id: 'mission_complete',
    name: 'Misionero',
    icon: 'target',
    description: 'Completa tu primera misión semanal',
  },
];

// ======================== PR CARDS ========================

export interface PRCard {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseIcon: string;
  fieldId: string;
  fieldName: string;
  value: number;
  unit: string | null;
  /** Secondary display (e.g. "x 8 reps") */
  secondaryText: string | null;
  date: ISOTimestamp;
  message: string;
}

/** Map of exerciseId → fieldId → best numeric value */
export type ExerciseBestMap = Record<string, Record<string, number>>;

// ======================== STATS for badge checks ========================

export interface GamificationStats {
  totalCompletedSets: number;
  uniqueExerciseIds: string[];
  userCreatedBlocks: number;
  streak: Streak;
  completedMissions: number;
}
