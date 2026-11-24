// Coach store — goal, plan draft, logged sessions and suggestions for the
// adaptive coach. Persisted locally so nothing is lost offline; the
// engine in src/lib/adaptive does all the thinking, this only holds state.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import {
  applySuggestion,
  calibratePlan,
  draftPlan,
  generateSuggestions,
  isDueForReview,
  objectiveCheck,
  parseGoal,
  resolveExperiment,
  revertPatch,
  startExperiment,
  weeklySuggestions,
  type CheckIn,
  type DraftStatus,
  type Experiment,
  type ExperimentAnswers,
  type MovementTarget,
  type ParsedGoal,
  type PlanDraft,
  type SessionLog,
  type Suggestion,
} from '../lib/adaptive';
import {
  buildBioDays,
  consolidate as consolidatePass,
  dayIndex,
  mergeBioDays,
  painActiveAt,
  readinessV2,
  sessionAdjustment,
  type Advice,
  type Biometrics,
  type Episode,
  type DayPlan,
  type Signals,
  type Trial,
} from '../lib/engine';
import { estimateHrMax, mergeWatchWorkouts } from '../lib/health/workoutImport';
import type { HealthPull } from '../lib/health/appleHealth';
import { migrateCoachState } from './coachMigrate';
import type { ArmContext } from '../lib/engine/decision';
import type { CalibrationSet } from '../lib/engine/backtest';
import type { EngineCache } from '../lib/engine/cache';
import type { Archive } from '../lib/engine/archive';
import type { Block } from '../lib/engine/block';

// Writes are tracked so a background task can wait for them before the OS
// suspends the app; otherwise a night's consolidation could be lost.
let pendingWrite: Promise<void> = Promise.resolve();
const trackedStorage = {
  getItem: (k: string) => AsyncStorage.getItem(k),
  setItem: (k: string, v: string) => {
    const write = pendingWrite.then(() => AsyncStorage.setItem(k, v));
    // A failed write must not block the ones after it; persist still sees the error.
    pendingWrite = write.catch((e) => console.warn('[coach] persist write failed', e));
    return write;
  },
  removeItem: (k: string) => AsyncStorage.removeItem(k),
};

/** Resolves once every persisted write issued so far has reached disk. */
export function flushCoachStorage(): Promise<void> {
  return pendingWrite;
}

interface CoachState {
  goal: ParsedGoal | null;
  plan: PlanDraft | null;
  sessions: SessionLog[];
  suggestions: Suggestion[];
  experiments: Experiment[];
  checkins: CheckIn[];
  /** Silent n-of-1 trials the engine runs on the plan. */
  trials: Trial[];
  /** The next session as the engine pre-planned it while you rested. */
  dayPlan: DayPlan | null;
  /** Adherence and pain-recurrence risk from the last consolidation. */
  signals: Signals | null;
  /** How often each kind of forecast came true; corrects them before use. */
  calibration: CalibrationSet | null;
  /** What the engine advised for each saved session: the decision journal. */
  advice: Advice[];
  /** Sessions remembered as cases (context, action, outcome) for recall. */
  memory: Episode[];
  consolidatedAt: string | null;
  /** Past work the engine reuses between passes (never shown). */
  engineCache: EngineCache | null;
  /** The compressed long-term past: old sessions keep counting, with less weight. */
  archive: Archive | null;
  /** A pass left part of the past for later (not persisted). */
  enginePending: boolean;
  /** The training block the engine is running: the weeks ahead and why they changed. */
  block: Block | null;
  /** Watch-measured sleep, HRV and resting HR, one row per day. */
  biometrics: Biometrics | null;
  health: HealthLink;

