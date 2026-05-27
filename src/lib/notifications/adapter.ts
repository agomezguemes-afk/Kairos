// Notifications adapter — thin translation layer between the pure
// scheduler module and the OS notification queue.
//
// expo-notifications is NOT yet wired into native code (will be added at
// TestFlight prep time). For now, the adapter logs the diff and stores
// the last applied set in-memory so re-syncs are idempotent. When
// expo-notifications lands, swap the `scheduleOne` / `cancel` bodies for
// real calls — the interface here does not need to change.

import { buildNotifications, diffNotifications, type ScheduledNotification } from './scheduler';
import type { ResolvedAssignment } from '../../types/schedule';

let lastApplied: ScheduledNotification[] = [];

interface SyncInput {
  enabled: boolean;
  assignments: ResolvedAssignment[];
  blockNames: Map<string, string>;
  lastCompletedAt: number | null;
}

/**
 * Recompute the desired notification set and apply diffs against the
 * previously applied set. Idempotent — calling repeatedly with the same
 * inputs produces zero side effects on the second call.
 */
export async function syncNotifications(input: SyncInput): Promise<void> {
  // When disabled, the desired set is empty → effectively cancels all.
  const next = input.enabled
    ? buildNotifications({
        assignments: input.assignments,
        blockNames: input.blockNames,
        lastCompletedAt: input.lastCompletedAt,
        nowMs: Date.now(),
      })
    : [];

  const { toCancel, toSchedule } = diffNotifications(lastApplied, next);

  for (const id of toCancel) {
    await cancel(id);
  }
  for (const n of toSchedule) {
    await scheduleOne(n);
  }

  lastApplied = next;
}

/** Test-only: reset the in-memory state so unit tests run hermetically. */
export function __resetForTests() {
  lastApplied = [];
}

// ── Platform stubs (replace when expo-notifications is wired) ───────────

async function scheduleOne(n: ScheduledNotification): Promise<void> {
  // TODO: replace with Notifications.scheduleNotificationAsync({...})
  // For now we log so the developer sees the queue during dev builds.
  if (__DEV__) {
    console.log(
      `[notifications] schedule ${n.id} @ ${new Date(n.triggerAt).toISOString()} — ${n.title}`,
    );
  }
}

async function cancel(id: string): Promise<void> {
  // TODO: replace with Notifications.cancelScheduledNotificationAsync(id)
  if (__DEV__) {
    console.log(`[notifications] cancel ${id}`);
  }
}
