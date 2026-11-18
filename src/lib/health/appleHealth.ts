// Native bridge to HealthKit (@kingstinct/react-native-healthkit). Reads what
// the Apple Watch records — workouts with heart rate, sleep, HRV, resting
// HR — and writes Kairos sessions back so they count in Fitness.
//
// The module is required lazily: web, tests and builds without the native
// module see `available() === false` instead of a crash at import time.
// Everything here only normalises; the thinking lives in src/lib/engine.

import { Platform } from 'react-native';
import type * as HK from '@kingstinct/react-native-healthkit';

import type { SleepSample, ValueSample } from '../engine/biometrics';
import type { SessionLog } from '../adaptive/types';
import type { WatchWorkout } from './workoutImport';

type HealthKit = typeof HK;

let native: HealthKit | null | undefined;

function hk(): HealthKit | null {
  if (native !== undefined) return native;
  native = null;
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch (e) {
    console.warn('[health] HealthKit module not in this build', e);
  }
  return native;
}

const READ = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;
const SHARE = ['HKWorkoutTypeIdentifier'] as const;

const DAY_MS = 86_400_000;
/** First sync looks this far back; later syncs continue from the anchor. */
export const HISTORY_DAYS = 60;

export function available(): boolean {
  const m = hk();
  if (!m) return false;
  try {
    return m.isHealthDataAvailable();
  } catch (e) {
    console.warn('[health] isHealthDataAvailable failed', e);
    return false;
  }
}

/**
 * Shows the system sheet the first time; later calls return at once. iOS
 * never says whether *read* access was granted, so `true` means "asked",
 * and an empty sync is the only sign the person said no.
 */
export async function connect(): Promise<boolean> {
  const m = hk();
  if (!m) return false;
  return m.requestAuthorization({ toRead: READ, toShare: SHARE });
}

/** HealthKit is encrypted while the phone is locked: overnight reads fail. */
export async function readable(): Promise<boolean> {
  const m = hk();
  if (!m) return false;
  try {
    return await m.isProtectedDataAvailableAsync();
  } catch (e) {
    console.warn('[health] protected data check failed', e);
    return false;
  }
}

export interface HealthPull {
  workouts: WatchWorkout[];
  deletedUuids: string[];
  anchor: string;
  sleep: SleepSample[];
  hrv: ValueSample[];
  rhr: ValueSample[];
  ownBundle?: string;
}

function since(days: number, now: Date): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function quantityIn(q: { unit: string; quantity: number } | undefined, unit: 'km' | 'kcal') {
  if (!q || !Number.isFinite(q.quantity)) return undefined;
  const u = q.unit.toLowerCase();
  if (unit === 'km') {
    if (u === 'km') return q.quantity;
    if (u === 'm') return q.quantity / 1000;
    if (u === 'mi') return q.quantity * 1.609344;
    return undefined;
  }
  if (u === 'kcal' || u === 'cal') return q.quantity;
  if (u === 'kj') return q.quantity / 4.184;
  return undefined;
}

type Workout = Awaited<ReturnType<HealthKit['queryWorkoutSamplesWithAnchor']>>['workouts'][number];

async function workoutHeartRate(w: Workout) {
  try {
    const s = await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
    return { avg: s?.averageQuantity?.quantity, max: s?.maximumQuantity?.quantity };
  } catch (e) {
    // A workout without HR (phone-only, or HR access denied) is still a session.
    console.warn('[health] workout HR unavailable', e);
    return { avg: undefined, max: undefined };
  }
}

/** Everything new since the last anchor, plus the recent biometric window. */
export async function pull(
  anchor: string | undefined,
  now: Date = new Date(),
): Promise<HealthPull> {
  const m = hk();
  if (!m) throw new Error('HealthKit is not available in this build');

  const res = await m.queryWorkoutSamplesWithAnchor({
    limit: 0,
    anchor,
    filter: anchor ? undefined : { date: { startDate: since(HISTORY_DAYS, now) } },
  });
  const workouts: WatchWorkout[] = [];
  for (const w of res.workouts) {
    const hr = await workoutHeartRate(w);
    workouts.push({
      uuid: w.uuid,
      activityType: w.workoutActivityType,
      start: new Date(w.startDate).toISOString(),
      end: new Date(w.endDate).toISOString(),
      energyKcal: quantityIn(w.totalEnergyBurned, 'kcal'),
      distanceKm: quantityIn(w.totalDistance, 'km'),
      hrAvg: hr.avg,
      hrMax: hr.max,
      sourceName: w.sourceRevision?.source?.name ?? 'Apple Watch',
      sourceBundle: w.sourceRevision?.source?.bundleIdentifier ?? '',
    });
  }

  // Biometrics are re-read over a fixed window: cheap, and late-arriving
  // watch samples (synced after the phone was locked) are picked up.
  const window = { date: { startDate: since(35, now) } };
  const [sleep, hrv, rhr] = await Promise.all([
    m.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0,
      filter: { date: { startDate: since(21, now) } },
    }),
    m.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
      limit: 0,
      unit: 'ms',
      filter: window,
    }),
    m.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
      limit: 0,
      unit: 'count/min',
      filter: window,
    }),
  ]);

  let ownBundle: string | undefined;
  try {
    ownBundle = (await m.currentAppSource())?.bundleIdentifier;
  } catch (e) {
    console.warn('[health] current app source unavailable', e);
  }

  return {
    workouts,
    deletedUuids: res.deletedSamples.map((d) => d.uuid),
    anchor: res.newAnchor,
    sleep: sleep.map((s) => ({
      start: new Date(s.startDate).toISOString(),
      end: new Date(s.endDate).toISOString(),
      value: Number(s.value),
    })),
    hrv: hrv.map((s) => ({ at: new Date(s.startDate).toISOString(), value: s.quantity })),
    rhr: rhr.map((s) => ({ at: new Date(s.startDate).toISOString(), value: s.quantity })),
    ownBundle,
  };
}

/** HKWorkoutActivityType for a Kairos session written back to Health. */
const ACTIVITY_BY_SPORT: Record<SessionLog['sport'], number> = {
  strength: 50,
  running: 37,
  cycling: 13,
  swimming: 46,
  hiking: 24,
  football: 41,
  basketball: 6,
  tennis: 48,
  padel: 79,
  climbing: 9,
  general: 3000,
};

/** Writes a finished Kairos session so it closes rings and shows in Fitness. */
export async function saveSession(s: SessionLog): Promise<string | null> {
  const m = hk();
  if (!m) return null;
  const start = new Date(s.startedAt);
  const end = new Date(s.endedAt);
  if (!(end.getTime() > start.getTime())) return null;
  const totals: { distance?: number; energyBurned?: number } = {};
  if (s.distanceKm) totals.distance = s.distanceKm * 1000;
  if (s.energyKcal) totals.energyBurned = s.energyKcal;
  const w = await m.saveWorkoutSample(
    ACTIVITY_BY_SPORT[s.sport] as HK.WorkoutActivityType,
    [],
    start,
    end,
    totals,
    { HKExternalUUID: s.id },
  );
  return w?.uuid ?? null;
}
