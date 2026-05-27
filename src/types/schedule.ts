// src/types/schedule.ts
// Schedule data model — discriminated union of one-time and recurring
// assignments, plus the resolved snapshot the DayCard renders.

export type ISODate = string; // YYYY-MM-DD (no time, no tz)
export type ISOTimestamp = string; // ISO 8601 with timezone

interface AssignmentBase {
  id: string;
  blockId: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  /** Dates the user marked completed (recurring → one entry per occurrence). */
  completed: ISODate[];
}

export interface OneTimeAssignment extends AssignmentBase {
  kind: 'one-time';
  date: ISODate;
  /** True if user explicitly skipped (vs. deleted). Affects streak/insights. */
  skipped: boolean;
}

export interface RecurringAssignment extends AssignmentBase {
  kind: 'recurring';
  /** RRULE RFC 5545. Example: "FREQ=WEEKLY;BYDAY=MO,WE,FR" */
  rrule: string;
  startDate: ISODate;
  endDate: ISODate | null;
  /** Occurrences the user explicitly skipped. */
  skipped: ISODate[];
  /** Occurrences moved: { ruleProducedDate → newDate }. */
  moved: Record<ISODate, ISODate>;
}

export type ScheduleAssignment = OneTimeAssignment | RecurringAssignment;

export type AssignmentStatus = 'planned' | 'completed' | 'skipped';

/** Resolved snapshot the DayCard consumes. RRULEs already expanded. */
export interface ResolvedAssignment {
  assignmentId: string;
  blockId: string;
  date: ISODate;
  status: AssignmentStatus;
  isRecurring: boolean;
  /** Set when this occurrence was moved here from another date. */
  movedFrom?: ISODate;
}

export type RecentlyDeleted = {
  assignment: ScheduleAssignment;
  deletedAt: number;
}[];
