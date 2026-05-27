// Adherence engine — what was PLANNED vs what was DONE across a date range.
// Source of truth for "planned": resolveRange from scheduleStore.
// Source of truth for "done":    workoutHistory entries.
// A history entry counts toward the day of its startedAt (local).

import type { ResolvedAssignment, ISODate } from '../../../../types/schedule';
import type { WorkoutHistoryEntry } from '../../../../store/workoutStore';
import {
  toISODate,
  fromISODate,
  monthGridDays,
  todayISO,
} from '../../../../features/planner/lib/dates';

export type DayAdherence =
  | 'rest' // no plan, no session
  | 'planned' // planned, day in future
  | 'planned-done' // planned and trained
  | 'planned-missed' // planned but day in past with no session
  | 'unplanned-done' // no plan but trained anyway
  | 'planned-skipped'; // explicit skip via scheduleStore

export interface DayCell {
  date: ISODate;
  status: DayAdherence;
  isToday: boolean;
  isOtherMonth: boolean;
}

export interface MonthAdherence {
  anchor: ISODate;
  cells: DayCell[];
  /** "planned-done" / ("planned-done" + "planned-missed" + "planned-skipped"). null when no plans. */
  adherencePct: number | null;
  /** Number of unplanned-done days (bonus sessions). */
  unplanned: number;
  /** Number of planned days total. */
  planned: number;
  /** Number of planned days completed. */
  done: number;
}

export function buildMonthAdherence(input: {
  anchor: ISODate;
  resolveRange: (start: ISODate, end: ISODate) => Map<ISODate, ResolvedAssignment[]>;
  history: WorkoutHistoryEntry[];
  todayIso?: ISODate;
}): MonthAdherence {
  const { anchor, resolveRange, history, todayIso = todayISO() } = input;
  const days = monthGridDays(anchor);
  const start = days[0];
  const end = days[days.length - 1];
  const resolved = resolveRange(start, end);
  const focusedMonth = fromISODate(anchor).getMonth();

  // Build a set of dates that had at least one history entry (by local date).
  const doneSet = new Set<ISODate>();
  for (const h of history) {
    doneSet.add(toISODate(new Date(h.startedAt)));
  }

  let plannedCount = 0;
  let doneCount = 0;
  let unplannedCount = 0;
  let skippedCount = 0;

  const cells: DayCell[] = days.map((d) => {
    const isToday = d === todayIso;
    const isOtherMonth = fromISODate(d).getMonth() !== focusedMonth;
    const plansForDay = resolved.get(d) ?? [];
    const wasDone = doneSet.has(d);
    const inPast = d < todayIso;

    let status: DayAdherence;

    if (plansForDay.length === 0) {
      status = wasDone ? 'unplanned-done' : 'rest';
    } else {
      // At least one plan. Look at first plan's status for the "primary" intent.
      const skippedAll = plansForDay.every((r) => r.status === 'skipped');
      const completedAny = plansForDay.some((r) => r.status === 'completed') || wasDone;

      if (completedAny) {
        status = 'planned-done';
      } else if (skippedAll) {
        status = 'planned-skipped';
      } else if (inPast) {
        status = 'planned-missed';
      } else {
        status = 'planned';
      }
    }

    if (!isOtherMonth) {
      if (status === 'planned-done') {
        plannedCount++;
        doneCount++;
      } else if (status === 'planned-missed') {
        plannedCount++;
      } else if (status === 'planned-skipped') {
        plannedCount++;
        skippedCount++;
      } else if (status === 'planned') {
        plannedCount++;
      } else if (status === 'unplanned-done') {
        unplannedCount++;
      }
    }

    return { date: d, status, isToday, isOtherMonth };
  });

  const adherenceDenominator =
    doneCount +
    skippedCount +
    cells.filter((c) => !c.isOtherMonth && c.status === 'planned-missed').length;
  const adherencePct =
    adherenceDenominator > 0 ? Math.round((doneCount / adherenceDenominator) * 100) : null;

  return {
    anchor,
    cells,
    adherencePct,
    unplanned: unplannedCount,
    planned: plannedCount,
    done: doneCount,
  };
}
