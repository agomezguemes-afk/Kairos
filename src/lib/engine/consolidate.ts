// Background consolidation: the engine "thinks while you rest". A pure pass
// over everything recorded that leaves the next session ready:
//   · advances or closes silent n-of-1 trials and patches the plan,
//   · starts a new trial when a movement has enough history,
//   · forecasts readiness for the next session and trims it if needed,
//   · refreshes adherence and pain-recurrence risk for the proposals.
// It runs after each session or check-in and whenever the app wakes after
// a few hours; nothing here asks the user anything.

import type { CheckIn } from '../adaptive/checkins';
import type { Experiment } from '../adaptive/experiments';
import { getMovement } from '../adaptive/catalog';
import type { DraftSession, MovementTarget, PlanDraft, SessionLog } from '../adaptive/types';
import {
  applyDose,
  reviewBlock,
  weekAt,
  weekNote,
  type Block,
  type WeekDose,
  type WeekPhase,
} from './block';
import { readinessV2, READINESS_SWC, type ReadinessV2 } from './readiness';
import type { Biometrics } from './biometrics';
import {
  adherence,
  painActiveAt,
  painRecurrence,
  type Adherence,
  type PainRecurrence,
} from './survival';
import {
  calibrate,
  REPLAY_MAX,
  replayCases,
  timelines,
  type CachedForecast,
  type CalibrationSet,
  type CaseRecord,
} from './backtest';
import { buildEpisodes, type Advice, type Episode } from './memory';
import { Memo, type EngineCache } from './cache';
import {
  emptyArchive,
  foldEpisodes,
  foldForecasts,
  prototypeEpisodes,
  type Archive,
} from './archive';
import { expertPanel, type LensId, type Stance } from './lenses';
import {
  analyseTrial,
  createTrial,
  nextCondition,
  TRIAL_TEMPLATES,
  trialPoints,
  winnerPatch,
  type Trial,
} from './trial';

export interface DayPlan {
  draftSessionId: string;
  /** When the forecast is for (ISO). */
  forDate: string;
  band: 'go' | 'easy' | 'rest';
  probability: number;
  /** One set fewer per strength movement. */
  trimSets: boolean;
  /** One plain line shown in the session, or nothing on a normal day. */
  note?: string;
  /** The perspective that decided the day (lenses.ts). */
  lead?: LensId;
  stance?: Stance;
  /** The block week in force: its dose shapes every session that week. */
  phase?: WeekPhase;
  dose?: WeekDose;
}

export interface Signals {
  adherence: Adherence | null;
  pain: PainRecurrence | null;
}

export interface ConsolidationInput {
  plan: PlanDraft | null;
  sessions: SessionLog[];
  checkins: CheckIn[];
  experiments: Experiment[];
  trials: Trial[];
  daysPerWeek?: number;
  /** Watch-measured sleep, HRV and resting HR, when connected. */
  biometrics?: Biometrics | null;
  /** What the engine advised for each saved session (the decision journal). */
  advice?: Advice[];
  /** Work done in earlier passes (cache.ts). */
  cache?: EngineCache | null;
  /** The compressed long-term past (archive.ts). */
  archive?: Archive | null;
  /** The training block in force (block.ts). */
  block?: Block | null;
  /** Fresh past-session computations allowed this pass. */
  budget?: number;
  /** Time allowed for fresh computations this pass (ms). */
  budgetMs?: number;
  now?: Date;
}

export interface Consolidation {
  plan: PlanDraft | null;
  trials: Trial[];
  dayPlan: DayPlan | null;
  signals: Signals;
  /** The engine's track record per forecast family. */
  calibration: CalibrationSet;
  /** Remembered sessions with context, action and outcome. */
  memory: Episode[];
  cache: EngineCache;
  archive: Archive;
  block: Block | null;
  /** True when part of the past is still to be distilled: run another pass soon. */
  pending: boolean;
  at: string;
}

/**
 * Fresh computations per pass. Enough for any normal day (one or two new
 * sessions); a cold start spreads over a few passes instead of one long one.
 */
export const PASS_BUDGET = 24;

/** Exposures a movement needs before a trial on it is worth running. */
const TRIAL_MIN_HISTORY = 3;

