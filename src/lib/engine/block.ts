// Block planning: the engine thinks in weeks, not only in days. A coach
// lays out the next few weeks (load builds up, then a lighter week lets
// it turn into fitness), points them at a date when there is one, and
// re-plans when reality drifts: an early deload when fatigue piles up, an
// extra loading week when the person is absorbing it well. Every change
// is recorded with its reason.
// Spec: ENGINE-v2.md §Planificación por bloques.

import { getMovement } from '../adaptive/catalog';
import { bestSetE1rm, loadTrend } from '../adaptive/metrics';
import type { DraftSession, PlanDraft, SessionLog } from '../adaptive/types';
import type { CaseRecord } from './backtest';
import { increments, isPlateau, progressionState } from './changepoint';
import type { ReadinessV2 } from './readiness';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * build/push: loading weeks (push = the last, hardest one). deload: volume
 * down ~40 %, load kept. taper/peak: the run-in to a dated event.
 */
export type WeekPhase = 'build' | 'push' | 'deload' | 'taper' | 'peak';

/** Accumulation (more sets) or intensification (closer to failure). */
export type Emphasis = 'volume' | 'intensity';

export interface WeekDose {
  /** Multiplies strength sets (rounded, never below 2). */
  setsFactor: number;
  /** Added to strength sets after the factor. */
  setsDelta: number;
  /** Added to the reps-in-reserve target (floored at 1). */
  rirDelta: number;
  /** Multiplies endurance minutes, distance and interval reps. */
  enduranceFactor: number;
}

export interface BlockWeek {
  phase: WeekPhase;
  dose: WeekDose;
}

export interface BlockChange {
  at: string;
  week: number;
  from: WeekPhase;
  to: WeekPhase;
  reason: string;
}

export interface Block {
  id: string;
  planId: string;
  emphasis: Emphasis;
  /** Week 0 starts here (ISO, start of that day). */
  startedAt: string;
  weeks: BlockWeek[];
  /** A dated goal (race, match, test): the block runs in to it. */
  eventAt?: string;
  /** Highest week already reviewed at its start: decisions don't flip-flop. */
  reviewedWeek: number;
  changes: BlockChange[];
  /** Blocks completed before this one under the same plan. */
  sequence: number;
}

/**
 * Doses. Loading weeks ramp volume or proximity to failure (RIR-based
 * progression, Helms 2016; endurance volume ≤ +10–15 %/week). Deload and
 * taper cut volume ~40–50 % and keep intensity (Bosquet 2007; Pritchard
 * 2015).
 */
const DOSE: Record<Emphasis, WeekDose[]> & Record<'deload' | 'taper' | 'peak', WeekDose> = {
  volume: [
    { setsFactor: 1, setsDelta: 0, rirDelta: 1, enduranceFactor: 1 },
    { setsFactor: 1, setsDelta: 1, rirDelta: 0, enduranceFactor: 1.1 },
    { setsFactor: 1, setsDelta: 1, rirDelta: -1, enduranceFactor: 1.15 },
  ],
  intensity: [
    { setsFactor: 1, setsDelta: 0, rirDelta: 0, enduranceFactor: 1 },
    { setsFactor: 1, setsDelta: 0, rirDelta: -1, enduranceFactor: 1.05 },
    { setsFactor: 0.85, setsDelta: 0, rirDelta: -1, enduranceFactor: 1.05 },
  ],
  deload: { setsFactor: 0.6, setsDelta: 0, rirDelta: 2, enduranceFactor: 0.6 },
  taper: { setsFactor: 0.6, setsDelta: 0, rirDelta: 1, enduranceFactor: 0.6 },
  peak: { setsFactor: 0.5, setsDelta: 0, rirDelta: 1, enduranceFactor: 0.5 },
};

/** Loading weeks before a deload by default (3:1). */
export const LOADING_WEEKS = 3;
/** Never more than this many loading weeks in a row, however fresh. */
export const MAX_LOADING_WEEKS = 5;
/** Below this many strength sessions, linear progression on volume still works. */
const NOVICE_SESSIONS = 24;

