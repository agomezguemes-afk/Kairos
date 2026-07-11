// src/lib/routines/seedHybridPreset.ts
//
// Side-effectful companion to hybridPreset.ts. Persists the hybrid-race block
// into the workout store and seeds the declared week as a single recurring
// schedule assignment (BYDAY covering the N training days). Kept separate so
// `hybridPreset.ts` stays pure/store-free and unit-testable.

import { useWorkoutStore } from '../../store/workoutStore';
import { useScheduleStore } from '../../store/scheduleStore';
import {
  generateHybridPreset,
  type OnboardingSpaceResult,
  type StarterAnswers,
} from './hybridPreset';

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Persist the hybrid preset. Adds the block to the workout store and creates
 * one recurring assignment for the declared training days. Returns the same
 * shape DEV-U's reveal renders.
 */
export function seedHybridPreset(answers: StarterAnswers): OnboardingSpaceResult {
  const result = generateHybridPreset(answers);
  const block = result.blocks[0];

  // addPreparedBlocks preserves block.id, so the schedule + reveal stay in sync.
  useWorkoutStore.getState().addPreparedBlocks([block]);

  const weekdays = result.weekAssignments.map((w) => w.weekday);
  if (weekdays.length > 0) {
    const rrule = `FREQ=WEEKLY;BYDAY=${weekdays.map((w) => BYDAY[w]).join(',')}`;
    useScheduleStore
      .getState()
      .assignRecurring({ blockId: block.id, rrule, startDate: todayISO() });
  }

  return result;
}
