// HealthKit abstraction — lazy-loads react-native-health when present,
// falls back to no-ops when the module isn't installed.
//
// This module is intentionally tolerant: dev / web / not-installed should
// all behave as "HealthKit unavailable" without throwing.
//
// To activate native:
//   1. npx expo install react-native-health
//   2. Add to app.json plugins (see docs/superpowers/specs/healthkit-integration.md)
//   3. npx expo prebuild --clean && npx expo run:ios

import { DISCIPLINE_TO_HK, type HealthAvailability, type WriteWorkoutInput } from './types';

let cached: any = null;
let probed = false;

// react-native is required lazily (not a top-level import) so this module —
// and everything that imports it, like workoutStore — stays loadable in
// plain node for unit tests. RN's index.js is Flow-typed and explodes
// outside Metro.
function getPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native').Platform.OS as string;
  } catch {
    return 'unknown';
  }
}

/** Lazy require so a missing module doesn't throw at import time. */
function getNative(): any {
  if (probed) return cached;
  probed = true;
  if (getPlatformOS() !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-health');
    cached = mod?.default ?? mod;
  } catch {
    cached = null;
  }
  return cached;
}

/** True if native bindings are present AND we're on iOS. */
export function isHealthKitAvailable(): boolean {
  return getNative() != null;
}

const PERMISSIONS = {
  permissions: {
    read: ['Weight', 'Height', 'DateOfBirth'],
    write: ['Workout', 'ActiveEnergyBurned'],
  },
};

/**
 * Request HealthKit permissions. Returns availability snapshot.
 * Safe to call multiple times — native module deduplicates.
 */
export async function requestHealthKitPermissions(): Promise<HealthAvailability> {
  const native = getNative();
  if (!native) {
    return { moduleAvailable: false, workoutsAuthorized: false, error: null };
  }
  return new Promise<HealthAvailability>((resolve) => {
    try {
      native.initHealthKit(PERMISSIONS, (err: string | null) => {
        if (err) {
          resolve({ moduleAvailable: true, workoutsAuthorized: false, error: err });
        } else {
          resolve({ moduleAvailable: true, workoutsAuthorized: true, error: null });
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      resolve({ moduleAvailable: true, workoutsAuthorized: false, error: msg });
    }
  });
}

/**
 * Write a workout to HealthKit. No-op when unavailable. Never throws.
 * Returns the workout UUID on success, null otherwise.
 */
export async function writeWorkout(input: WriteWorkoutInput): Promise<string | null> {
  const native = getNative();
  if (!native) return null;
  if (input.endMs <= input.startMs) return null;

  return new Promise<string | null>((resolve) => {
    try {
      const opts: Record<string, unknown> = {
        type: DISCIPLINE_TO_HK[input.discipline],
        startDate: new Date(input.startMs).toISOString(),
        endDate: new Date(input.endMs).toISOString(),
      };
      if (input.totalEnergyKcal != null && input.totalEnergyKcal > 0) {
        opts.energyBurned = input.totalEnergyKcal;
        opts.energyBurnedUnit = 'calorie';
      }
      if (input.totalDistanceM != null && input.totalDistanceM > 0) {
        opts.distance = input.totalDistanceM;
        opts.distanceUnit = 'meter';
      }
      native.saveWorkout(opts, (err: string | null, result: any) => {
        if (err) {
          if (__DEV__) console.warn('[Kairos/HealthKit] saveWorkout error:', err);
          resolve(null);
        } else {
          resolve(typeof result?.uuid === 'string' ? result.uuid : 'ok');
        }
      });
    } catch (e) {
      if (__DEV__) console.warn('[Kairos/HealthKit] saveWorkout threw:', e);
      resolve(null);
    }
  });
}

/**
 * Read latest body weight (kg). Returns null when unavailable / not authorized /
 * no data. Never throws.
 */
export async function readBodyWeight(): Promise<number | null> {
  const native = getNative();
  if (!native) return null;
  return new Promise<number | null>((resolve) => {
    try {
      native.getLatestWeight({ unit: 'gram' }, (err: string | null, result: any) => {
        if (err) {
          resolve(null);
          return;
        }
        // gram → kg
        const value = typeof result?.value === 'number' ? result.value / 1000 : null;
        resolve(value);
      });
    } catch {
      resolve(null);
    }
  });
}