const EVENT_RE =
  /\b(carrera|competici|torneo|partido|marat|10 ?k|5 ?k|21 ?k|42 ?k|triatl|campeonat|prueba|race|match|tournament)/i;
const HORIZON_RE = /\b(\w+) (semanas?|weeks?|mes(?:es)?|months?)\b/i;

const loading = (i: number, emphasis: Emphasis): BlockWeek => {
  const doses = DOSE[emphasis];
  const k = Math.min(i, doses.length - 1);
  return { phase: k === doses.length - 1 ? 'push' : 'build', dose: doses[k] };
};
const deload = (): BlockWeek => ({ phase: 'deload', dose: DOSE.deload });

/** A dated goal: event words plus an explicit horizon ("10k en 8 semanas"). */
export function eventDate(plan: PlanDraft): string | undefined {
  const raw = plan.goal.raw;
  if (!EVENT_RE.test(raw) || !HORIZON_RE.test(raw)) return undefined;
  return new Date(
    new Date(plan.createdAt).getTime() + plan.goal.horizonWeeks * WEEK_MS,
  ).toISOString();
}

/**
 * Weeks from `start`. Without an event: loading weeks then a deload. With
 * one: 3:1 cycles that end in a taper week and the event week.
 */
export function layoutWeeks(start: number, emphasis: Emphasis, eventAt?: string): BlockWeek[] {
  if (eventAt) {
    const n = Math.ceil((new Date(eventAt).getTime() - start) / WEEK_MS);
    if (n >= 1) {
      const tail: BlockWeek[] =
        n >= 4
          ? [
              { phase: 'taper', dose: DOSE.taper },
              { phase: 'peak', dose: DOSE.peak },
            ]
          : [{ phase: 'peak', dose: DOSE.peak }];
      const lead = n - tail.length;
      const weeks: BlockWeek[] = [];
      let run = 0;
      for (let i = 0; i < lead; i++) {
        // A deload every fourth week, but never right before the taper.
        if (run === LOADING_WEEKS && i < lead - 1) {
          weeks.push(deload());
          run = 0;
        } else weeks.push(loading(run++, emphasis));
      }
      return [...weeks, ...tail];
    }
  }
  return [...Array.from({ length: LOADING_WEEKS }, (_, i) => loading(i, emphasis)), deload()];
}

const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function weekIndex(block: Block, now: Date): number {
  return Math.floor((now.getTime() - new Date(block.startedAt).getTime()) / WEEK_MS);
}

/** The week in force at `now`, if the block covers it. */
export function weekAt(
  block: Block | null | undefined,
  now: Date,
): (BlockWeek & { index: number }) | null {
  if (!block) return null;
  const i = weekIndex(block, now);
  return i >= 0 && i < block.weeks.length ? { ...block.weeks[i], index: i } : null;
}

// ── Signals the weekly review reads ─────────────────────────────────

export interface BlockSignals {
  readiness: ReadinessV2;
  /** Cases (readiness before each past session) from the replay. */
  cases: CaseRecord[];
  sessions: SessionLog[];
  painNow: boolean;
  painRisk: number | null;
  plan: PlanDraft;
  now: Date;
}

export interface FatigueRead {
  flags: string[];
  /** Mean readiness before the sessions of the last 10 days (null if < 2). */
  recentReadiness: number | null;
  plateauShare: number;
  strengthSessions: number;
}