  /** `goal` is the (possibly AI-refined) interpretation; rules parse otherwise. */
  draftFromGoal: (text: string, goal?: ParsedGoal) => PlanDraft;
  setDraftStatus: (draftSessionId: string, status: DraftStatus) => void;
  /** Saves a finished session, calibrates the plan, returns new suggestions. */
  recordSession: (log: SessionLog) => Suggestion[];
  revealSuggestion: (id: string) => void;
  resolveSuggestion: (
    id: string,
    outcome: 'accepted' | 'adjusted' | 'dismissed',
    override?: Partial<MovementTarget>,
  ) => void;
  /** Saves a check-in; a weekly one may produce proposals on its own. */
  submitCheckIn: (c: CheckIn) => Suggestion[];
  /** Closes an experiment in review: keeps the change or reverts the plan. */
  reviewExperiment: (id: string, answers: ExperimentAnswers) => Experiment | null;
  /** Background pass: steps trials, pre-plans the next session, refreshes risks. */
  /** `background`: no time budget (the OS task has time; the UI is not waiting). */
  consolidate: (now?: Date, opts?: { background?: boolean }) => void;
  setHealthConnected: (connected: boolean) => void;
  /** Merges a HealthKit pull: watch workouts become sessions, biometrics refresh. */
  ingestHealth: (pull: HealthPull, now?: Date) => { added: number; enriched: number };
  setHealthError: (error: string | null) => void;
  reset: () => void;
}

export interface HealthLink {
  connected: boolean;
  /** HealthKit anchor: the next workout query continues from here. */
  anchor?: string;
  lastSyncAt?: string;
  /** Watch workouts imported so far. */
  imported: number;
  lastError?: string | null;
}

const initial = {
  goal: null,
  plan: null,
  sessions: [],
  suggestions: [],
  experiments: [],
  checkins: [],
  trials: [],
  dayPlan: null,
  signals: null,
  calibration: null as CalibrationSet | null,
  advice: [] as Advice[],
  memory: [] as Episode[],
  consolidatedAt: null,
  engineCache: null as EngineCache | null,
  archive: null as Archive | null,
  enginePending: false,
  block: null as Block | null,
  biometrics: null,
  health: { connected: false, imported: 0 } as HealthLink,
};

const PENDING_DELAY_MS = 400;
const FOREGROUND_BUDGET_MS = 50;

let soonTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Runs a pass after the current interaction finishes (tap feedback,
 * navigation, animations), coalescing bursts of changes into one pass.
 * Saving a session or a check-in returns at once; the plan follows.
 */
export function consolidateSoon(delayMs = 0): void {
  if (soonTimer) return;
  soonTimer = setTimeout(() => {
    InteractionManager.runAfterInteractions(() => {
      soonTimer = null;
      useCoachStore.getState().consolidate();
    });
  }, delayMs);
}

/** Journal entries kept: older advice no longer describes this engine. */
const ADVICE_MAX = 300;

/**
 * What the engine advised for a session, reconstructed exactly as the live
 * screen got it (same function, same inputs, at the session's start).
 */
function journal(s: CoachState, log: SessionLog): Advice[] {
  const draft = s.plan?.sessions.find((d) => d.id === log.draftSessionId);
  if (!draft || s.advice.some((a) => a.sessionId === log.id)) return s.advice;
  const adj = sessionAdjustment(
    s.dayPlan,
    draft,
    s.sessions,
    s.checkins,
    s.experiments,
    new Date(log.startedAt),
    s.biometrics,
    {
      adherence: s.signals?.adherence,
      calibration: s.calibration,
      memory: s.memory,
      block: s.block,
    },
  );
  const entry: Advice = {
    sessionId: log.id,
    at: log.startedAt,
    band: adj.band,
    stance: adj.stance,
    lead: adj.lead,
    note: adj.note,
  };
  return [...s.advice, entry].slice(-ADVICE_MAX);
}

/** The value the user settled on when adjusting, for the experiment target. */
function adjustedValue(o?: Partial<MovementTarget>): number | undefined {
  return o?.loadKg ?? o?.durationMin ?? o?.distanceKm ?? o?.sets ?? o?.intervals?.reps;
}

/** Today's context for contextual learning: readiness band + sleep debt. */
function contextNow(
  sessions: SessionLog[],
  checkins: CheckIn[],
  biometrics?: Biometrics | null,
): ArmContext {
  const r = readinessV2(sessions, checkins, new Date(), { biometrics });
  return { band: r.band, debtHigh: r.sleep.hours >= 2 };
}

