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
  parseGoal,
  type DraftStatus,
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
  reset: () => void;
}

const initial = { goal: null, plan: null, sessions: [], suggestions: [] };

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
        const { sessions, plan, goal, suggestions } = get();
        const fresh = generateSuggestions({
          session: log,
          history: sessions,
          goal: goal ?? undefined,
          plan: plan ?? undefined,
        });
        // Re-running on the same session must not duplicate cards.
        const known = new Set(suggestions.map((s) => s.id));
        set({
          sessions: [...sessions, log],
          plan: plan ? calibratePlan(plan, log) : plan,
          suggestions: [...suggestions, ...fresh.filter((s) => !known.has(s.id))],
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
        const { suggestions, plan } = get();
        const s = suggestions.find((x) => x.id === id);
        if (!s) return;
        set({
          suggestions: suggestions.map((x) => (x.id === id ? { ...x, status: outcome } : x)),
          plan: plan && outcome !== 'dismissed' ? applySuggestion(plan, s, override) : plan,
        });
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
      }),
    },
  ),
);