/** Share of the plan's strength lifts that have stalled. */
function plateauShare(plan: PlanDraft, sessions: SessionLog[]): number {
  const ids = new Set(
    plan.sessions
      .filter((s) => s.status === 'accepted')
      .flatMap((s) => s.movements.map((m) => m.movementId))
      .filter((id) => getMovement(id)?.kind === 'strength'),
  );
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime(),
  );
  let tracked = 0;
  let stalled = 0;
  for (const id of ids) {
    const series = sorted
      .map((s) => s.movements.find((m) => m.movementId === id))
      .map((m) => (m ? bestSetE1rm(m.sets) : null))
      .filter((v): v is number => v !== null && v > 0)
      .slice(-12);
    if (series.length < 4) continue;
    tracked++;
    if (isPlateau(progressionState(increments(series)))) stalled++;
  }
  return tracked ? stalled / tracked : 0;
}

/**
 * What a coach looks at before deciding the week: is fatigue piling up,
 * is the person absorbing the load, has progress stalled.
 */
export function readFatigue(s: BlockSignals): FatigueRead {
  const t = s.now.getTime();
  const recent = s.cases.filter((c) => t - new Date(c.at).getTime() <= 10 * DAY_MS);
  const recentReadiness =
    recent.length >= 2 ? recent.reduce((a, c) => a + c.p, 0) / recent.length : null;
  const r = s.readiness;
  const trend = loadTrend(s.sessions, s.now);
  const flags: string[] = [];
  if (recentReadiness !== null && recentReadiness < 0.45)
    flags.push('disposición baja en las últimas sesiones');
  if (r.informed && r.form.mean < -2 && r.form.mean + r.form.sd < 0)
    flags.push('la fatiga supera a la forma');
  if (trend.band === 'spike') flags.push('pico de carga semanal');
  if (r.load.highStrain && (r.load.monotony ?? 0) > 2) flags.push('semana cargada y monótona');
  if (s.painNow || (s.painRisk ?? 0) >= 0.3) flags.push('dolor o riesgo alto de recaída');
  const share = plateauShare(s.plan, s.sessions);
  if (share >= 0.5) flags.push('la mayoría de ejercicios se ha estancado');
  const strengthSessions = s.sessions.filter((x) =>
    x.movements.some((m) => getMovement(m.movementId)?.kind === 'strength'),
  ).length;
  return { flags, recentReadiness, plateauShare: share, strengthSessions };
}

// ── The weekly review ───────────────────────────────────────────────

function change(b: Block, week: number, to: BlockWeek, reason: string, now: Date): Block {
  const from = b.weeks[week].phase;
  const weeks = [...b.weeks];
  weeks[week] = to;
  return {
    ...b,
    weeks,
    changes: [...b.changes, { at: now.toISOString(), week, from, to: to.phase, reason }].slice(-50),
  };
}

function newBlock(plan: PlanDraft, now: Date, prev: Block | null, fatigue: FatigueRead): Block {
  const eventAt = eventDate(plan);
  const samePlan = prev?.planId === plan.id;
  // Accumulation then intensification (Issurin 2008); novices stay on volume.
  const emphasis: Emphasis =
    !samePlan || fatigue.strengthSessions < NOVICE_SESSIONS
      ? 'volume'
      : prev.emphasis === 'volume'
        ? 'intensity'
        : 'volume';
  const start = dayStart(now.getTime());
  const live = eventAt && new Date(eventAt).getTime() > start ? eventAt : undefined;
  return {
    id: `block-${start}`,
    planId: plan.id,
    emphasis,
    startedAt: new Date(start).toISOString(),
    weeks: layoutWeeks(start, emphasis, live),
    eventAt: live,
    reviewedWeek: -1,
    changes: [],
    sequence: samePlan ? prev.sequence + 1 : 0,
  };
}

/**
 * One review per pass. Pure: the same block and data give the same block.
 * - New plan or block finished → lay out the next block.
 * - Any day of a loading week: two fatigue flags (or pain) → deload now.
 * - At the start of a planned deload: fully fresh → one more loading week.
 */
