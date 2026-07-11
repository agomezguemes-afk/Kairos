// KAIROS — Conversational intake engine.
//
// A human-in-the-loop reducer over ConversationState. Each `send` runs at most
// one intake turn and, when Kai decides it has enough, one block build. The
// engine is transport-agnostic: all LLM + generator wiring arrives via
// ConversationDeps, so this whole file is unit-testable in node with
// deterministic mocks (no network, no supabase in the import graph).
//
// Guarantees:
//   - Bounded: after MAX_QUESTION_TURNS the next turn is forced to build, so the
//     conversation always terminates in a block.
//   - Never strands: if the LLM turn throws, we fall back to deterministic
//     inference + build. Only a failing build surfaces an error phase.

import { generateId } from '../../../types/core';
import { inferBriefFromText } from './brief';
import { CONVERSATION_SYSTEM_PROMPT } from './prompts';
import type {
  ConversationDeps,
  ConversationMessage,
  ConversationState,
  SendCallbacks,
  SessionBrief,
} from './types';

// __DEV__ is injected by Metro on device but undeclared in node tests; the
// typeof guard keeps a bare reference from throwing ReferenceError.
declare const __DEV__: boolean | undefined;
const isDev = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__ === true;

/** After this many user turns, the next turn is pinned to build_session. */
export const MAX_QUESTION_TURNS = 2;

export function initConversation(): ConversationState {
  return {
    history: [{ role: 'system', content: CONVERSATION_SYSTEM_PROMPT }],
    messages: [],
    utterances: [],
    userTurns: 0,
    phase: 'idle',
    brief: null,
    result: null,
    error: null,
  };
}

function msg(role: ConversationMessage['role'], text: string): ConversationMessage {
  return { id: generateId(), role, text };
}

function closingFor(blockName: string, provided: string | null): string {
  const line = provided?.trim();
  if (line && line.length > 0) return line;
  return `Listo. Te he montado "${blockName}". Cuando quieras, arrancamos.`;
}

/**
 * Advance the conversation by one user message. Returns the next state; fires
 * callbacks for live streaming + phase changes along the way. Pure w.r.t. its
 * inputs except for the store writes performed inside `deps.buildBlock`.
 */
export async function sendMessage(
  prev: ConversationState,
  userText: string,
  deps: ConversationDeps,
  cb: SendCallbacks = {},
): Promise<ConversationState> {
  const trimmed = userText.trim();
  if (trimmed.length === 0) return prev;

  const utterances = [...prev.utterances, trimmed];
  const userTurns = prev.userTurns + 1;

  let state: ConversationState = {
    ...prev,
    utterances,
    userTurns,
    phase: 'thinking',
    error: null,
    messages: [...prev.messages, msg('user', trimmed)],
    history: [...prev.history, { role: 'user', content: trimmed }],
  };
  cb.onPhase?.('thinking');

  // ── Deterministic path: no LLM reachable → infer + build in one shot. ──
  if (!deps.aiAvailable()) {
    return finishWithBuild(state, inferBriefFromText(utterances.join('. ')), null, deps, cb);
  }

  // ── LLM intake turn (streamed). ──
  const forceBuild = prev.userTurns >= MAX_QUESTION_TURNS;
  let decision;
  try {
    decision = await deps.intakeTurn(state.history, (delta) => cb.onDelta?.(delta), forceBuild);
  } catch (e) {
    // LLM fell over mid-conversation — never strand the user. Infer + build.
    if (isDev()) console.warn('Kai intake turn failed, using deterministic build', e);
    return finishWithBuild(state, inferBriefFromText(utterances.join('. ')), null, deps, cb);
  }

  if (decision.kind === 'ask') {
    const text = decision.text.trim() || '¿Me cuentas un poco más de qué te apetece hoy?';
    return {
      ...state,
      phase: 'idle',
      messages: [...state.messages, msg('kai', text)],
      history: [...state.history, { role: 'assistant', content: text }],
    };
  }

  // decision.kind === 'build'
  return finishWithBuild(state, decision.brief, decision.closing, deps, cb);
}

/** Materialise the block and append Kai's confirmation, or surface an error. */
async function finishWithBuild(
  state: ConversationState,
  brief: SessionBrief,
  closing: string | null,
  deps: ConversationDeps,
  cb: SendCallbacks,
): Promise<ConversationState> {
  const building: ConversationState = { ...state, phase: 'building', brief };
  cb.onPhase?.('building');

  try {
    const result = await deps.buildBlock(brief);
    const line = closingFor(result.blockName, closing);
    cb.onPhase?.('done');
    return {
      ...building,
      phase: 'done',
      result,
      messages: [...building.messages, msg('kai', line)],
      history: [...building.history, { role: 'assistant', content: line }],
    };
  } catch (e) {
    if (isDev()) console.warn('Kai block build failed', e);
    const line = 'Uy, algo ha fallado montando la sesión. ¿Lo intentamos otra vez?';
    cb.onPhase?.('error');
    return {
      ...building,
      phase: 'error',
      error: e instanceof Error ? e.message : String(e),
      messages: [...building.messages, msg('kai', line)],
      history: [...building.history, { role: 'assistant', content: line }],
    };
  }
}

/** Thin stateful wrapper for the UI/hook. */
export interface Conversation {
  getState: () => ConversationState;
  send: (userText: string, cb?: SendCallbacks) => Promise<ConversationState>;
  reset: () => void;
}

export function createConversation(
  deps: ConversationDeps,
  initial?: ConversationState,
): Conversation {
  let state = initial ?? initConversation();
  return {
    getState: () => state,
    send: async (userText, cb) => {
      state = await sendMessage(state, userText, deps, cb);
      return state;
    },
    reset: () => {
      state = initConversation();
    },
  };
}
