// Glue between HealthKit and the coach store: connect once, then pull new
// watch workouts and biometrics whenever the engine is about to think
// (app opens, app leaves, overnight task). Writes finished sessions back.

import * as AppleHealth from '../../lib/health/appleHealth';
import type { SessionLog } from '../../lib/adaptive/types';
import { useCoachStore } from '../../store/coachStore';

export type SyncOutcome =
  | { status: 'synced'; added: number; enriched: number }
  | { status: 'skipped'; reason: 'not-connected' | 'unavailable' | 'locked' | 'busy' }
  | { status: 'failed'; error: string };

let inFlight: Promise<SyncOutcome> | null = null;

export function healthAvailable(): boolean {
  return AppleHealth.available();
}

/** Asks for access and does the first import (last 60 days). */
export async function connectHealth(): Promise<SyncOutcome> {
  if (!AppleHealth.available()) return { status: 'skipped', reason: 'unavailable' };
  try {
    await AppleHealth.connect();
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    useCoachStore.getState().setHealthError(error);
    return { status: 'failed', error };
  }
  useCoachStore.getState().setHealthConnected(true);
  return syncHealth();
}

export function disconnectHealth(): void {
  // iOS keeps the permission; the person revokes it in Salud. Kairos just stops reading.
  useCoachStore.getState().setHealthConnected(false);
}

/** Safe to call often: concurrent calls share one pull. */
export function syncHealth(now: Date = new Date()): Promise<SyncOutcome> {
  if (inFlight) return inFlight;
  inFlight = run(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(now: Date): Promise<SyncOutcome> {
  const store = useCoachStore.getState();
  if (!store.health.connected) return { status: 'skipped', reason: 'not-connected' };
  if (!AppleHealth.available()) return { status: 'skipped', reason: 'unavailable' };
  if (!(await AppleHealth.readable())) return { status: 'skipped', reason: 'locked' };
  try {
    const pull = await AppleHealth.pull(store.health.anchor, now);
    const r = useCoachStore.getState().ingestHealth(pull, now);
    return { status: 'synced', ...r };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('[health] sync failed', e);
    useCoachStore.getState().setHealthError(error);
    return { status: 'failed', error };
  }
}

/** Fire-and-forget write of a finished Kairos session to Health. */
export function exportSession(log: SessionLog): void {
  if (!useCoachStore.getState().health.connected || !AppleHealth.available()) return;
  AppleHealth.saveSession(log).catch((e) => console.warn('[health] saving workout failed', e));
}
