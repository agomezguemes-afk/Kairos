// src/lib/kai/applyAction.ts
//
// Applies a KaiNextAction in one tap and emits the funnel events (05 P0-2).
// Fully dependency-injected: no store import here, so it unit-tests without
// pulling react-native. The real wiring lives in kaiDeps.ts.
//
// Store mutations happen here (start/schedule/bump/create); pure-navigation
// intents (resume/open) only emit — the screen handles the navigation.

import type { ISODate } from '../../types/schedule';
import { ANALYTICS_EVENTS, track } from '../analytics';
import type { KaiNextAction, KaiNextStep } from './nextStep';

export interface KaiActionDeps {
  startWorkout: (
    blockId: string,
    ctx?: { source?: 'today' | 'calendar' | 'free' | 'history' },
  ) => void;
  assignOnce: (date: ISODate, blockId: string) => string;
  setExerciseGoal: (
    blockId: string,
    exerciseId: string,
    goal: { goalWeight?: number; goalReps?: number },
  ) => void;
  addBlock: () => string;
  today: () => ISODate;
  tomorrow: () => ISODate;
}

export interface KaiApplyResult {
  ok: boolean;
  /** Block the action touched/created, for the caller to navigate to. */
  blockId?: string;
}

/**
 * Emit `kai_signal_viewed` when a next-step card is shown. Idempotency is the
 * caller's job (fire once per surfaced card).
 */
export function markKaiStepViewed(step: KaiNextStep): void {
  track(ANALYTICS_EVENTS.kai_signal_viewed, { id: step.id, kind: step.action.kind });
}

/**
 * Apply the action against the injected store deps and emit
 * `kai_action_applied` on success. Returns whether it applied plus the target
 * block id. Missing required data (a malformed action) returns { ok: false }
 * and emits nothing.
 */
export function applyKaiAction(action: KaiNextAction, deps: KaiActionDeps): KaiApplyResult {
  let result: KaiApplyResult;

  switch (action.kind) {
    case 'start_block': {
      if (!action.blockId) return { ok: false };
      deps.startWorkout(action.blockId, { source: 'today' });
      result = { ok: true, blockId: action.blockId };
      break;
    }
    case 'resume_workout': {
      // The active session already exists; the screen resumes it.
      result = { ok: true };
      break;
    }
    case 'schedule_block': {
      if (!action.blockId) return { ok: false };
      const date = action.date ?? deps.tomorrow();
      deps.assignOnce(date, action.blockId);
      result = { ok: true, blockId: action.blockId };
      break;
    }
    case 'repeat_block': {
      if (!action.blockId) return { ok: false };
      const date = action.date ?? deps.tomorrow();
      deps.assignOnce(date, action.blockId);
      result = { ok: true, blockId: action.blockId };
      break;
    }
    case 'bump_weight': {
      if (!action.blockId || !action.exerciseId || action.targetWeight === undefined) {
        return { ok: false };
      }
      deps.setExerciseGoal(action.blockId, action.exerciseId, { goalWeight: action.targetWeight });
      result = { ok: true, blockId: action.blockId };
      break;
    }
    case 'open_block': {
      if (!action.blockId) return { ok: false };
      // Navigation-only; the screen opens the block.
      result = { ok: true, blockId: action.blockId };
      break;
    }
    case 'create_block': {
      const blockId = deps.addBlock();
      result = { ok: true, blockId };
      break;
    }
    default: {
      // Exhaustiveness guard — a new kind must be handled explicitly.
      const _never: never = action.kind;
      return { ok: false };
    }
  }

  track(ANALYTICS_EVENTS.kai_action_applied, {
    kind: action.kind,
    blockId: result.blockId ?? null,
  });
  return result;
}
