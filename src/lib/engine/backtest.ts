// Prequential replay: re-make every past forecast with only the data that
// existed at that moment, then compare it with what happened. It judges
// the current model and has a track record from day one.
//
// It is also the engine's training set. Each past session is distilled
// once into a compact case (the forecast it would have got, how it went,
// the context it started from) and cached under a fingerprint of exactly
// the data it depends on (cache.ts). A pass only computes what is new or
// what changed; sessions that slide out of the detailed window are folded
// into the long-term archive (archive.ts) instead of being forgotten.

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
import { decay, fingerprint, Memo, Timeline } from './cache';
import { archivedForecasts, type Archive } from './archive';
import { capacityOf, chooseLoad } from './decision';
import { dayIndex, DAY_MS, strengthObservations } from './fitnessFatigue';
import { decisionContext, type DecisionContext } from './memory';
import { READINESS_SWC, readinessV2 } from './readiness';
import { adherence, painRecurrence } from './survival';

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

/** Sessions kept in full detail; older ones live in the archive. */
export const REPLAY_MAX = 120;
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

/** One past session distilled: what was forecast, what happened, from where. */
export interface CaseRecord {
  sessionId: string;
  at: string;
  /** Readiness before the session, uncapped. */
  p: number;
  level: number;
  expMean: number;
  expSd: number;
  informed: boolean;
  /** Performance observation (%), when the session produced one. */
  y: number | null;
  context: DecisionContext;
}

/** Fingerprints of every input stream, built once per pass. */
export interface Timelines {
  sessions: Timeline;
  checkins: Timeline;
  biometrics: Timeline;
  experiments: Timeline;
}

export function timelines(
  sessions: SessionLog[],
  checkins: CheckIn[],
  experiments: Experiment[] = [],
  biometrics?: Biometrics | null,
): Timelines {
  return {
    sessions: new Timeline(sessions.map((s) => ({ t: ms(s.endedAt), key: fingerprint(s) }))),
    checkins: new Timeline(checkins.map((c) => ({ t: ms(c.at), key: fingerprint(c) }))),
    biometrics: new Timeline(
      (biometrics?.days ?? []).map((d) => ({ t: d.day, key: fingerprint(d) })),
    ),
    experiments: new Timeline(
      experiments
        .filter((e) => e.closedAt)
        .map((e) => ({
          t: ms(e.closedAt!),
          key: `${e.id}:${e.closedAt}:${e.answers?.feel ?? ''}`,
        })),
    ),
  };
}

/**
 * A cached forecast with the outcome it had when cached. The live window
 * recomputes outcomes; the cached one is only used when folding into the
 * archive, long after it settled.
 */
export interface CachedForecast {
  at: string;
  p: number;
  outcome: number;
}

/** Everything a pass needs to reuse past work. */
export interface ReplayContext {
  memo: Memo;
  tl: Timelines;
}

const freshContext = (
  sessions: SessionLog[],
  checkins: CheckIn[],
  experiments: Experiment[] = [],
  biometrics?: Biometrics | null,
): ReplayContext => ({
  memo: new Memo(null),
  tl: timelines(sessions, checkins, experiments, biometrics),
});

/**
 * The last `max` sessions as cases. Cached ones are lookups; missing ones
 * are computed while the pass budget lasts (the rest come next pass).
 */