/** The accepted session done least often, first by slot: what "start" opens. */
export function nextDraftSession(
  plan: PlanDraft | null,
  sessions: SessionLog[],
): DraftSession | null {
  const kept = plan?.sessions.filter((s) => s.status === 'accepted') ?? [];
  if (!kept.length) return null;
  const done = (id: string) => sessions.filter((s) => s.draftSessionId === id).length;
  return [...kept].sort((a, b) => done(a.id) - done(b.id) || a.slot - b.slot)[0];
}

function patchMovement(
  plan: PlanDraft,
  movementId: string,
  patch: Partial<MovementTarget>,
  draftSessionId?: string,
): PlanDraft {
  return {
    ...plan,
    sessions: plan.sessions.map((ds) =>
      draftSessionId && ds.id !== draftSessionId
        ? ds
        : {
            ...ds,
            movements: ds.movements.map((pm) =>
              pm.movementId === movementId ? { ...pm, target: { ...pm.target, ...patch } } : pm,
            ),
          },
    ),
  };
}

function inPlan(plan: PlanDraft, movementId: string, draftSessionId?: string): boolean {
  return plan.sessions.some(
    (ds) =>
      ds.status === 'accepted' &&
      (!draftSessionId || ds.id === draftSessionId) &&
      ds.movements.some((pm) => pm.movementId === movementId),
  );
}

function stepTrials(
  plan: PlanDraft | null,
  trials: Trial[],
  sessions: SessionLog[],
  checkins: CheckIn[],
  now: Date,
): { plan: PlanDraft | null; trials: Trial[] } {
  let p = plan;
  const out = trials.map((t) => {
    if (t.status !== 'running') return t;
    if (!p || !inPlan(p, t.movementId, t.draftSessionId))
      return { ...t, status: 'stopped' as const, closedAt: now.toISOString() };
    const next = nextCondition(t, sessions);
    const result = analyseTrial(trialPoints(t, sessions, checkins), { complete: next === null });
    if (result.decided) {
      const closed: Trial = { ...t, status: 'done', result, closedAt: now.toISOString() };
      p = patchMovement(p, t.movementId, winnerPatch(closed), t.draftSessionId);
      return closed;
    }
    const tpl = TRIAL_TEMPLATES[t.template];
    p = patchMovement(p, t.movementId, (next === 'B' ? tpl.B : tpl.A).patch, t.draftSessionId);
    return { ...t, result };
  });
  return { plan: p, trials: out };
}

/** One trial at a time, on the most-trained strength movement with history. */
function maybeStartTrial(
  plan: PlanDraft | null,
  trials: Trial[],
  sessions: SessionLog[],
  experiments: Experiment[],
  now: Date,
): { plan: PlanDraft | null; trials: Trial[] } {
  if (!plan || trials.some((t) => t.status === 'running')) return { plan, trials };
  const busy = new Set(
    experiments
      .filter((e) => e.status === 'running' || e.status === 'review')
      .map((e) => e.movementId),
  );
  const tried = new Set(trials.map((t) => `${t.template}:${t.movementId}`));
  const count = (id: string) =>
    sessions.filter((s) =>
      s.movements.some((m) => m.movementId === id && m.sets.some((x) => x.completed)),
    ).length;
  const candidates: { ds: DraftSession; movementId: string; n: number }[] = [];
  for (const ds of plan.sessions) {
    if (ds.status !== 'accepted') continue;
    for (const pm of ds.movements) {
      const m = getMovement(pm.movementId);
      if (m?.kind !== 'strength' || !pm.target.loadKg) continue;
      if (busy.has(m.id) || tried.has(`rest:${m.id}`)) continue;
      const n = count(m.id);
      if (n >= TRIAL_MIN_HISTORY) candidates.push({ ds, movementId: m.id, n });
    }
  }
  if (!candidates.length) return { plan, trials };
  const pick = candidates.sort((a, b) => b.n - a.n)[0];
  const trial = createTrial('rest', pick.movementId, now, pick.ds.id);
  const tpl = TRIAL_TEMPLATES.rest;
  const first = trial.schedule[0] === 'B' ? tpl.B : tpl.A;
  return {
    plan: patchMovement(plan, pick.movementId, first.patch, pick.ds.id),
    trials: [...trials, trial],
  };
}

/**
 * When the next session will probably happen: now during the day; 9:00
 * the next morning in the evening; 9:00 today when the engine runs at
 * night (the OS wakes it while the phone charges).
 */
