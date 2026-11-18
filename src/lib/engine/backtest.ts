// Prequential replay: re-make every past forecast with only the data that
// existed at that moment, then compare it with what happened. It always
// judges the current model (a stored log would judge old versions), and
// it has a track record from day one instead of after weeks of logging.
// Each family feeds the perspective that owns it (see lenses.ts).

import type { CheckIn } from '../adaptive/checkins';
import type { Experiment } from '../adaptive/experiments';
import { getMovement } from '../adaptive/catalog';
import type { SessionLog } from '../adaptive/types';
import type { Biometrics } from './biometrics';
import {
  calibrationReport,
  intervalReport,
  type CalibrationReport,
  type Forecast,
  type IntervalForecast,
  type IntervalReport,
} from './calibration';
import { capacityOf, chooseLoad } from './decision';
import { dayIndex, DAY_MS, strengthObservations } from './fitnessFatigue';
import { READINESS_SWC, readinessV2 } from './readiness';
import { adherence, painEpisodes, painRecurrence } from './survival';

export type ForecastFamily = 'readiness' | 'load' | 'adherence' | 'pain';

export interface CalibrationSet {
  readiness: CalibrationReport;
  /** Expected performance vs observed, as an interval. */
  performance: IntervalReport;
  load: CalibrationReport;
  adherence: CalibrationReport;
  pain: CalibrationReport;
  at: string;
}

/** Most recent forecasts kept per family: enough to judge, cheap to replay. */
export const REPLAY_MAX = 60;
/** Overlapping windows say the same thing twice; one forecast per week. */
const WINDOW_SPACING_DAYS = 7;
/** Two logs closer than this are one outing (same rule as adherence). */
const SAME_OUTING_DAYS = 0.2;

const byStart = (a: SessionLog, b: SessionLog) =>
  new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
const ms = (iso: string) => new Date(iso).getTime();

function biometricsUntil(b: Biometrics | null | undefined, day: number): Biometrics | null {
  if (!b) return null;
  return { ...b, days: b.days.filter((d) => d.day <= day) };
}

/**
 * Readiness, as it would have been shown before each session that produced
 * a performance observation: P(performance ≥ level − SWC), plus the
 * expected-performance interval.
 */
export function replayReadiness(
  sessions: SessionLog[],
  checkins: CheckIn[],
  biometrics?: Biometrics | null,
  max = REPLAY_MAX,
): { forecasts: Forecast[]; intervals: IntervalForecast[] } {
  const sorted = [...sessions].sort(byStart);
  // Which sessions produce an observation, computed once in one pass.
  const observed: { index: number; y: number }[] = [];
  let count = 0;
  for (let i = 0; i < sorted.length; i++) {
    const obs = strengthObservations(sorted.slice(0, i + 1), dayIndex);
    if (obs.length > count) observed.push({ index: i, y: obs[obs.length - 1].y });
    count = obs.length;
  }
  const forecasts: Forecast[] = [];
  const intervals: IntervalForecast[] = [];
  for (const { index, y } of observed.slice(-max)) {
    const s = sorted[index];
    const t = ms(s.startedAt);
    const before = sorted.slice(0, index).filter((x) => ms(x.endedAt) <= t);
    if (!before.length) continue;
    const r = readinessV2(
      before,
      checkins.filter((c) => ms(c.at) <= t),
      new Date(t),
      {
        biometrics: biometricsUntil(biometrics, dayIndex(s.startedAt)),
        nextMovements: s.movements.map((m) => m.movementId),
      },
    );
    // Without observations the forecast is the prior; scoring it says nothing.
    if (!r.informed) continue;
    forecasts.push({
      at: s.startedAt,
      p: r.predictive,
      outcome: y - r.level >= -READINESS_SWC ? 1 : 0,
    });
    intervals.push({ at: s.startedAt, mean: r.expected.mean, sd: r.expected.sd, y: y - r.level });
  }
  return { forecasts, intervals };
}

/**
 * The load decision's probability of completing the target at the load the
 * person actually used, from the previous exposure only.
 */
export function replayLoads(sessions: SessionLog[], max = REPLAY_MAX): Forecast[] {
  const sorted = [...sessions].sort(byStart);
  const last = new Map<string, SessionLog['movements'][number]>();
  const caps = new Map<string, number[]>();
  const out: Forecast[] = [];
  for (const s of sorted) {
    for (const m of s.movements) {
      const mv = getMovement(m.movementId);
      if (mv?.kind !== 'strength') continue;
      const done = m.sets.filter((x) => x.completed && x.reps !== undefined && (x.reps ?? 0) <= 12);
      const prev = last.get(m.movementId);
      const history = caps.get(m.movementId) ?? [];
      const repsMin = m.target.repsMin;
      const load = Math.max(0, ...done.map((x) => x.loadKg ?? 0));
      if (prev && repsMin !== undefined && load > 0) {
        const rirTarget = m.target.rir ?? 2;
        const choice = chooseLoad({
          current: load,
          increment: mv.incrementKg ?? 2.5,
          lastSets: prev.sets,
          history,
          repsMin,
          rirTarget,
        });
        const need = capacityOf(load, repsMin, rirTarget);
        const hit = done.some(
          (x) => (x.loadKg ?? 0) >= load && capacityOf(load, x.reps!, x.rir ?? 0) >= need,
        );
        out.push({ at: s.startedAt, p: choice.candidates[0].probability, outcome: hit ? 1 : 0 });
      }
      if (done.length) {
        last.set(m.movementId, m);
        const best = Math.max(...done.map((x) => capacityOf(x.loadKg ?? 0, x.reps!, x.rir ?? 0)));
        caps.set(m.movementId, [...history, best]);
      }
    }
  }
  return out.slice(-max);
}

