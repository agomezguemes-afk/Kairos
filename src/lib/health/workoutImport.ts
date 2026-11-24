// Turns workouts recorded by the Apple Watch (read from HealthKit) into
// coach sessions. Pure: the native bridge normalises HealthKit objects into
// WatchWorkout first, so this runs in tests and on web.

import type { SessionLog, Sport } from '../adaptive/types';

export interface WatchWorkout {
  uuid: string;
  /** HKWorkoutActivityType raw value. */
  activityType: number;
  start: string;
  end: string;
  energyKcal?: number;
  distanceKm?: number;
  hrAvg?: number;
  hrMax?: number;
  sourceName: string;
  sourceBundle: string;
}

/**
 * HKWorkoutActivityType → Kairos sport. Walking is left out on purpose:
 * the watch auto-detects every walk, and counting them as training would
 * make adherence look perfect for someone who stopped training.
 */
const SPORT_BY_ACTIVITY: Record<number, Sport> = {
  37: 'running', // running
  49: 'running', // trackAndField
  71: 'running', // wheelchairRunPace
  24: 'hiking',
  13: 'cycling',
  74: 'cycling', // handCycling
  46: 'swimming',
  50: 'strength', // traditionalStrengthTraining
  20: 'strength', // functionalStrengthTraining
  59: 'strength', // coreTraining
  11: 'strength', // crossTraining
  41: 'football', // soccer
  6: 'basketball',
  48: 'tennis',
  79: 'padel', // pickleball: the closest racket type many padel players pick
  9: 'climbing',
  63: 'general', // HIIT
  73: 'general', // mixedCardio
  30: 'general', // mixedMetabolicCardioTraining
  16: 'general', // elliptical
  35: 'general', // rowing
  44: 'general', // stairClimbing
  64: 'general', // jumpRope
  57: 'general', // yoga
  66: 'general', // pilates
  62: 'general', // flexibility
  8: 'general', // boxing
  65: 'general', // kickboxing
  28: 'general', // martialArts
  3000: 'general', // other
};

export const SPORT_TITLE: Record<Sport, string> = {
  padel: 'Pádel',
  tennis: 'Tenis',
  climbing: 'Escalada',
  hiking: 'Senderismo',
  running: 'Carrera',
  cycling: 'Ciclismo',
  football: 'Fútbol',
  basketball: 'Baloncesto',
  swimming: 'Natación',
  strength: 'Fuerza',
  general: 'Entrenamiento',
};

const MIN_DURATION_MIN = 5;

export function sportFromActivity(type: number): Sport | null {
  return SPORT_BY_ACTIVITY[type] ?? null;
}

/**
 * %HRmax → session RPE (CR-10). Anchors follow the HR–RPE relation behind
 * Foster's session-RPE (Foster 2001): 60 % ≈ 2, 80 % ≈ 5.5, 90 % ≈ 8.
 */
const HR_RPE: [number, number][] = [
  [0.5, 1],
  [0.6, 2],
  [0.7, 3.5],
  [0.8, 5.5],
  [0.85, 7],
  [0.9, 8],
  [0.95, 9],
  [1, 10],
];

export function rpeFromHeartRate(hrAvg: number, hrMax: number): number {
  const pct = hrAvg / hrMax;
  if (pct <= HR_RPE[0][0]) return HR_RPE[0][1];
  for (let i = 1; i < HR_RPE.length; i++) {
    const [x1, y1] = HR_RPE[i];
    const [x0, y0] = HR_RPE[i - 1];
    if (pct <= x1) return Math.round((y0 + ((pct - x0) / (x1 - x0)) * (y1 - y0)) * 10) / 10;
  }
  return 10;
}

/** Without a measured max: Tanaka 2001, or 190 when age is unknown. */
export function estimateHrMax(observedMax?: number, age?: number): number {
  const tanaka = age ? 208 - 0.7 * age : 190;
  return observedMax && observedMax >= 160 ? Math.max(observedMax, tanaka * 0.95) : tanaka;
}

