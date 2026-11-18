// Engine v2 · readiness (phases 2–3). Spec: docs/engine/ENGINE-v2.md.
//
// Every signal is an effect in performance units (%) on top of the
// fitness-fatigue predictive, with its own variance. Readiness is then
// P(today ≥ recent level − SWC) under that shifted, widened predictive.

import type { CheckIn } from '../adaptive/checkins';
import type { SessionLog } from '../adaptive/types';
import { sessionLoad } from '../adaptive/metrics';
import {
  dailyImpulses,
  dayIndex,
  fitTaus,
  normCdf,
  OBS_VAR,
  strengthObservations,
} from './fitnessFatigue';
import { checkInEffect, learnSensitivity, preByDay, type Sensitivity } from './personal';
import {
  recoveryRate,
  recoveryStatus,
  sessionRegions,
  type RatePosterior,
  type RegionStatus,
} from './recovery';
import { debtEffect, scaleFromHours, sleepDebt, type SleepDebt } from './sleep';
import { autonomicEvidence, lastNightHours, measuredNights, type Biometrics } from './biometrics';

export interface Evidence {
  label: string;
  /** Effect on expected performance today (%); 0 = informative only. */
  delta: number;
  /** SD of that effect (%). */
  sd: number;
  source: string;
}

export type ReadinessBandV2 = 'go' | 'easy' | 'rest';

export interface ReadinessV2 {
  probability: number;
  band: ReadinessBandV2;
  /** Fitness-fatigue only, before any other effect. */
  modelProbability: number;
  form: { mean: number; sd: number };
  /** Expected performance today vs recent level (%), all effects included. */
  expected: { mean: number; sd: number };
  evidence: Evidence[];
  informed: boolean;
  observations: number;
  taus: { tau1: number; tau2: number };
  load: LoadPattern;
  sleep: SleepDebt;
  sensitivity: Sensitivity;
  recovery: { regions: RegionStatus[]; rate: RatePosterior };
}

export interface LoadPattern {
  weekly: number;
  monotony: number | null;
  strain: number | null;
  highStrain: boolean;
}

export interface ReadinessOptions {
  /** Movement ids of the session the person is about to do. */
  nextMovements?: string[];
  /** Watch-measured sleep, HRV and resting HR (HealthKit). */
  biometrics?: Biometrics | null;
}

const PRE_VALID_MS = 18 * 3_600_000;
const DAY_MS = 86_400_000;
const INFORMED_MIN = 3;
/** SWC = 0.2 × between-day SD (Hopkins 2004). */
const SWC = 0.2 * Math.sqrt(OBS_VAR);
const clampP = (p: number) => Math.min(0.9, Math.max(0.1, p));

/** Foster 1998: monotony = mean/SD of daily load (rest days count as 0). */
export function loadPattern(sessions: SessionLog[], now: Date): LoadPattern {
  const today = dayIndex(now);
  const daily = new Map<number, number>();
  for (const s of sessions) {
    const d = dayIndex(s.endedAt);
    daily.set(d, (daily.get(d) ?? 0) + sessionLoad(s));
  }
  const week = (endDay: number) => Array.from({ length: 7 }, (_, i) => daily.get(endDay - i) ?? 0);
  const stats = (xs: number[]) => {
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    return { sum: mean * xs.length, mean, sd };
  };
  const cur = stats(week(today));
  // A constant week has SD 0; cap monotony instead of dividing by zero.
  const monotony = cur.sum > 0 ? Math.min(10, cur.mean / Math.max(cur.sd, 1e-6)) : null;
  const strain = monotony !== null ? cur.sum * monotony : null;

  const past: number[] = [];
  for (let k = 1; k <= 12; k++) {
    const st = stats(week(today - 7 * k));
    if (st.sum > 0) past.push(st.sum * Math.min(10, st.mean / Math.max(st.sd, 1e-6)));
  }
  let highStrain = false;
  if (strain !== null && past.length >= 4) {
    const sorted = [...past].sort((a, b) => a - b);
    const p90 = sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))];
    highStrain = strain > p90;
  }
  return { weekly: Math.round(cur.sum), monotony, strain, highStrain };
}

