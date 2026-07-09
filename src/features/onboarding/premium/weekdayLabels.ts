// KAIROS — Weekday labels for the seeded-week reveal (pure, node-testable).
//
// Kept RN-free (no tokens, no store) so the label logic is unit-tested under
// vitest's node env. The reveal view-model re-exports this.

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** 0=domingo … 6=sábado (weekAssignments convention) → short Spanish label. */
export function weekdayLabelES(weekday: number): string {
  const i = ((Math.round(weekday) % 7) + 7) % 7;
  return WEEKDAY_LABELS[i];
}
