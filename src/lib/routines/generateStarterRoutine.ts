// Store integration for the starter-space builder. The pure template logic
// lives in starterTemplates.ts (unit-tested); this module commits the result
// to the workout store and keeps the legacy goal-based entry point alive.

import { useWorkoutStore } from '../../store/workoutStore';
import type { WorkoutBlock } from '../../types/core';
import {
  buildStarterBlocks,
  type StarterAnswers,
  type StarterDiscipline,
} from './starterTemplates';
import { computeWeekAssignments, type WeekAssignment } from './weekAssignments';

type Goal = 'strength' | 'endurance' | 'flexibility' | 'health';

// Matches MOCK_USER_ID in workoutStore — blocks created by the store use it too.
const USER_ID = 'user_001';

export interface StarterSpaceResult {
  /** The created blocks, as committed to the store. */
  blocks: WorkoutBlock[];
  /** Weekly plan proposal (0=domingo … 6=sábado). Committed by completeOnboarding. */
  weekAssignments: WeekAssignment[];
  blockIds: string[];
  /** The favorite block the "first workout" CTA should launch. */
  firstBlockId: string;
}

/**
 * Build the starter space from onboarding answers and commit it to the store.
 * Appends after any existing blocks (idempotent enough for onboarding, which
 * only runs on a fresh store).
 */
export function applyStarterSpace(answers: StarterAnswers): StarterSpaceResult | null {
  const store = useWorkoutStore.getState();
  const built = buildStarterBlocks(answers, USER_ID, store.blocks.length);
  if (built.length === 0) return null;
  store.replaceAllBlocks([...store.blocks, ...built]);
  const blockIds = built.map((b) => b.id);
  return {
    blocks: built,
    weekAssignments: computeWeekAssignments(blockIds, answers.frequency),
    blockIds,
    firstBlockId: built[0].id,
  };
}

const GOAL_TO_DISCIPLINE: Record<Goal, StarterDiscipline> = {
  strength: 'strength',
  endurance: 'running',
  flexibility: 'yoga_mobility',
  health: 'hybrid',
};

/**
 * Legacy goal-based entry point. Maps the old 4-goal vocabulary onto the new
 * template set with mid defaults (beginner, 3×/week, no equipment).
 */
export function generateStarterRoutine(goal: Goal): WorkoutBlock | null {
  const result = applyStarterSpace({
    discipline: GOAL_TO_DISCIPLINE[goal] ?? 'hybrid',
    level: 'beginner',
    frequency: 3,
    equipment: [],
  });
  if (!result) return null;
  return useWorkoutStore.getState().blocks.find((b) => b.id === result.firstBlockId) ?? null;
}
