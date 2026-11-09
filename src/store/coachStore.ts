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

interface CoachState {
  goal: ParsedGoal | null;
  plan: PlanDraft | null;
  sessions: SessionLog[];
  suggestions: Suggestion[];
  experiments: Experiment[];
  checkins: CheckIn[];

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
  reset: () => void;
}

const initial = {
  goal: null,
  plan: null,
  sessions: [],
  suggestions: [],
  experiments: [],
  checkins: [],
};

/** The value the user settled on when adjusting, for the experiment target. */
function adjustedValue(o?: Partial<MovementTarget>): number | undefined {
  return o?.loadKg ?? o?.durationMin ?? o?.distanceKm ?? o?.sets ?? o?.intervals?.reps;
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
      },

      recordSession: (log) => {
        const { sessions, plan, goal, suggestions, experiments } = get();
        const fresh = generateSuggestions({
          session: log,
          history: sessions,
          goal: goal ?? undefined,
          plan: plan ?? undefined,
          experiments,
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
        return fresh;
      },

      revealSuggestion: (id) =>
        set({
          suggestions: get().suggestions.map((s) =>
            s.id === id && s.status === 'locked' ? { ...s, status: 'revealed' } : s,
          ),
        }),

      resolveSuggestion: (id, outcome, override) => {
        const { suggestions, plan, experiments } = get();
        const s = suggestions.find((x) => x.id === id);
        if (!s) return;
        const applied = outcome !== 'dismissed';
        set({
          suggestions: suggestions.map((x) => (x.id === id ? { ...x, status: outcome } : x)),
          plan: plan && applied ? applySuggestion(plan, s, override) : plan,
          // Every applied change becomes a hypothesis with a review date.
          experiments:
            applied && !experiments.some((e) => e.suggestionId === s.id)
              ? [...experiments, startExperiment(s, new Date(), adjustedValue(override))]
              : experiments,
        });
      },

      submitCheckIn: (c) => {
        const { checkins, plan, sessions, experiments, suggestions } = get();
        const now = new Date();
        const fresh =
          c.kind === 'weekly'
            ? weeklySuggestions({ checkin: c, plan, sessions, experiments, now })
            : [];
        const known = new Set(suggestions.map((s) => s.id));
        set({
          checkins: [...checkins, c].slice(-120),
          suggestions: [...suggestions, ...fresh.filter((s) => !known.has(s.id))],
          // Time alone can open a review window; a check-in is a good moment.
          experiments: promote(experiments, sessions, now),
        });
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
        return closed;
      },

      reset: () => set(initial),
    }),
    {
      name: 'kairos-coach-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({
        goal: s.goal,
        plan: s.plan,
        sessions: s.sessions,
        suggestions: s.suggestions,
        experiments: s.experiments,
        checkins: s.checkins,
      }),
    },
  ),
);