/** Distinct outings, oldest first: what adherence counts as a session. */
function outings(sessions: SessionLog[]): SessionLog[] {
  const out: SessionLog[] = [];
  for (const s of [...sessions].sort(byStart)) {
    const prev = out[out.length - 1];
    if (prev && (ms(s.startedAt) - ms(prev.endedAt)) / DAY_MS < SAME_OUTING_DAYS) {
      out[out.length - 1] = ms(s.endedAt) > ms(prev.endedAt) ? s : prev;
      continue;
    }
    out.push(s);
  }
  return out;
}

/** Thins forecasts so their windows overlap at most once a week. */
function spaced<T extends { t: number }>(items: T[], days: number): T[] {
  const out: T[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (!prev || it.t - prev.t >= days * DAY_MS) out.push(it);
  }
  return out;
}

/** P(training again within 7 days), made right after each outing. */
export function replayAdherence(
  sessions: SessionLog[],
  now: Date,
  daysPerWeek = 3,
  max = REPLAY_MAX,
): Forecast[] {
  const outs = outings(sessions);
  const out: Forecast[] = [];
  // Each forecast is about a different gap, so every outing counts.
  const points = outs.map((s, i) => ({ s, i, t: ms(s.endedAt) }));
  for (const { s, i, t } of points) {
    const next = outs[i + 1];
    const returned = next ? ms(next.startedAt) - t <= 7 * DAY_MS : false;
    // Unresolved until the person trains again or the week runs out.
    if (!returned && now.getTime() - t < 7 * DAY_MS) continue;
    const a = adherence(outs.slice(0, i + 1), new Date(t), daysPerWeek);
    if (!a) continue;
    out.push({ at: s.endedAt, p: a.within7, outcome: returned ? 1 : 0 });
  }
  return out.slice(-max);
}

/** P(a new pain episode within 14 days), at most once a week. */
export function replayPain(
  sessions: SessionLog[],
  checkins: CheckIn[],
  experiments: Experiment[],
  now: Date,
  max = REPLAY_MAX,
): Forecast[] {
  const all = painEpisodes(checkins, experiments);
  if (!all.length) return [];
  const reports = [
    ...checkins.filter((c) => c.pain).map((c) => ms(c.at)),
    ...experiments
      .filter((e) => e.answers?.feel === 'pain' && e.closedAt)
      .map((e) => ms(e.closedAt!)),
  ].sort((a, b) => a - b);
  // A report starts a new episode when the previous one is > 7 days old.
  const starts = reports.filter((t, i) => i === 0 || t - reports[i - 1] > 7 * DAY_MS);
  const points = spaced(
    outings(sessions).map((s) => ({ s, t: ms(s.endedAt) })),
    WINDOW_SPACING_DAYS,
  );
  const out: Forecast[] = [];
  for (const { s, t } of points) {
    if (now.getTime() - t < 14 * DAY_MS) continue;
    const r = painRecurrence(
      checkins.filter((c) => ms(c.at) <= t),
      experiments.filter((e) => !e.closedAt || ms(e.closedAt) <= t),
      new Date(t),
    );
    // Before any pain there is no model; during an episode it is not a forecast.
    if (!r || r.active) continue;
    const hit = starts.some((x) => x > t && x <= t + 14 * DAY_MS);
    out.push({ at: s.endedAt, p: r.risk14, outcome: hit ? 1 : 0 });
  }
  return out.slice(-max);
}

export interface CalibrationInput {
  sessions: SessionLog[];
  checkins: CheckIn[];
  experiments: Experiment[];
  biometrics?: Biometrics | null;
  daysPerWeek?: number;
  now?: Date;
}

/** The engine's track record, one report per perspective's forecast. */
export function calibrate(input: CalibrationInput): CalibrationSet {
  const now = input.now ?? new Date();
  const r = replayReadiness(input.sessions, input.checkins, input.biometrics);
  return {
    readiness: calibrationReport(r.forecasts),
    performance: intervalReport(r.intervals),
    load: calibrationReport(replayLoads(input.sessions)),
    adherence: calibrationReport(replayAdherence(input.sessions, now, input.daysPerWeek ?? 3)),
    pain: calibrationReport(replayPain(input.sessions, input.checkins, input.experiments, now)),
    at: now.toISOString(),
  };
}