export function replayCases(
  sessions: SessionLog[],
  checkins: CheckIn[],
  biometrics?: Biometrics | null,
  ctx: ReplayContext = freshContext(sessions, checkins, [], biometrics),
  max = REPLAY_MAX,
): CaseRecord[] {
  const sorted = [...sessions].sort(byStart);
  // One O(n) pass gives every session's observation.
  const ys = new Map<string, number>();
  for (const o of strengthObservations(sorted, dayIndex)) if (o.sessionId) ys.set(o.sessionId, o.y);
  const out: CaseRecord[] = [];
  // Newest first: if the budget runs out, the recent past is what's ready.
  const window = sorted.slice(-max).reverse();
  for (const s of window) {
    const t = ms(s.startedAt);
    const day = dayIndex(s.startedAt);
    const key = [
      'r',
      s.id,
      fingerprint(s),
      ctx.tl.sessions.until(ms(s.endedAt)),
      ctx.tl.checkins.until(t),
      ctx.tl.biometrics.until(day),
    ].join(':');
    const rec = ctx.memo.get<CaseRecord | false>(key, () => {
      const before = sorted.filter((x) => x !== s && ms(x.endedAt) <= t);
      if (!before.length) return false;
      const past = checkins.filter((c) => ms(c.at) <= t);
      const moves = s.movements.map((m) => m.movementId);
      const r = readinessV2(before, past, new Date(t), {
        biometrics: biometricsUntil(biometrics, day),
        nextMovements: moves,
      });
      return {
        sessionId: s.id,
        at: s.startedAt,
        p: r.predictive,
        level: r.level,
        expMean: r.expected.mean,
        expSd: r.expected.sd,
        informed: r.informed,
        y: ys.get(s.id) ?? null,
        context: decisionContext(r, before, past, moves, new Date(t)),
      };
    });
    if (rec) out.push(rec);
  }
  return out.reverse();
}

export function readinessForecasts(cases: CaseRecord[]): {
  forecasts: Forecast[];
  intervals: IntervalForecast[];
} {
  const forecasts: Forecast[] = [];
  const intervals: IntervalForecast[] = [];
  for (const c of cases) {
    // Without observations the forecast is the prior; scoring it says nothing.
    if (c.y === null || !c.informed) continue;
    forecasts.push({
      at: c.at,
      p: c.p,
      outcome: c.y - c.level >= -READINESS_SWC ? 1 : 0,
    });
    intervals.push({ at: c.at, mean: c.expMean, sd: c.expSd, y: c.y - c.level });
  }
  return { forecasts, intervals };
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
): { forecasts: Forecast[]; intervals: IntervalForecast[] } {
  return readinessForecasts(replayCases(sessions, checkins, biometrics));
}

/**
 * The load decision's probability of completing the target at the load the
 * person actually used, from the previous exposure only. One linear pass,
 * so it always covers the whole history.
 */
export function replayLoads(sessions: SessionLog[]): Forecast[] {
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
        // Only the last few exposures shape the SD; keep the list short.
        caps.set(m.movementId, [...history.slice(-8), best]);
      }
    }
  }
  return out;
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
  ctx: ReplayContext = freshContext(sessions, []),
  max = REPLAY_MAX,
): Forecast[] {
  const outs = outings(sessions);
  const out: Forecast[] = [];
  const from = Math.max(0, outs.length - max);
  for (let i = outs.length - 1; i >= from; i--) {
    const s = outs[i];
    const t = ms(s.endedAt);
    const next = outs[i + 1];
    const returned = next ? ms(next.startedAt) - t <= 7 * DAY_MS : false;
    // Unresolved until the person trains again or the week runs out.
    if (!returned && now.getTime() - t < 7 * DAY_MS) continue;
    const key = ['a', s.id, ctx.tl.sessions.until(t), daysPerWeek].join(':');
    const v = ctx.memo.get<CachedForecast | false>(key, () => {
      const a = adherence(outs.slice(0, i + 1), new Date(t), daysPerWeek);
      return a ? { at: s.endedAt, p: a.within7, outcome: returned ? 1 : 0 } : false;
    });
    if (!v) continue;
    out.push({ at: s.endedAt, p: v.p, outcome: returned ? 1 : 0 });
  }
  return out.reverse();
}

function painStarts(checkins: CheckIn[], experiments: Experiment[]): number[] {
  const reports = [
    ...checkins.filter((c) => c.pain).map((c) => ms(c.at)),
    ...experiments
      .filter((e) => e.answers?.feel === 'pain' && e.closedAt)
      .map((e) => ms(e.closedAt!)),
  ].sort((a, b) => a - b);
  // A report starts a new episode when the previous one is > 7 days old.
  return reports.filter((t, i) => i === 0 || t - reports[i - 1] > 7 * DAY_MS);
}

