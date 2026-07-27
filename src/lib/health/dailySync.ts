// KAIROS — Daily biometric sample sync.
//
// Called once per app launch (App.tsx). No AppState foreground-listener
// infra exists in this codebase yet, and adding one is out of scope for
// Phase 1 (YAGNI) — once-per-launch is good enough to keep the rolling
// baseline current for a daily-use fitness app.

import { readHRV, readSleepHours, isHealthKitAvailable } from './healthkit';
import { useHealthStore } from '../../store/healthStore';

function todayISODate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function syncDailyBiometricSample(): Promise<void> {
  if (!isHealthKitAvailable()) return;
  const [hrvMs, sleepHours] = await Promise.all([readHRV(), readSleepHours()]);
  if (hrvMs == null && sleepHours == null) return;
  useHealthStore.getState().recordSample({ date: todayISODate(), hrvMs, sleepHours });
}
