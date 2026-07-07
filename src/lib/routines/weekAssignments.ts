// Week seeding for the onboarding space: maps "entreno N días/semana" to
// concrete weekdays and distributes the generated blocks across them.
// Pure module — the store commit happens in workoutStore.completeOnboarding.
//
// Weekday convention (integration contract): 0=domingo … 6=sábado (JS getDay).
// The planner's rrule layer uses 0=lunes … 6=domingo; convert with
// toRRuleWeekday() at the seam.

export interface WeekAssignment {
  blockId: string;
  /** 0=domingo … 6=sábado. */
  weekday: number;
}

// Canonical spread per frequency (BACKLOG L1: 3 → lu/mi/vi, etc.). Rest days
// are maximized between sessions at low frequencies.
const WEEKDAYS_BY_FREQUENCY: Record<number, number[]> = {
  1: [1], // lunes
  2: [1, 4], // lunes, jueves
  3: [1, 3, 5], // lunes, miércoles, viernes
  4: [1, 2, 4, 5], // lunes, martes, jueves, viernes
  5: [1, 2, 3, 4, 5], // lunes a viernes
  6: [1, 2, 3, 4, 5, 6], // lunes a sábado
  7: [0, 1, 2, 3, 4, 5, 6], // toda la semana
};

/** Training weekdays for a weekly frequency. Out-of-range input clamps to 1–7. */
export function weekdaysForFrequency(frequency: number): number[] {
  const clamped = Math.min(7, Math.max(1, Math.round(Number.isFinite(frequency) ? frequency : 3)));
  return [...WEEKDAYS_BY_FREQUENCY[clamped]];
}

/**
 * Distribute blocks across the training days of the week, round-robin in
 * weekday order (A/B split alternates: A, B, A, B…). One assignment per
 * training day, so the Plan shows exactly `frequency` sessions per week.
 */
export function computeWeekAssignments(blockIds: string[], frequency: number): WeekAssignment[] {
  if (blockIds.length === 0) return [];
  return weekdaysForFrequency(frequency).map((weekday, i) => ({
    blockId: blockIds[i % blockIds.length],
    weekday,
  }));
}

/** Contract weekday (0=dom … 6=sáb) → planner rrule index (0=lun … 6=dom). */
export function toRRuleWeekday(weekday: number): number {
  return (weekday + 6) % 7;
}

/** Unique weekdays per block, preserving weekday order. For rrule building. */
export function groupAssignmentsByBlock(assignments: WeekAssignment[]): Map<string, number[]> {
  const byBlock = new Map<string, number[]>();
  for (const a of assignments) {
    if (a.weekday < 0 || a.weekday > 6 || !Number.isInteger(a.weekday)) continue;
    const list = byBlock.get(a.blockId) ?? [];
    if (!list.includes(a.weekday)) list.push(a.weekday);
    byBlock.set(a.blockId, list);
  }
  return byBlock;
}