/** P(a new pain episode within 14 days), at most once a week. */
export function replayPain(
  sessions: SessionLog[],
  checkins: CheckIn[],
  experiments: Experiment[],
  now: Date,
  ctx: ReplayContext = freshContext(sessions, checkins, experiments),
  max = REPLAY_MAX,
): Forecast[] {
  const starts = painStarts(checkins, experiments);
  if (!starts.length) return [];
  const points = spaced(
    outings(sessions).map((s) => ({ s, t: ms(s.endedAt) })),
    WINDOW_SPACING_DAYS,
  ).slice(-max);
  const out: Forecast[] = [];
  for (const { s, t } of points) {
    if (now.getTime() - t < 14 * DAY_MS) continue;
    const key = ['p', s.id, ctx.tl.checkins.until(t), ctx.tl.experiments.until(t)].join(':');
    const hit = starts.some((x) => x > t && x <= t + 14 * DAY_MS);
    const v = ctx.memo.get<CachedForecast | false>(key, () => {
      const r = painRecurrence(
        checkins.filter((c) => ms(c.at) <= t),
        experiments.filter((e) => !e.closedAt || ms(e.closedAt) <= t),
        new Date(t),
      );
      // Before any pain there is no model; during an episode it is not a forecast.
      return !r || r.active ? false : { at: s.endedAt, p: r.risk14, outcome: hit ? 1 : 0 };
    });
    if (!v) continue;
    out.push({ at: s.endedAt, p: v.p, outcome: hit ? 1 : 0 });
  }
  return out;
}

export interface CalibrationInput {
  sessions: SessionLog[];
  checkins: CheckIn[];
  experiments: Experiment[];
  biometrics?: Biometrics | null;
  daysPerWeek?: number;
  now?: Date;
}

/** Recency weights: everything counts, the recent past counts more. */
const weighted = (fs: Forecast[], now: number): Forecast[] =>
  fs.map((f) => ({ ...f, w: (f.w ?? 1) * decay(now - ms(f.at)) }));

export interface CalibrationRun {
  set: CalibrationSet;
  /** The window's forecasts, for folding into the archive later. */
  window: { readiness: Forecast[]; adherence: Forecast[]; pain: Forecast[] };
}

/** The engine's track record, one report per perspective's forecast. */
export function calibrate(
  input: CalibrationInput,
  opts: { cases?: CaseRecord[]; ctx?: ReplayContext; archive?: Archive | null } = {},
): CalibrationRun {
  const now = input.now ?? new Date();
  const t = now.getTime();
  const ctx =
    opts.ctx ?? freshContext(input.sessions, input.checkins, input.experiments, input.biometrics);
  const cases = opts.cases ?? replayCases(input.sessions, input.checkins, input.biometrics, ctx);
  const r = readinessForecasts(cases);
  const adh = replayAdherence(input.sessions, now, input.daysPerWeek ?? 3, ctx);
  const pain = replayPain(input.sessions, input.checkins, input.experiments, now, ctx);
  const a = opts.archive;
  const withPast = (fs: Forecast[], fam?: Archive['readiness']) => [
    ...(fam ? archivedForecasts(fam, t) : []),
    ...weighted(fs, t),
  ];
  return {
    set: {
      readiness: calibrationReport(withPast(r.forecasts, a?.readiness)),
      performance: intervalReport(r.intervals),
      load: calibrationReport(weighted(replayLoads(input.sessions), t)),
      adherence: calibrationReport(withPast(adh, a?.adherence)),
      pain: calibrationReport(withPast(pain, a?.pain)),
      at: now.toISOString(),
    },
    window: { readiness: r.forecasts, adherence: adh, pain },
  };
}
