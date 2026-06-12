// src/features/planner/hooks/useScheduleForRange.ts

import { useMemo } from 'react';
import { useScheduleStore } from '../../../store/scheduleStore';
import type { ResolvedAssignment, ISODate } from '../../../types/schedule';

export function useScheduleForRange(
  start: ISODate,
  end: ISODate,
): Map<ISODate, ResolvedAssignment[]> {
  const assignments = useScheduleStore((s) => s.assignments);
  return useMemo(
    () => useScheduleStore.getState().resolveRange(start, end),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assignments is the deliberate invalidation key (resolveRange reads the store imperatively)
    [assignments, start, end],
  );
}
