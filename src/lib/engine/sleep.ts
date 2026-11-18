// Engine v2 · phase 3 — sleep debt and acute ordinal effects.
// Spec: docs/engine/ENGINE-v2.md §Fase 3.

import type { CheckIn } from '../adaptive/checkins';
import { dayIndex } from './fitnessFatigue';

/** Hours estimated from the 1–5 scale when no measured hours exist. */
export const HOURS_FROM_SCALE: Record<number, number> = {
  1: 4.5,
  2: 5.75,
  3: 6.75,
  4: 7.5,
  5: 8.25,
};
const HOURS_SD_FROM_SCALE = 1;

/** Inverse of HOURS_FROM_SCALE: the 1–5 level whose hours are closest. */
export function scaleFromHours(h: number): number {
  let best = 1;
  for (const [k, v] of Object.entries(HOURS_FROM_SCALE))
    if (Math.abs(v - h) < Math.abs(HOURS_FROM_SCALE[best] - h)) best = Number(k);
  return best;
}
/** Sleep need prior: ≥7 h consensus, athletes more (Watson 2015). */
export const SLEEP_NEED = { mean: 8, sd: 0.5 };
/** Debt decays ~e-fold every 4 nights: recovery is incomplete (Belenky 2003). */
const DEBT_TAU_NIGHTS = 4;
/** γ: % performance per hour of debt (prior), capped. */
export const DEBT_GAIN = { mean: 0.35, sd: 0.15 };
const DEBT_EFFECT_CAP = 6;

/** Monotone shapes from the literature; a personal β scales them (Bürkner 2020). */
export const SLEEP_SHAPE: Record<number, number> = { 1: -1, 2: -0.55, 3: -0.15, 4: 0, 5: 0.1 };
export const SORENESS_SHAPE: Record<number, number> = { 1: 0, 2: 0, 3: -0.2, 4: -0.55, 5: -1 };

export interface SleepNight {
  day: number;
  hours: number;
  /** Uncertainty of the hours themselves (1 h when inferred from 1–5). */
  sd: number;
}

/**
 * One value per night: the latest pre check-in of that day wins, and a
 * night measured by the watch beats anything typed by hand.
 */
export function sleepNights(checkins: CheckIn[], measured: SleepNight[] = []): SleepNight[] {
  const byDay = new Map<number, { at: number; night: SleepNight }>();
  for (const c of checkins) {
    if (c.kind !== 'pre') continue;
    const hours = c.sleepHours ?? (c.sleep !== undefined ? HOURS_FROM_SCALE[c.sleep] : undefined);
    if (hours === undefined) continue;
    const day = dayIndex(c.at);
    const at = new Date(c.at).getTime();
    const prev = byDay.get(day);
    if (!prev || at > prev.at) {
      byDay.set(day, {
        at,
        night: { day, hours, sd: c.sleepHours !== undefined ? 0.3 : HOURS_SD_FROM_SCALE },
      });
    }
  }
  const nights = new Map([...byDay].map(([d, v]) => [d, v.night]));
  for (const m of measured) nights.set(m.day, m);
  return [...nights.values()].sort((a, b) => a.day - b.day);
}

export interface SleepDebt {
  hours: number;
  /** SD of the debt, from hours and need uncertainty. */
  sd: number;
  nights: number;
}

export function sleepDebt(
  checkins: CheckIn[],
  today: number,
  measured: SleepNight[] = [],
): SleepDebt {
  const nights = sleepNights(checkins, measured).filter(
    (n) => n.day <= today && n.day > today - 21,
  );
  const decay = Math.exp(-1 / DEBT_TAU_NIGHTS);
  let debt = 0;
  let variance = 0;
  let last = nights.length ? nights[0].day : today;
  for (const n of nights) {
    const k = Math.pow(decay, n.day - last);
    debt *= k;
    variance *= k * k;
    const deficit = SLEEP_NEED.mean - n.hours;
    if (deficit > 0) {
      debt += deficit;
      variance += n.sd ** 2 + SLEEP_NEED.sd ** 2;
    }
    last = n.day;
  }
  const k = Math.pow(decay, today - last);
  return { hours: debt * k, sd: Math.sqrt(variance) * k, nights: nights.length };
}

/** Effect (% performance) of accumulated debt: −γ·D, with propagated variance. */
export function debtEffect(d: SleepDebt): { mean: number; variance: number } {
  const mean = Math.max(-DEBT_EFFECT_CAP, -DEBT_GAIN.mean * d.hours);
  // Var(γD) ≈ γ²Var(D) + D²Var(γ) (independent, first order).
  const variance = DEBT_GAIN.mean ** 2 * d.sd ** 2 + d.hours ** 2 * DEBT_GAIN.sd ** 2;
  return { mean, variance };
}