export function forecastDate(now: Date): Date {
  const h = now.getHours();
  if (h >= 7 && h < 18) return now;
  const d = new Date(now);
  if (h >= 18) d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Context the panel reads besides readiness. */
export interface PanelContext {
  adherence?: Adherence | null;
  calibration?: CalibrationSet | null;
  memory?: Episode[] | null;
  /** The current training block (block.ts). */
  block?: Block | null;
  /** Readiness already computed for this moment, to avoid redoing it. */
  readiness?: ReadinessV2;
}

/** The expert panel's plan for one draft session at one moment. */
export function dayPlanAt(
  next: DraftSession,
  sessions: SessionLog[],
  checkins: CheckIn[],
  pain: PainRecurrence | null,
  when: Date,
  biometrics?: Biometrics | null,
  ctx: PanelContext = {},
): DayPlan {
  const nextMovements = next.movements.map((m) => m.movementId);
  const r = ctx.readiness ?? readinessV2(sessions, checkins, when, { biometrics, nextMovements });
  const painNow = painActiveAt(pain, checkins, when);
  const panel = expertPanel({
    readiness: r,
    sessions,
    nextMovements,
    adherence: ctx.adherence ?? null,
    pain,
    painNow,
    calibration: ctx.calibration,
    memory: ctx.memory ?? [],
    checkins,
    now: when,
  });
  const p = panel.lenses.find((l) => l.id === 'physiology')?.forecast?.p ?? r.probability;
  const { band, note, lead, stance } = panel.verdict;
  const week = weekAt(ctx.block, when);
  return {
    draftSessionId: next.id,
    forDate: when.toISOString(),
    band,
    probability: painNow ? Math.min(p, 0.35) : p,
    trimSets: band !== 'go',
    // Today's call first; on an ordinary day, what the week is about.
    note: note ?? weekNote(week?.phase),
    lead,
    stance,
    ...(week ? { phase: week.phase, dose: week.dose } : {}),
  };
}

/** A pre-planned forecast is used only near the moment it was made for. */
const PLAN_VALID_MS = 6 * 3_600_000;

/**
 * The adjustment for a session starting now: the background plan when it
 * was made for this session and this moment, a fresh forecast otherwise
 * (an evening session after the engine already planned for tomorrow).
 */
export function sessionAdjustment(
  dayPlan: DayPlan | null,
  draft: DraftSession,
  sessions: SessionLog[],
  checkins: CheckIn[],
  experiments: Experiment[],
  now: Date = new Date(),
  biometrics?: Biometrics | null,
  ctx: PanelContext = {},
): DayPlan {
  if (
    dayPlan &&
    dayPlan.draftSessionId === draft.id &&
    Math.abs(now.getTime() - new Date(dayPlan.forDate).getTime()) <= PLAN_VALID_MS
  )
    return dayPlan;
  return dayPlanAt(
    draft,
    sessions,
    checkins,
    painRecurrence(checkins, experiments, now),
    now,
    biometrics,
    ctx,
  );
}

export function consolidate(input: ConsolidationInput): Consolidation {
  const now = input.now ?? new Date();
  const t = now.getTime();
  const { sessions, checkins, experiments } = input;
  const stepped = stepTrials(input.plan, input.trials, sessions, checkins, now);
  // A light week would confound a trial's comparison: start new ones only in loading weeks.
  const phase = weekAt(input.block, now)?.phase;
  const started =
    !phase || phase === 'build' || phase === 'push'
      ? maybeStartTrial(stepped.plan, stepped.trials, sessions, experiments, now)
      : stepped;
  const pain = painRecurrence(checkins, experiments, now);
  const signals = { adherence: adherence(sessions, now, input.daysPerWeek ?? 3), pain };

  // The past is distilled once and reused; only what is new or changed is computed.
  const ctx = {
    memo: new Memo(input.cache, input.budget ?? PASS_BUDGET, input.budgetMs),
    tl: timelines(sessions, checkins, experiments, input.biometrics),
  };
  const cases = replayCases(sessions, checkins, input.biometrics, ctx);
  // Every forecast family is judged against what happened before it is trusted today.
  const run = calibrate(
    {
      sessions,
      checkins,
      experiments,
      biometrics: input.biometrics,
      daysPerWeek: input.daysPerWeek,
      now,
    },
    { cases, ctx, archive: input.archive },
  );
  const archive = foldEvicted(input.archive ?? emptyArchive(), ctx.memo.evicted(), {
    sessions,
    checkins,
    advice: input.advice ?? [],
    now,
  });
  const recent = buildEpisodes(cases, sessions, checkins, input.advice ?? [], now);
  const memory = [...prototypeEpisodes(archive.prototypes, t), ...recent];

  // The weeks ahead, reviewed against how the person is absorbing them.
  const next = nextDraftSession(started.plan, sessions);
  const when = forecastDate(now);
  const readiness = next
    ? readinessV2(sessions, checkins, when, {
        biometrics: input.biometrics,
        nextMovements: next.movements.map((m) => m.movementId),
      })
    : null;
  const block =
    started.plan && readiness
      ? reviewBlock(input.block, {
          readiness,
          cases,
          sessions,
          painNow: painActiveAt(pain, checkins, now),
          painRisk: pain?.risk14 ?? null,
          plan: started.plan,
          now,
        })
      : (input.block ?? null);
  return {
    plan: started.plan,
    trials: started.trials,
    dayPlan: next
      ? dayPlanAt(next, sessions, checkins, pain, when, input.biometrics, {
          adherence: signals.adherence,
          calibration: run.set,
          memory,
          block,
          readiness: readiness ?? undefined,
        })
      : null,
    block,
    signals,
    calibration: run.set,
    memory,
    cache: ctx.memo.snapshot(),
    archive,
    pending: ctx.memo.pending,
    at: now.toISOString(),
  };
}

/**
 * Entries the pass no longer used are either stale (their inputs changed:
 * recomputed elsewhere, dropped here) or older than the detailed window:
 * those are folded into the archive so they keep counting.
 */
function foldEvicted(
  archive: Archive,
  evicted: [string, unknown][],
  data: { sessions: SessionLog[]; checkins: CheckIn[]; advice: Advice[]; now: Date },
): Archive {
  const sorted = [...data.sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  if (sorted.length <= REPLAY_MAX) return archive;
  const cutoff = new Date(sorted[sorted.length - REPLAY_MAX].startedAt).getTime();
  const old = (at: string) => new Date(at).getTime() < cutoff;
  const t = data.now.getTime();
  const cases: CaseRecord[] = [];
  const adh: CachedForecast[] = [];
  const pains: CachedForecast[] = [];
  for (const [key, value] of evicted) {
    if (!value) continue;
    const kind = key.slice(0, 2);
    if (kind === 'r:' && old((value as CaseRecord).at)) cases.push(value as CaseRecord);
    else if (kind === 'a:' && old((value as CachedForecast).at)) adh.push(value as CachedForecast);
    else if (kind === 'p:' && old((value as CachedForecast).at))
      pains.push(value as CachedForecast);
  }
  if (!cases.length && !adh.length && !pains.length) return archive;
  const byAt = <T extends { at: string }>(xs: T[]) => xs.sort((a, b) => a.at.localeCompare(b.at));
  const readiness = byAt(cases)
    .filter((c) => c.y !== null && c.informed)
    .map((c) => ({ at: c.at, p: c.p, outcome: c.y! - c.level >= -READINESS_SWC ? 1 : 0 }));
  const folded = foldEpisodes(
    archive.prototypes,
    buildEpisodes(cases, data.sessions, data.checkins, data.advice, data.now),
    archive.episodesUntil,
    t,
  );
  return {
    readiness: foldForecasts(archive.readiness, readiness, t),
    adherence: foldForecasts(archive.adherence, byAt(adh), t),
    pain: foldForecasts(archive.pain, byAt(pains), t),
    prototypes: folded.prototypes,
    episodesUntil: folded.until,
  };
}

/** Trim one set per strength movement (never below 2) for a light day. */
export function trimTargets(ds: DraftSession): DraftSession {
  return {
    ...ds,
    movements: ds.movements.map((pm) =>
      getMovement(pm.movementId)?.kind === 'strength' && (pm.target.sets ?? 3) > 2
        ? { ...pm, target: { ...pm.target, sets: (pm.target.sets ?? 3) - 1 } }
        : pm,
    ),
  };
}

/**
 * A planned session as it should be done: the block week's dose, then the
 * day's trim. `today` = the session the day plan was made for.
 */
export function shapeSession(ds: DraftSession, day: DayPlan | null, today = true): DraftSession {
  const dosed = applyDose(ds, day?.dose);
  return today && day?.trimSets ? trimTargets(dosed) : dosed;
}
