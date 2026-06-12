// src/features/planner/hooks/useMomentumPhrase.ts

import { useMemo } from 'react';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useGamification } from '../../../context/GamificationContext';
import { getMomentumPhrase } from '../lib/momentum';

export function useMomentumPhrase(): string {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const blocks = useWorkoutStore((s) => s.blocks);
  const { streak } = useGamification();
  return useMemo(
    () => getMomentumPhrase({ history, streak: streak.current, blocksCount: blocks.length }),
    [history, streak, blocks.length],
  );
}
