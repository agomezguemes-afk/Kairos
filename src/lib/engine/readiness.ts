// Engine v2 · probabilistic readiness. Spec: docs/engine/ENGINE-v2.md.
//
// P(today's performance ≥ recent level − SWC) from the fitness-fatigue
// predictive, then adjusted in log-odds space by check-in likelihood ratios
// taken from the literature (personalised in phase 3).

import type { CheckIn } from '../adaptive/checkins';
import type { SessionLog } from '../adaptive/types';
import { sessionLoad } from '../adaptive/metrics';
import {
  dailyImpulses,
  dayIndex,
  fitTaus,
  normCdf,
  strengthObservations,
  type FFResult,
} from './fitnessFatigue';

export interface Evidence {
  label: string;
  /** Log-odds contribution (negative lowers readiness). */
  delta: number;
  source: string;
}

export type ReadinessBandV2 = 'go' | 'easy' | 'rest';

export interface ReadinessV2 {
  /** 0–1 probability of performing at or above the recent level. */
  probability: number;
  band: ReadinessBandV2;
  /** Model-only probability before check-ins. */
  modelProbability: number;
  /** Net training form today (%), with its standard deviation. */
  form: { mean: number; sd: number };
  evidence: Evidence[];
  /** False while the estimate rests on literature priors, not the person. */
  informed: boolean;
  observations: number;
  taus: { tau1: number; tau2: number };
  load: LoadPattern;
}

export interface LoadPattern {
  weekly: number;
  monotony: number | null;
  strain: number | null;
  /** Strain above the person's own 90th percentile (needs ≥ 4 weeks). */
  highStrain: boolean;
}

const PRE_VALID_MS = 18 * 3_600_000;
const DAY_MS = 86_400_000;
/** Minimum observations before the posterior is considered personal. */
const INFORMED_MIN = 3;

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

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

/** Check-in likelihood ratios (spec table). */
function checkInEvidence(checkins: CheckIn[], now: Date): { ev: Evidence[]; pain: boolean } {
  const t = now.getTime();
  const pre = [...checkins]
    .filter((c) => c.kind === 'pre' && t - new Date(c.at).getTime() <= PRE_VALID_MS)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  const pain = checkins.some((c) => c.pain && t - new Date(c.at).getTime() <= 3 * DAY_MS);
  const ev: Evidence[] = [];
  const SLEEP = 'Fullagar 2015; Craven 2022';
  const DOMS = 'Cheung, Hume & Maxwell 2003';
  if (pre?.sleep === 1) ev.push({ label: 'dormiste muy mal', delta: -0.8, source: SLEEP });
  else if (pre?.sleep === 2) ev.push({ label: 'dormiste mal', delta: -0.5, source: SLEEP });
  else if (pre?.sleep === 5) ev.push({ label: 'dormiste muy bien', delta: 0.2, source: SLEEP });
  if (pre?.soreness === 5)
    ev.push({ label: 'tienes agujetas muy fuertes', delta: -0.9, source: DOMS });
  else if (pre?.soreness === 4)
    ev.push({ label: 'tienes agujetas fuertes', delta: -0.5, source: DOMS });
  if (pain)
    ev.push({
      label: 'marcaste dolor en los últimos 3 días',
      delta: -1.5,
      source: 'Regla de seguridad',
    });
  return { ev, pain };
}

export function readinessV2(
  sessions: SessionLog[],
  checkins: CheckIn[],
  now: Date = new Date(),
  fitted?: FFResult,
): ReadinessV2 {
  const today = dayIndex(now);
  const ff =
    fitted ??
    fitTaus(dailyImpulses(sessions, dayIndex), strengthObservations(sessions, dayIndex), today);
  const days = ff.days;
  const todayState = days[days.length - 1];
  const recent = days.slice(-15, -1);

  let modelProbability = 0.65;
  let formSd = 0;
  if (todayState && recent.length) {
    const level = recent.reduce((a, d) => a + d.mean, 0) / recent.length;
    // SWC = 0.2 × between-day SD (Hopkins 2004); the observation noise is
    // that SD here, so SWC = 0.2 × 4 % = 0.8 %.
    const swc = 0.2 * Math.sqrt(16);
    const sd = Math.sqrt(todayState.variance);
    modelProbability = 1 - normCdf((level - swc - todayState.mean) / sd);
    formSd = Math.sqrt(Math.max(0, todayState.variance - 16));
  }
  // Day-to-day noise (~4 %) makes certainty dishonest: the model alone never
  // claims more than 90 % either way; check-ins can move it further.
  modelProbability = Math.min(0.9, Math.max(0.1, modelProbability));

  const { ev, pain } = checkInEvidence(checkins, now);
  const load = loadPattern(sessions, now);
  if (load.highStrain && load.monotony !== null && load.monotony > 2) {
    ev.push({ label: 'semana muy cargada y monótona', delta: -0.4, source: 'Foster 1998' });
  }
  const evidence: Evidence[] = [
    {
      label:
        todayState && todayState.form < 0
          ? 'fatiga acumulada por encima de tu forma'
          : 'balance forma-fatiga',
      delta: 0,
      source: 'Banister 1975 (modelo forma-fatiga)',
    },
    ...ev,
  ];
  let probability = sigmoid(logit(modelProbability) + ev.reduce((a, e) => a + e.delta, 0));
  if (pain) probability = Math.min(probability, 0.35);

  return {
    probability,
    band: probability >= 0.65 ? 'go' : probability >= 0.4 ? 'easy' : 'rest',
    modelProbability,
    form: { mean: todayState?.form ?? 0, sd: formSd },
    evidence,
    informed: ff.observations >= INFORMED_MIN,
    observations: ff.observations,
    taus: ff.params,
    load,
  };
}
