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
import { readinessV2 } from './readiness';
import type { Biometrics } from './biometrics';
import { adherence, painRecurrence, type Adherence, type PainRecurrence } from './survival';
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
  now?: Date;
}

export interface Consolidation {
  plan: PlanDraft | null;
  trials: Trial[];
  dayPlan: DayPlan | null;
  signals: Signals;
  at: string;
}

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

/** Readiness-based plan for one draft session at one moment. */
export function dayPlanAt(
  next: DraftSession,
  sessions: SessionLog[],
  checkins: CheckIn[],
  pain: PainRecurrence | null,
  when: Date,
  biometrics?: Biometrics | null,
): DayPlan {
  const r = readinessV2(sessions, checkins, when, {
    biometrics,
    nextMovements: next.movements.map((m) => m.movementId),
  });
  const pct = Math.round(r.probability * 100);
  let note: string | undefined;
  if (r.band === 'rest')
    note = pain?.active
      ? 'Has marcado dolor hace poco: hoy, solo movilidad o descanso.'
      : `Mejor descansar: tu disposición estimada es ${pct} %. Si entrenas, versión ligera.`;
  else if (r.band === 'easy')
    note = `Versión ligera: una serie menos por ejercicio. Disposición estimada ${pct} %.`;
  return {
    draftSessionId: next.id,
    forDate: when.toISOString(),
    band: r.band,
    probability: r.probability,
    trimSets: r.band !== 'go',
    note,
  };
}

function dayPlanFor(
  plan: PlanDraft | null,
  sessions: SessionLog[],
  checkins: CheckIn[],
  pain: PainRecurrence | null,
  now: Date,
  biometrics?: Biometrics | null,
): DayPlan | null {
  const next = nextDraftSession(plan, sessions);
  return next ? dayPlanAt(next, sessions, checkins, pain, forecastDate(now), biometrics) : null;
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
  );
}

export function consolidate(input: ConsolidationInput): Consolidation {
  const now = input.now ?? new Date();
  const { sessions, checkins, experiments } = input;
  const stepped = stepTrials(input.plan, input.trials, sessions, checkins, now);
  const started = maybeStartTrial(stepped.plan, stepped.trials, sessions, experiments, now);
  const pain = painRecurrence(checkins, experiments, now);
  return {
    plan: started.plan,
    trials: started.trials,
    dayPlan: dayPlanFor(started.plan, sessions, checkins, pain, now, input.biometrics),
    signals: { adherence: adherence(sessions, now, input.daysPerWeek ?? 3), pain },
    at: now.toISOString(),
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
