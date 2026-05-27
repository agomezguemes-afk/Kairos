// Pure notification scheduler. No platform side effects in this module —
// it takes a snapshot of the user's planned assignments + workout history
// and returns the list of notifications that should be in the system
// queue. A separate adapter layer translates these into expo-notifications
// schedule/cancel calls.
//
// Two notification kinds:
//   • reminder   — "Tienes <block> hoy a las <time>" for upcoming planned
//                   assignments in the next N days.
//   • gap-nudge  — "Han pasado 36h sin entrenar" when no planned activity
//                   today AND last workout > 36h ago. Throttled to once
//                   per gap window so the user isn't spammed.

import type { ResolvedAssignment, ISODate } from '../../types/schedule';

export type NotificationKind = 'reminder' | 'gap-nudge';

export interface ScheduledNotification {
  /** Stable id derived from kind + date + assignment so re-builds idempotently
   *  cancel/replace the same system notification. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Epoch ms at which the OS should fire the notification. */
  triggerAt: number;
  payload?: {
    blockId?: string;
    assignmentId?: string;
    scheduledDate?: ISODate;
  };
}

export interface BuildInput {
  /** Resolved assignments for the upcoming window (default: next 14 days). */
  assignments: ResolvedAssignment[];
  /** Map of blockId → readable name for title interpolation. */
  blockNames: Map<string, string>;
  /** Last completed workout end timestamp (ms). null when there's no history. */
  lastCompletedAt: number | null;
  /** Current wall-clock time in ms. */
  nowMs: number;
  /** Hour-of-day to fire reminders at (0–23). Default 8. */
  reminderHour?: number;
  /** Maximum days into the future to schedule (default 7). */
  horizonDays?: number;
  /** Minimum hours since last workout before a gap nudge fires (default 36). */
  gapHours?: number;
}

const ONE_DAY_MS  = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Convert an ISODate (YYYY-MM-DD) + hour to epoch ms in local time. */
export function isoDateAtHour(date: ISODate, hour: number): number {
  const [y, m, d] = date.split('-').map(n => parseInt(n, 10));
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
}

/** Stable id so rebuilds replace the same OS notification. */
function reminderId(assignmentId: string, date: ISODate): string {
  return `reminder:${assignmentId}:${date}`;
}

function gapId(dayBucket: string): string {
  return `gap:${dayBucket}`;
}

/** Day bucket key for the gap-nudge id — derived from the calendar day of nowMs. */
function dayBucket(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildNotifications(input: BuildInput): ScheduledNotification[] {
  const {
    assignments,
    blockNames,
    lastCompletedAt,
    nowMs,
    reminderHour = 8,
    horizonDays  = 7,
    gapHours     = 36,
  } = input;

  const out: ScheduledNotification[] = [];
  const horizon = nowMs + horizonDays * ONE_DAY_MS;

  // ── Reminders ───────────────────────────────────────────────────────────
  for (const a of assignments) {
    if (a.status !== 'planned') continue;
    const triggerAt = isoDateAtHour(a.date, reminderHour);
    if (triggerAt < nowMs) continue;           // skip past hours of today
    if (triggerAt > horizon) continue;          // beyond planning horizon

    const blockName = blockNames.get(a.blockId) ?? 'Tu bloque';
    out.push({
      id: reminderId(a.assignmentId, a.date),
      kind: 'reminder',
      title: blockName,
      body: 'Tienes esta sesión programada hoy.',
      triggerAt,
      payload: {
        blockId: a.blockId,
        assignmentId: a.assignmentId,
        scheduledDate: a.date,
      },
    });
  }

  // ── Gap nudge ──────────────────────────────────────────────────────────
  // Fire once per calendar day when:
  //   1. user has at least one completed workout (so we have a baseline)
  //   2. nothing planned for today
  //   3. last completed > gapHours ago
  // The nudge is scheduled for "later today" so we don't fire instantly —
  // we wait until ~19:00 local for a gentle evening prompt.
  if (lastCompletedAt != null) {
    const today = dayBucket(nowMs);
    const todayPlanned = assignments.some(
      a => a.status === 'planned' && a.date === today,
    );
    const sinceLast = nowMs - lastCompletedAt;
    if (!todayPlanned && sinceLast >= gapHours * ONE_HOUR_MS) {
      // Schedule for 19:00 today if still in the future; otherwise tomorrow 8:00.
      const eveningTrigger = isoDateAtHour(today, 19);
      const triggerAt =
        eveningTrigger > nowMs + ONE_HOUR_MS
          ? eveningTrigger
          : isoDateAtHour(today, 0) + ONE_DAY_MS + 8 * ONE_HOUR_MS;
      const hoursAgo = Math.floor(sinceLast / ONE_HOUR_MS);
      out.push({
        id: gapId(today),
        kind: 'gap-nudge',
        title: 'Echo de menos verte',
        body: `Han pasado ${hoursAgo}h desde tu última sesión. ¿Algo ligero hoy?`,
        triggerAt,
      });
    }
  }

  return out;
}

/**
 * Diff helper: given the previously-scheduled and the newly-computed lists,
 * return the ids to cancel and the items to (re-)schedule. The adapter
 * layer calls the appropriate expo-notifications APIs for each.
 *
 * Re-scheduling is identity-based on the stable id field. If an item with
 * the same id appears in `next`, we re-schedule it (the trigger or text
 * may have changed); items missing from `next` are cancelled.
 */
export function diffNotifications(
  prev: ScheduledNotification[],
  next: ScheduledNotification[],
): { toCancel: string[]; toSchedule: ScheduledNotification[] } {
  const prevIds = new Set(prev.map(n => n.id));
  const nextIds = new Set(next.map(n => n.id));
  const toCancel = [...prevIds].filter(id => !nextIds.has(id));
  return { toCancel, toSchedule: next };
}
