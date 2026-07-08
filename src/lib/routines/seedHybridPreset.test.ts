import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkoutBlock } from '../../types/core';
import { seedHybridPreset } from './seedHybridPreset';

// Mock the stores so the real modules (which transitively import react-native /
// AsyncStorage) never load under the node test env. We only assert wiring here;
// the pure generation is covered by hybridPreset.test.ts.
type AssignInput = { blockId: string; rrule: string; startDate: string };

const { addPreparedBlocks, assignRecurring } = vi.hoisted(() => ({
  addPreparedBlocks: vi.fn<(blocks: WorkoutBlock[]) => string[]>(() => []),
  assignRecurring: vi.fn<(input: AssignInput) => string>(() => 'assignment_1'),
}));

vi.mock('../../store/workoutStore', () => ({
  useWorkoutStore: { getState: () => ({ addPreparedBlocks }) },
}));
vi.mock('../../store/scheduleStore', () => ({
  useScheduleStore: { getState: () => ({ assignRecurring }) },
}));

describe('seedHybridPreset', () => {
  beforeEach(() => {
    addPreparedBlocks.mockClear();
    assignRecurring.mockClear();
  });

  it('persists the block and seeds a recurring assignment for the declared days', () => {
    const result = seedHybridPreset({ disciplines: ['strength', 'running'], weeklyFrequency: 3 });

    expect(addPreparedBlocks).toHaveBeenCalledTimes(1);
    const seeded = addPreparedBlocks.mock.calls[0][0];
    expect(seeded).toHaveLength(1);
    expect(seeded[0].id).toBe(result.blocks[0].id);

    expect(assignRecurring).toHaveBeenCalledTimes(1);
    const arg = assignRecurring.mock.calls[0][0];
    expect(arg.blockId).toBe(result.blocks[0].id);
    // 3 sessions → Mon/Wed/Fri.
    expect(arg.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('maps each weekday index to the correct RRULE BYDAY token', () => {
    seedHybridPreset({ disciplines: ['strength', 'cycling'], weeklyFrequency: 5 });
    const arg = assignRecurring.mock.calls[0][0];
    // distributeAcrossWeek(5) → [0,1,2,4,5] → Mon,Tue,Wed,Fri,Sat
    expect(arg.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,FR,SA');
  });
});