export function readinessV2(
  sessions: SessionLog[],
  checkins: CheckIn[],
  now: Date = new Date(),
  opts: ReadinessOptions = {},
): ReadinessV2 {
  const today = dayIndex(now);
  const ff = fitTaus(
    dailyImpulses(sessions, dayIndex),
    strengthObservations(sessions, dayIndex),
    today,
  );
  const todayState = ff.days[ff.days.length - 1];
  const recent = ff.days.slice(-15, -1);
  const level = recent.length
    ? recent.reduce((a, d) => a + d.mean, 0) / recent.length
    : (todayState?.mean ?? 0);
  const ffMean = todayState?.mean ?? 0;
  const ffVar = todayState?.variance ?? OBS_VAR;
  const modelProbability = clampP(1 - normCdf((level - SWC - ffMean) / Math.sqrt(ffVar)));

  const evidence: Evidence[] = [
    {
      label:
        (todayState?.form ?? 0) < 0
          ? 'tu fatiga reciente pesa más que tu forma'
          : 'tu forma compensa tu fatiga reciente',
      delta: 0,
      sd: 0,
      source: 'Banister 1975 (forma-fatiga)',
    },
  ];
  const t = now.getTime();

  // Last night + soreness, scaled by the person's learned sensitivity.
  const sensitivity = learnSensitivity(ff.days, checkins);
  const pre = preByDay(checkins).get(today);
  const preFresh = pre && t - new Date(pre.at).getTime() <= PRE_VALID_MS ? pre : undefined;
  // Measured hours beat the 1–5 answer; the learned scale still applies.
  const watched = lastNightHours(opts.biometrics, today);
  const acute: CheckIn | undefined =
    watched !== null
      ? {
          id: 'watch',
          at: now.toISOString(),
          kind: 'pre',
          ...preFresh,
          sleep: scaleFromHours(watched),
        }
      : preFresh;
  const ci = checkInEffect(acute, sensitivity);
  const personal = sensitivity.samples >= 3 ? ' · ajustado a ti' : '';
  if (ci.sleep.mean !== 0) {
    const hours = watched !== null ? ` (${watched.toFixed(1).replace('.', ',')} h)` : '';
    evidence.push({
      label: (ci.sleep.mean < 0 ? 'dormiste mal anoche' : 'dormiste muy bien') + hours,
      delta: ci.sleep.mean,
      sd: Math.sqrt(ci.sleep.variance),
      source: `Fullagar 2015; Craven 2022${personal}`,
    });
  }
  if (ci.soreness.mean !== 0) {
    evidence.push({
      label: 'tienes agujetas',
      delta: ci.soreness.mean,
      sd: Math.sqrt(ci.soreness.variance),
      source: `Cheung 2003${personal}`,
    });
  }

  // Accumulated sleep debt (excluding nothing: debt and last night are
  // distinct mechanisms — chronic vs acute).
  const sleep = sleepDebt(checkins, today, measuredNights(opts.biometrics));
  const de = debtEffect(sleep);
  if (sleep.hours >= 1) {
    evidence.push({
      label: `llevas ${sleep.hours.toFixed(1).replace('.', ',')} h de deuda de sueño`,
      delta: de.mean,
      sd: Math.sqrt(de.variance),
      source: 'Borbély 1982; Belenky 2003',
    });
  }

  // Region recovery for the session about to be done.
  const rate = recoveryRate(sessions, checkins);
  const regions = recoveryStatus(sessions, now, rate.mean);
  if (opts.nextMovements?.length) {
    const load = sessionRegions(opts.nextMovements);
    let worst: { status: RegionStatus; effect: number } | null = null;
    for (const r of regions) {
      const w = load[r.region] ?? 0;
      if (!w || r.recovered >= 0.7) continue;
      const effect = -4 * ((0.7 - r.recovered) / 0.7) * w;
      if (!worst || effect < worst.effect) worst = { status: r, effect };
    }
    if (worst) {
      evidence.push({
        label: `la recuperación de ${worst.status.label.toLowerCase()} va al ${Math.round(worst.status.recovered * 100)} %`,
        delta: worst.effect,
        sd: Math.abs(worst.effect) * 0.5,
        source: `Bishop 2008; McLester 2003 · ritmo personal ×${rate.mean.toFixed(2).replace('.', ',')}`,
      });
    }
  }

  for (const b of autonomicEvidence(opts.biometrics, today))
    evidence.push({ label: b.label, delta: b.delta, sd: b.sd, source: b.source });

  const load = loadPattern(sessions, now);
  if (load.highStrain && load.monotony !== null && load.monotony > 2) {
    evidence.push({
      label: 'semana muy cargada y monótona',
      delta: -1.5,
      sd: 1,
      source: 'Foster 1998',
    });
  }

  const shift = evidence.reduce((a, e) => a + e.delta, 0);
  const extraVar = evidence.reduce((a, e) => a + e.sd ** 2, 0);
  const mean = ffMean + shift;
  const sd = Math.sqrt(ffVar + extraVar);
  let probability = clampP(1 - normCdf((level - SWC - mean) / sd));

  const pain = checkins.some((c) => c.pain && t - new Date(c.at).getTime() <= 3 * DAY_MS);
  if (pain) {
    evidence.push({
      label: 'marcaste dolor en los últimos 3 días',
      delta: 0,
      sd: 0,
      source: 'Regla de seguridad',
    });
    probability = Math.min(probability, 0.35);
  }

  return {
    probability,
    band: probability >= 0.65 ? 'go' : probability >= 0.4 ? 'easy' : 'rest',
    modelProbability,
    form: {
      mean: todayState?.form ?? 0,
      sd: Math.sqrt(Math.max(0, (todayState?.variance ?? OBS_VAR) - OBS_VAR)),
    },
    expected: { mean: mean - level, sd },
    evidence,
    informed: ff.observations >= INFORMED_MIN,
    observations: ff.observations,
    taus: ff.params,
    load,
    sleep,
    sensitivity,
    recovery: { regions, rate },
  };
}
