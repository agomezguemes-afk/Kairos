// Engine v2 · phase 6 — measured biometrics (Apple Watch via HealthKit).
// Spec: docs/engine/ENGINE-v2.md §Fase 6.
//
// Pure: the native bridge (src/lib/health/appleHealth.ts) hands raw
// samples in; this turns them into one row per day and into readiness
// evidence in the same units as everything else (% performance today).

import { dayIndex } from './fitnessFatigue';
import type { SleepNight } from './sleep';

const HOUR_MS = 3_600_000;

/** HealthKit sleep stages that count as sleep (inBed and awake do not). */
export const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

export interface SleepSample {
  start: string;
  end: string;
  /** HKCategoryValueSleepAnalysis. */
  value: number;
}

export interface ValueSample {
  at: string;
  value: number;
}

export interface BioDay {
  day: number;
  /** Total sleep of the night ending this day (h). */
  sleepHours?: number;
  /** Mean SDNN of the day (ms). Apple Watch samples it overnight. */
  hrv?: number;
  /** Resting heart rate (bpm). */
  rhr?: number;
}

export interface Biometrics {
  days: BioDay[];
  /** Highest heart rate seen in a workout (bpm), for zones and RPE. */
  hrMax?: number;
  updatedAt: string;
}

/** Longest single asleep sample and longest night accepted as real data. */
const MAX_SAMPLE_MS = 16 * HOUR_MS;
const MAX_NIGHT_MS = 14 * HOUR_MS;

/**
 * A night belongs to the day you wake up: anything ending before 14:00
 * counts for that day. Shifting by 10 h keeps it on UTC day buckets,
 * the same ones check-ins use.
 */
export function nightOf(end: string | Date): number {
  return dayIndex(new Date(new Date(end).getTime() + 10 * HOUR_MS));
}

/**
 * Hours asleep per night. iPhone and Watch both write sleep and stages
 * overlap, so intervals are merged before summing: nothing counts twice.
 */
export function sleepByNight(samples: SleepSample[]): Map<number, number> {
  const byNight = new Map<number, [number, number][]>();
  for (const s of samples) {
    if (!ASLEEP_VALUES.has(s.value)) continue;
    const a = new Date(s.start).getTime();
    const b = new Date(s.end).getTime();
    // A single "asleep" sample longer than any real sleep is a stuck sensor.
    if (!(b > a) || b - a > MAX_SAMPLE_MS) continue;
    const k = nightOf(s.end);
    const list = byNight.get(k) ?? [];
    list.push([a, b]);
    byNight.set(k, list);
  }
  const out = new Map<number, number>();
  for (const [k, list] of byNight) {
    list.sort((x, y) => x[0] - y[0]);
    let total = 0;
    let [cs, ce] = list[0];
    for (const [a, b] of list.slice(1)) {
      if (a <= ce) ce = Math.max(ce, b);
      else {
        total += ce - cs;
        [cs, ce] = [a, b];
      }
    }
    total += ce - cs;
    // Under 2 h is a nap or a watch taken off mid-night: not a night. Over
    // MAX_NIGHT_MS is implausible data, not a great night: leaving it out means
    // "no measurement", instead of erasing debt and adding a sleep bonus.
    if (total >= 2 * HOUR_MS && total <= MAX_NIGHT_MS) out.set(k, total / HOUR_MS);
  }
  return out;
}

function dailyMean(samples: ValueSample[]): Map<number, number> {
  const acc = new Map<number, { sum: number; n: number }>();
  for (const s of samples) {
    if (!Number.isFinite(s.value) || s.value <= 0) continue;
    const d = dayIndex(s.at);
    const a = acc.get(d) ?? { sum: 0, n: 0 };
    a.sum += s.value;
    a.n += 1;
    acc.set(d, a);
  }
  return new Map([...acc].map(([d, a]) => [d, a.sum / a.n]));
}

export function buildBioDays(
  sleep: SleepSample[],
  hrv: ValueSample[],
  rhr: ValueSample[],
): BioDay[] {
  const s = sleepByNight(sleep);
  const h = dailyMean(hrv);
  const r = dailyMean(rhr);
  const days = new Set([...s.keys(), ...h.keys(), ...r.keys()]);
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => ({ day, sleepHours: s.get(day), hrv: h.get(day), rhr: r.get(day) }));
}

/** New rows replace old ones for the same day; keeps the last 90 days. */
export function mergeBioDays(prev: BioDay[], next: BioDay[], today: number): BioDay[] {
  const map = new Map(prev.map((d) => [d.day, d]));
  for (const d of next) map.set(d.day, { ...map.get(d.day), ...stripUndefined(d) });
  return [...map.values()].filter((d) => d.day > today - 90).sort((a, b) => a.day - b.day);
}