function sessionRpe(w: WatchWorkout, sport: Sport, hrMax: number): number {
  // HR under-reads lifting: short sets barely move it while effort is high.
  const floor = sport === 'strength' ? 6 : 0;
  if (w.hrAvg && w.hrAvg > 0) return Math.max(floor, rpeFromHeartRate(w.hrAvg, hrMax));
  return Math.max(floor, 5);
}

export function workoutToSession(w: WatchWorkout, hrMax: number): SessionLog | null {
  const sport = sportFromActivity(w.activityType);
  if (!sport) return null;
  const durationMin = Math.round(
    (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60_000,
  );
  if (!(durationMin >= MIN_DURATION_MIN)) return null;
  return {
    id: `hk-${w.uuid}`,
    title: SPORT_TITLE[sport],
    sport,
    startedAt: w.start,
    endedAt: w.end,
    durationMin,
    rpe: sessionRpe(w, sport, hrMax),
    movements: [],
    sensors: {
      hrAvg: w.hrAvg ? Math.round(w.hrAvg) : undefined,
      hrMax: w.hrMax ? Math.round(w.hrMax) : undefined,
      sources: [w.sourceName || 'Apple Watch'],
    },
    source: 'watch',
    distanceKm: w.distanceKm,
    energyKcal: w.energyKcal ? Math.round(w.energyKcal) : undefined,
  };
}

function overlapRatio(a: SessionLog, w: WatchWorkout): number {
  const a0 = new Date(a.startedAt).getTime();
  const a1 = new Date(a.endedAt).getTime();
  const b0 = new Date(w.start).getTime();
  const b1 = new Date(w.end).getTime();
  const overlap = Math.min(a1, b1) - Math.max(a0, b0);
  const shorter = Math.min(a1 - a0, b1 - b0);
  return shorter > 0 ? Math.max(0, overlap) / shorter : 0;
}

export interface ImportResult {
  sessions: SessionLog[];
  added: number;
  enriched: number;
}

/**
 * Merges watch workouts into the session history:
 * - workouts Kairos itself wrote to HealthKit are skipped (they are already here);
 * - a workout recorded while a Kairos session was running enriches that
 *   session with its heart rate instead of counting twice;
 * - everything else becomes a new session; deleted HealthKit workouts go.
 */
/**
 * Kairos and its Watch app (bundle `<app>.watch`) write their own workouts;
 * those sessions already arrive with full detail, so Health copies are skipped.
 */
function isOwn(bundle: string, own?: string): boolean {
  return !!own && (bundle === own || bundle.startsWith(`${own}.`));
}

export function mergeWatchWorkouts(
  sessions: SessionLog[],
  workouts: WatchWorkout[],
  opts: { ownBundle?: string; hrMax: number; deletedUuids?: string[] },
): ImportResult {
  const deleted = new Set((opts.deletedUuids ?? []).map((u) => `hk-${u}`));
  let out = sessions.filter((s) => !deleted.has(s.id));
  const known = new Set(out.map((s) => s.id));
  const matched = new Set(out.map((s) => s.externalId).filter(Boolean));
  let added = 0;
  let enriched = 0;
  for (const w of workouts) {
    if (isOwn(w.sourceBundle, opts.ownBundle)) continue;
    if (known.has(`hk-${w.uuid}`) || matched.has(w.uuid)) continue;
    const twin = out.find((s) => s.source !== 'watch' && overlapRatio(s, w) >= 0.5);
    if (twin) {
      if (!twin.sensors?.hrAvg && w.hrAvg) {
        out = out.map((s) =>
          s.id === twin.id
            ? {
                ...s,
                sensors: {
                  ...s.sensors,
                  hrAvg: Math.round(w.hrAvg as number),
                  hrMax: w.hrMax ? Math.round(w.hrMax) : s.sensors?.hrMax,
                  sources: [...(s.sensors?.sources ?? []), w.sourceName || 'Apple Watch'],
                },
                externalId: w.uuid,
              }
            : s,
        );
        enriched++;
      }
      continue;
    }
    const s = workoutToSession(w, opts.hrMax);
    if (!s) continue;
    out.push(s);
    known.add(s.id);
    added++;
  }
  out.sort((a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime());
  return { sessions: out, added, enriched };
}