export function reviewBlock(prev: Block | null | undefined, s: BlockSignals): Block {
  const fatigue = readFatigue(s);
  let b =
    prev && prev.planId === s.plan.id && weekIndex(prev, s.now) < prev.weeks.length
      ? prev
      : newBlock(s.plan, s.now, prev ?? null, fatigue);
  const i = weekIndex(b, s.now);
  const week = b.weeks[i];
  if (!week) return b;
  const why = fatigue.flags.join(', ');
  const tissue = fatigue.flags.includes('dolor o riesgo alto de recaída');

  if ((week.phase === 'build' || week.phase === 'push') && (fatigue.flags.length >= 2 || tissue)) {
    b = change(b, i, deload(), `Descarga anticipada: ${why}.`, s.now);
    // After the deload, a fresh block starts the following week.
    b = { ...b, weeks: b.weeks.slice(0, i + 1) };
    if (b.eventAt) {
      const rest = layoutWeeks(
        new Date(b.startedAt).getTime() + (i + 1) * WEEK_MS,
        b.emphasis,
        b.eventAt,
      );
      b = { ...b, weeks: [...b.weeks, ...rest] };
    }
  } else if (week.phase === 'deload' && i > b.reviewedWeek && !b.eventAt) {
    const run = b.weeks.slice(0, i).filter((w) => w.phase === 'build' || w.phase === 'push').length;
    const fresh =
      fatigue.flags.length === 0 &&
      (fatigue.recentReadiness ?? 0) >= 0.7 &&
      fatigue.plateauShare < 0.5 &&
      s.readiness.form.mean >= 0;
    if (fresh && run < MAX_LOADING_WEEKS) {
      b = change(
        b,
        i,
        { phase: 'push', dose: DOSE[b.emphasis][DOSE[b.emphasis].length - 1] },
        'Una semana más de carga: estás asimilando bien.',
        s.now,
      );
      b = { ...b, weeks: [...b.weeks.slice(0, i + 1), deload()] };
    }
  }
  return { ...b, reviewedWeek: Math.max(b.reviewedWeek, i) };
}

// ── Applying a week to a session ────────────────────────────────────

/** The week's dose on a planned session; the plan itself is untouched. */
export function applyDose(ds: DraftSession, dose: WeekDose | null | undefined): DraftSession {
  if (!dose) return ds;
  return {
    ...ds,
    // Shorter on light weeks; loading weeks keep the planned length.
    durationMin: Math.max(
      10,
      Math.round(ds.durationMin * Math.min(1, Math.max(dose.setsFactor, dose.enduranceFactor))),
    ),
    movements: ds.movements.map((pm) => {
      const kind = getMovement(pm.movementId)?.kind;
      const t = pm.target;
      if (kind === 'strength') {
        const sets = Math.max(2, Math.round((t.sets ?? 3) * dose.setsFactor) + dose.setsDelta);
        const rir = Math.max(1, Math.min(4, (t.rir ?? 2) + dose.rirDelta));
        return { ...pm, target: { ...t, sets, rir } };
      }
      if (kind === 'steady' || kind === 'interval') {
        const f = dose.enduranceFactor;
        return {
          ...pm,
          target: {
            ...t,
            ...(t.durationMin ? { durationMin: Math.max(5, Math.round(t.durationMin * f)) } : {}),
            ...(t.distanceKm ? { distanceKm: Math.round(t.distanceKm * f * 10) / 10 } : {}),
            ...(t.intervals
              ? {
                  intervals: {
                    ...t.intervals,
                    reps: Math.max(2, Math.round(t.intervals.reps * f)),
                  },
                }
              : {}),
          },
        };
      }
      return pm;
    }),
  };
}

/** One plain line for weeks that change how sessions feel; none otherwise. */
export function weekNote(phase: WeekPhase | undefined): string | undefined {
  switch (phase) {
    case 'deload':
      return 'Semana de descarga: menos series, mismo peso.';
    case 'taper':
      return 'Afinando para tu prueba: menos volumen, misma intensidad.';
    case 'peak':
      return 'Semana de tu prueba: poco volumen, llega fresco.';
    default:
      return undefined;
  }
}
