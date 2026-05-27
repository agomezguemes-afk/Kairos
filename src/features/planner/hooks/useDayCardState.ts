// src/features/planner/hooks/useDayCardState.ts
// Computes the DayCard variant for a given date. The single source of truth
// for what the day card should show.

import { useMemo } from 'react';
import { useWorkoutStore } from '../../../store/workoutStore';
import type { WorkoutBlock } from '../../../types/core';
import type { ResolvedAssignment, ISODate } from '../../../types/schedule';
import { todayISO, isPast, isFuture } from '../lib/dates';
import { useScheduleForDate } from './useScheduleForDate';

export type DayCardVariant =
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'empty'
  | 'future-assigned'
  | 'future-empty'
  | 'past-skipped'
  | 'past-empty'
  | 'no-blocks';

export interface DayCardState {
  variant: DayCardVariant;
  date: ISODate;
  resolved: ResolvedAssignment | null;
  block: WorkoutBlock | null;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export function useDayCardState(date: ISODate): DayCardState {
  const blocks = useWorkoutStore((s) => s.blocks);
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const resolvedAll = useScheduleForDate(date);

  return useMemo(() => {
    const today = todayISO();
    const _isPast = isPast(date);
    const _isFuture = isFuture(date);
    const _isToday = date === today;

    const r = resolvedAll[0] ?? null;
    const block = r ? (blocks.find((b) => b.id === r.blockId) ?? null) : null;

    const baseInfo = {
      date,
      resolved: r,
      block,
      isToday: _isToday,
      isPast: _isPast,
      isFuture: _isFuture,
    };

    if (blocks.length === 0) return { ...baseInfo, variant: 'no-blocks' };

    if (_isPast) {
      if (!r) return { ...baseInfo, variant: 'past-empty' };
      if (r.status === 'completed') return { ...baseInfo, variant: 'completed' };
      return { ...baseInfo, variant: 'past-skipped' };
    }

    if (_isFuture) {
      if (!r) return { ...baseInfo, variant: 'future-empty' };
      return { ...baseInfo, variant: 'future-assigned' };
    }

    // today
    if (!r) return { ...baseInfo, variant: 'empty' };
    if (r.status === 'completed') return { ...baseInfo, variant: 'completed' };
    if (activeWorkout && activeWorkout.blockId === r.blockId) {
      return { ...baseInfo, variant: 'in-progress' };
    }
    return { ...baseInfo, variant: 'assigned' };
  }, [date, blocks, activeWorkout, resolvedAll]);
}