/** Running experiments whose review window has opened move to 'review'. */
function promote(experiments: Experiment[], sessions: SessionLog[], now: Date): Experiment[] {
  return experiments.map((e) =>
    isDueForReview(e, sessions, now) ? { ...e, status: 'review' as const } : e,
  );
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      ...initial,

      draftFromGoal: (text, refined) => {
        const goal = refined ?? parseGoal(text);
        const plan = draftPlan(goal);
        set({ goal, plan });
        return plan;
      },

      setDraftStatus: (draftSessionId, status) => {
        const { plan } = get();
        if (!plan) return;
        set({
          plan: {
            ...plan,
            sessions: plan.sessions.map((s) => (s.id === draftSessionId ? { ...s, status } : s)),
          },
        });
        consolidateSoon();
      },

      recordSession: (log) => {
        const { sessions, plan, goal, suggestions, experiments, checkins } = get();
        const fresh = generateSuggestions({
          session: log,
          history: sessions,
          goal: goal ?? undefined,
          plan: plan ?? undefined,
          experiments,
          context: contextNow(sessions, checkins, get().biometrics),
          painRisk: get().signals?.pain?.risk14,
          painNow: painActiveAt(get().signals?.pain, checkins, new Date()),
          loadCalibration: get().calibration?.load.fit,
        });
        // Re-running on the same session must not duplicate cards.
        const known = new Set(suggestions.map((s) => s.id));
        const all = [...sessions, log];
        set({
          advice: journal(get(), log),
          sessions: all,
          plan: plan ? calibratePlan(plan, log) : plan,
          suggestions: [...suggestions, ...fresh.filter((s) => !known.has(s.id))],
          experiments: promote(experiments, all, new Date()),
        });
        consolidateSoon();
        return fresh;
      },

      revealSuggestion: (id) =>
        set({
          suggestions: get().suggestions.map((s) =>
            s.id === id && s.status === 'locked' ? { ...s, status: 'revealed' } : s,
          ),
        }),

      resolveSuggestion: (id, outcome, override) => {
        const { suggestions, plan, experiments, sessions, checkins } = get();
        const s = suggestions.find((x) => x.id === id);
        if (!s) return;
        const applied = outcome !== 'dismissed';
        set({
          suggestions: suggestions.map((x) => (x.id === id ? { ...x, status: outcome } : x)),
          plan: plan && applied ? applySuggestion(plan, s, override) : plan,
          // Every applied change becomes a hypothesis with a review date.
          experiments:
            applied && !experiments.some((e) => e.suggestionId === s.id)
              ? [
                  ...experiments,
                  startExperiment(
                    s,
                    new Date(),
                    adjustedValue(override),
                    contextNow(sessions, checkins, get().biometrics),
                  ),
                ]
              : experiments,
        });
        if (applied) consolidateSoon();
      },

      submitCheckIn: (c) => {
        const { checkins, plan, sessions, experiments, suggestions } = get();
        const now = new Date();
        const fresh =
          c.kind === 'weekly'
            ? weeklySuggestions({
                checkin: c,
                plan,
                sessions,
                experiments,
                now,
                lapseRisk: get().signals?.adherence?.lapseRisk,
              })
            : [];
        const known = new Set(suggestions.map((s) => s.id));
        set({
          // Every check-in keeps counting (the models weigh old ones less).
          // Never trimmed: the models already weigh old check-ins less, and
          // dropping the oldest also re-keyed every cached replay case.
          checkins: [...checkins, c],
          suggestions: [...suggestions, ...fresh.filter((s) => !known.has(s.id))],
          // Time alone can open a review window; a check-in is a good moment.
          experiments: promote(experiments, sessions, now),
        });
        consolidateSoon();
        return fresh;
      },

      reviewExperiment: (id, answers) => {
        const { experiments, sessions, plan } = get();
        const e = experiments.find((x) => x.id === id);
        if (!e || (e.status !== 'review' && e.status !== 'running')) return null;
        const closed = resolveExperiment(e, answers, objectiveCheck(e, sessions));
        let nextPlan = plan;
        if (plan && closed.status === 'reverted') {
          if (closed.kind === 'reduce_days' && closed.draftSessionId) {
            nextPlan = {
              ...plan,
              sessions: plan.sessions.map((ds) =>
                ds.id === closed.draftSessionId ? { ...ds, status: 'accepted' as const } : ds,
              ),
            };
          } else {
            const patch = revertPatch(closed);
            if (patch) {
              nextPlan = {
                ...plan,
                sessions: plan.sessions.map((ds) =>
                  closed.draftSessionId && ds.id !== closed.draftSessionId
                    ? ds
                    : {
                        ...ds,
                        movements: ds.movements.map((pm) =>
                          pm.movementId === closed.movementId
                            ? { ...pm, target: { ...pm.target, ...patch } }
                            : pm,
                        ),
                      },
                ),
              };
            }
          }
        }
        set({
          experiments: experiments.map((x) => (x.id === id ? closed : x)),
          plan: nextPlan,
        });
        consolidateSoon();
        return closed;
      },

      consolidate: (now = new Date(), opts = {}) => {
        const { plan, sessions, checkins, experiments, trials, goal } = get();
        const c = consolidatePass({
          plan,
          sessions,
          checkins,
          experiments,
          trials,
          daysPerWeek: goal?.daysPerWeek,
          biometrics: get().biometrics,
          advice: get().advice,
          cache: get().engineCache,
          archive: get().archive,
          block: get().block,
          // In the foreground a pass never holds the UI for more than a frame or three.
          ...(opts.background ? { budget: Infinity } : { budgetMs: FOREGROUND_BUDGET_MS }),
          now,
        });
        set({
          plan: c.plan,
          trials: c.trials,
          dayPlan: c.dayPlan,
          signals: c.signals,
          calibration: c.calibration,
          memory: c.memory,
          engineCache: c.cache,
          archive: c.archive,
          enginePending: c.pending,
          block: c.block,
          consolidatedAt: c.at,
          experiments: promote(experiments, sessions, now),
        });
        // A cold start (first launch after an update, a restore) is spread
        // over short passes so the app never stalls on it.
        if (c.pending) consolidateSoon(PENDING_DELAY_MS);
      },

      setHealthConnected: (connected) =>
        set({ health: { ...get().health, connected, lastError: null } }),

      ingestHealth: (pull, now = new Date()) => {
        const { sessions, biometrics, health } = get();
        const observedMax = Math.max(
          biometrics?.hrMax ?? 0,
          ...pull.workouts.map((w) => w.hrMax ?? 0),
        );
        const hrMax = estimateHrMax(observedMax || undefined);
        const merged = mergeWatchWorkouts(sessions, pull.workouts, {
          ownBundle: pull.ownBundle,
          hrMax,
          deletedUuids: pull.deletedUuids,
        });
        const today = dayIndex(now);
        set({
          sessions: merged.sessions,
          biometrics: {
            days: mergeBioDays(
              biometrics?.days ?? [],
              buildBioDays(pull.sleep, pull.hrv, pull.rhr),
              today,
            ),
            hrMax: observedMax || biometrics?.hrMax,
            updatedAt: now.toISOString(),
          },
          health: {
            ...health,
            anchor: pull.anchor,
            lastSyncAt: now.toISOString(),
            imported: health.imported + merged.added,
            lastError: null,
          },
        });
        // New nights and sessions change tomorrow's plan: think again now.
        get().consolidate(now);
        return { added: merged.added, enriched: merged.enriched };
      },

      setHealthError: (error) => set({ health: { ...get().health, lastError: error } }),

      reset: () => set(initial),
    }),
    {
      name: 'kairos-coach-v1',
      storage: createJSONStorage(() => trackedStorage),
      version: 1,
      // Without a migrate, zustand hydrates `undefined` on any version bump
      // and the next write saves an empty state over the person's history.
      migrate: migrateCoachState,
      partialize: (s) => ({
        goal: s.goal,
        plan: s.plan,
        sessions: s.sessions,
        suggestions: s.suggestions,
        experiments: s.experiments,
        checkins: s.checkins,
        trials: s.trials,
        dayPlan: s.dayPlan,
        signals: s.signals,
        calibration: s.calibration,
        advice: s.advice,
        memory: s.memory,
        consolidatedAt: s.consolidatedAt,
        engineCache: s.engineCache,
        archive: s.archive,
        block: s.block,
        biometrics: s.biometrics,
        health: s.health,
      }),
    },
  ),
);
