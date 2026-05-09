// src/features/planner/hooks/useScheduleForDate.ts

import { useMemo } from 'react';
import { useScheduleStore } from '../../../store/scheduleStore';
import type { ResolvedAssignment, ISODate } from '../../../types/schedule';

export function useScheduleForDate(date: ISODate): ResolvedAssignment[] {
  // We subscribe to assignments so the memo invalidates when the store changes.
  const assignments = useScheduleStore((s) => s.assignments);
  return useMemo(() => useScheduleStore.getState().resolveDate(date), [assignments, date]);
}
