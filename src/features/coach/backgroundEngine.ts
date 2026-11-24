// The engine's night shift. iOS (BGTaskScheduler) and Android (WorkManager)
// wake the app on their own schedule, typically overnight while charging,
// and run this task headless: load the coach state, consolidate, persist,
// and go back to sleep. The next morning's session is already planned.
//
// The task must be defined at module scope, before the app renders, so
// this file is imported from App.tsx for its side effect.

import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { flushCoachStorage, useCoachStore } from '../../store/coachStore';
import { syncHealth } from './healthSync';
import { ingestWatchSessions, pushPlanToWatch } from './watchSync';

export const ENGINE_TASK = 'kairos-engine-consolidate';
/** A minimum, not a schedule: the OS picks the window (minutes). */
const MIN_INTERVAL_MIN = 6 * 60;
/** Upper bound on catch-up passes in one background run. */
const MAX_NIGHT_PASSES = 20;

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Load persisted state if this is a cold, headless launch; then think and save. */
export async function runConsolidation(now: Date = new Date()): Promise<void> {
  if (!useCoachStore.persist.hasHydrated()) await useCoachStore.persist.rehydrate();
  // Health data is unreadable while the phone is locked; then the pass
  // runs on what is already stored and the morning open catches up.
  // Sessions logged on the wrist with the app closed go in first: recordSession
  // only schedules a deferred pass, which never runs in a headless task, so
  // ingesting after the passes would push yesterday's session as today's plan.
  ingestWatchSessions();
  const synced = await syncHealth(now);
  if (synced.status !== 'synced') useCoachStore.getState().consolidate(now, { background: true });
  // At night there is time: finish distilling the past (no time budget).
  for (let i = 0; i < MAX_NIGHT_PASSES && useCoachStore.getState().enginePending; i++)
    useCoachStore.getState().consolidate(now, { background: true });
  pushPlanToWatch();
  await flushCoachStorage();
}

if (supported) {
  TaskManager.defineTask(ENGINE_TASK, async () => {
    try {
      await runConsolidation();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      console.warn('[engine] background consolidation failed', e);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Ask the OS to run the task periodically. Safe to call on every launch. */
export async function registerBackgroundEngine(): Promise<'registered' | 'unavailable'> {
  if (!supported) return 'unavailable';
  const status = await BackgroundTask.getStatusAsync();
  // Restricted: Low Power Mode or the user disabled Background App Refresh.
  // The foreground passes still run, so the engine degrades, it doesn't stop.
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return 'unavailable';
  if (!(await TaskManager.isTaskRegisteredAsync(ENGINE_TASK)))
    await BackgroundTask.registerTaskAsync(ENGINE_TASK, { minimumInterval: MIN_INTERVAL_MIN });
  return 'registered';
}
