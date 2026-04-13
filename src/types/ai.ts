// KAIROS — AI Types
// Typed actions the AI assistant can propose and the app can execute.
// All payloads reference existing types from core.ts — no redefinitions.

import type {
  WorkoutBlock,
  ExerciseCard,
  Discipline,
  BlockCover,
} from './core';

// ======================== ACTION TYPES ========================

export type AIActionType =
  | 'create_block'
  | 'update_exercise'
  | 'add_exercise'
  | 'delete_exercise'
  | 'update_block_meta'
  | 'delete_block';

// ======================== ACTION INTERFACES ========================

export interface AIExerciseTemplate {
  name: string;
  icon?: string;
  color?: string;
  discipline?: Discipline;
  /** Number of sets the AI wants pre-built on the exercise. */
  sets_count?: number;
  /** Reps value per set. Number for counted reps, string like "40s" for timed. */
  reps?: number | string;
  /** Rest between sets in seconds. */
  rest_seconds?: number;
}

export interface CreateBlockAction {
  type: 'create_block';
  payload: {
    name: string;
    discipline: Discipline;
    icon?: string;
    color?: string;
    cover?: BlockCover;
    exercises?: AIExerciseTemplate[];
  };
}

export interface UpdateExerciseAction {
  type: 'update_exercise';
  payload: {
    exerciseId: string;
    updates: Partial<Pick<ExerciseCard, 'name' | 'icon' | 'color' | 'notes' | 'rest_seconds' | 'default_sets_count'>>;
  };
}

export interface AddExerciseAction {
  type: 'add_exercise';
  payload: {
    blockId: string;
    name: string;
    icon?: string;
    color?: string;
    discipline?: Discipline;
    sets_count?: number;
    reps?: number | string;
    rest_seconds?: number;
  };
}

export interface DeleteExerciseAction {
  type: 'delete_exercise';
  payload: {
    blockId: string;
    exerciseId: string;
  };
}

export interface UpdateBlockMetaAction {
  type: 'update_block_meta';
  payload: {
    blockId: string;
    updates: Partial<Pick<WorkoutBlock, 'name' | 'icon' | 'color' | 'description' | 'cover'>>;
  };
}

export interface DeleteBlockAction {
  type: 'delete_block';
  payload: {
    blockId: string;
  };
}

// ======================== DISCRIMINATED UNION ========================

export type AIAction =
  | CreateBlockAction
  | UpdateExerciseAction
  | AddExerciseAction
  | DeleteExerciseAction
  | UpdateBlockMetaAction
  | DeleteBlockAction;

// ======================== AI MESSAGE ========================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions: AIAction[];
  timestamp: number;
  affectedBlockId?: string;
}

// ======================== SESSION CONTEXT ========================

export interface SessionContext {
  lastBlockId: string | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}