function stripUndefined(d: BioDay): BioDay {
  const out: BioDay = { day: d.day };
  if (d.sleepHours !== undefined) out.sleepHours = d.sleepHours;
  if (d.hrv !== undefined) out.hrv = d.hrv;
  if (d.rhr !== undefined) out.rhr = d.rhr;
  return out;
}

/** Measured nights for the sleep-debt model; watch hours are precise (±0.3 h). */
export function measuredNights(bio: Biometrics | null | undefined): SleepNight[] {
  return (bio?.days ?? [])
    .filter((d) => d.sleepHours !== undefined)
    .map((d) => ({ day: d.day, hours: d.sleepHours as number, sd: 0.3 }));
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

/** Baseline over the 30 days before today; today never compares to itself. */
export function baseline(values: { day: number; v: number }[], today: number): Baseline | null {
  const xs = values.filter((x) => x.day < today && x.day >= today - 30).map((x) => x.v);
  if (xs.length < BASELINE_MIN) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
  return { mean, sd, n: xs.length };
}
const BASELINE_MIN = 10;

export interface BioSignal {
  kind: 'hrv' | 'rhr';
  label: string;
  /** % performance today; never positive (a good HRV is not a reason to push). */
  delta: number;
  sd: number;
  /** Standardised deviation from your own baseline. */
  z: number;
  source: string;
}

/**
 * HRV is compared on the log scale against the person's own 30-day
 * normal, with the smallest worthwhile change at 0.5 SD (Plews 2013).
 * Today's value counts only below −1 SD; the effect grows with the drop
 * and is capped, because HRV guides, it doesn't decide (Kiviniemi 2007).
 */
export function hrvSignal(days: BioDay[], today: number): BioSignal | null {
  const todayRow = days.find((d) => d.day === today && d.hrv !== undefined);
  if (!todayRow) return null;
  const base = baseline(
    days
      .filter((d) => d.hrv !== undefined)
      .map((d) => ({ day: d.day, v: Math.log(d.hrv as number) })),
    today,
  );
  if (!base || base.sd <= 0) return null;
  const z = (Math.log(todayRow.hrv as number) - base.mean) / base.sd;
  if (z >= -1) return null;
  const delta = Math.max(-3, 1.5 * (z + 0.5));
  return {
    kind: 'hrv',
    label: 'tu VFC de esta noche está por debajo de tu normal',
    delta,
    sd: 0.5 + 0.6 * Math.abs(delta),
    z,
    source: 'Plews 2013; Kiviniemi 2007 · Apple Watch',
  };
}

/** A resting HR well above your normal is an early sign of fatigue or illness (Buchheit 2014). */
export function rhrSignal(days: BioDay[], today: number): BioSignal | null {
  const todayRow = days.find((d) => d.day === today && d.rhr !== undefined);
  if (!todayRow) return null;
  const base = baseline(
    days.filter((d) => d.rhr !== undefined).map((d) => ({ day: d.day, v: d.rhr as number })),
    today,
  );
  if (!base) return null;
  const diff = (todayRow.rhr as number) - base.mean;
  const z = base.sd > 0 ? diff / base.sd : 0;
  if (diff < Math.max(5, 1.5 * base.sd)) return null;
  const delta = Math.max(-2.5, -0.2 * diff);
  return {
    kind: 'rhr',
    label: `tu pulso en reposo está ${Math.round(diff)} lpm por encima de tu normal`,
    delta,
    sd: 0.5 + 0.5 * Math.abs(delta),
    z,
    source: 'Buchheit 2014 · Apple Watch',
  };
}

/**
 * Both signals read the same autonomic state, so adding them would count
 * it twice: the stronger one counts fully, the other at half.
 */
export function autonomicEvidence(bio: Biometrics | null | undefined, today: number): BioSignal[] {
  if (!bio) return [];
  const signals = [hrvSignal(bio.days, today), rhrSignal(bio.days, today)].filter(
    (s): s is BioSignal => s !== null,
  );
  signals.sort((a, b) => a.delta - b.delta);
  return signals.map((s, i) => (i === 0 ? s : { ...s, delta: s.delta / 2, sd: s.sd / 2 }));
}

/** Last night's measured sleep, if the watch recorded it. */
export function lastNightHours(bio: Biometrics | null | undefined, today: number): number | null {
  return bio?.days.find((d) => d.day === today)?.sleepHours ?? null;
}
