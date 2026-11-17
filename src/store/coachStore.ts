// Coach store — goal, plan draft, logged sessions and suggestions for the
// adaptive coach. Persisted locally so nothing is lost offline; the
// engine in src/lib/adaptive does all the thinking, this only holds state.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  consolidate as consolidatePass,
  readinessV2,
  type DayPlan,
  type Signals,
  type Trial,
} from '../lib/engine';
import type { ArmContext } from '../lib/engine/decision';

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
  consolidatedAt: string | null;

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
  consolidate: (now?: Date) => void;
  reset: () => void;
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
  consolidatedAt: null,
};

/** The value the user settled on when adjusting, for the experiment target. */
function adjustedValue(o?: Partial<MovementTarget>): number | undefined {
  return o?.loadKg ?? o?.durationMin ?? o?.distanceKm ?? o?.sets ?? o?.intervals?.reps;
}

/** Today's context for contextual learning: readiness band + sleep debt. */
function contextNow(sessions: SessionLog[], checkins: CheckIn[]): ArmContext {
  const r = readinessV2(sessions, checkins);
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
        get().consolidate();
      },

      recordSession: (log) => {
        const { sessions, plan, goal, suggestions, experiments, checkins } = get();
        const fresh = generateSuggestions({
          session: log,
          history: sessions,
          goal: goal ?? undefined,
          plan: plan ?? undefined,
          experiments,
          context: contextNow(sessions, checkins),
          painRisk: get().signals?.pain?.risk14,
        });
        // Re-running on the same session must not duplicate cards.
        const known = new Set(suggestions.map((s) => s.id));
        const all = [...sessions, log];
        set({
          sessions: all,
          plan: plan ? calibratePlan(plan, log) : plan,
          suggestions: [...suggestions, ...fresh.filter((s) => !known.has(s.id))],
          experiments: promote(experiments, all, new Date()),
        });
        get().consolidate();
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
                    contextNow(sessions, checkins),
                  ),
                ]
              : experiments,
        });
        if (applied) get().consolidate();
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
          checkins: [...checkins, c].slice(-120),
          suggestions: [...suggestions, ...fresh.filter((s) => !known.has(s.id))],
          // Time alone can open a review window; a check-in is a good moment.
          experiments: promote(experiments, sessions, now),
        });
        get().consolidate(now);
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
        get().consolidate();
        return closed;
      },

      consolidate: (now = new Date()) => {
        const { plan, sessions, checkins, experiments, trials, goal } = get();
        const c = consolidatePass({
          plan,
          sessions,
          checkins,
          experiments,
          trials,
          daysPerWeek: goal?.daysPerWeek,
          now,
        });
        set({
          plan: c.plan,
          trials: c.trials,
          dayPlan: c.dayPlan,
          signals: c.signals,
          consolidatedAt: c.at,
          experiments: promote(experiments, sessions, now),
        });
      },

      reset: () => set(initial),
    }),
    {
      name: 'kairos-coach-v1',
      storage: createJSONStorage(() => trackedStorage),
      version: 1,
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
        consolidatedAt: s.consolidatedAt,
      }),
    },
  ),
);
