// KAIROS — Conversational session controller for the "Hoy" surface.
//
// Framework-free view-model over the conversation engine: it owns the merged
// UI snapshot (engine bubbles + fast-path bubbles + streaming text + live
// phase) behind a subscribe/getSnapshot pair, so the React hook is a
// useSyncExternalStore one-liner and every branch is unit-testable in node.
//
// The hybrid fast-path runs HERE, before the engine: an unambiguous
// hybrid/race ask seeds the curated preset deterministically — zero LLM turns,
// works offline. Everything else delegates to sendMessage, which carries its
// own never-strand guarantees (deterministic fallback, forced build).

import { initConversation, sendMessage } from '../../lib/ai/conversation';
import type {
  BuiltSession,
  ConversationDeps,
  ConversationMessage,
  ConversationPhase,
  ConversationState,
} from '../../lib/ai/conversation';
import { generateId } from '../../types/core';

export interface SessionSnapshot {
  /** All bubbles in order: engine turns first, fast-path turns appended. */
  messages: ConversationMessage[];
  phase: ConversationPhase;
  /** Kai's partial reply while an ask-turn streams. Null outside streaming. */
  streamingText: string | null;
  result: BuiltSession | null;
  error: string | null;
  /** True when the input should accept + send text right now. */
  canSend: boolean;
}

export interface SessionDeps {
  /** Engine collaborators — defaultConversationDeps() in production. */
  engine: ConversationDeps;
  /** Deterministic hybrid preset builder (seeds the store, returns summary). */
  buildHybrid: () => BuiltSession | Promise<BuiltSession>;
  /** Hybrid-intent detector — wantsHybridSession in production. */
  isHybridAsk: (text: string) => boolean;
}

export interface ConversationSession {
  getSnapshot: () => SessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  send: (text: string) => Promise<void>;
  /** Re-sends the last utterance — the affordance for the error phase. */
  retry: () => Promise<void>;
  reset: () => void;
}

function msg(role: ConversationMessage['role'], text: string): ConversationMessage {
  return { id: generateId(), role, text };
}

/** Kai's confirmation when the hybrid fast-path lands (voice: KAI_VOICE.md).
 * Copy stays modality-agnostic: the preset decides the contents, not this line. */
export function hybridClosingLine(blockName: string): string {
  return `Hecho. «${blockName}»: tu sesión híbrida completa, en un solo bloque. Cuando quieras, arrancamos.`;
}

export function createConversationSession(deps: SessionDeps): ConversationSession {
  let engine: ConversationState = initConversation();
  /** Bubbles produced outside the engine (the hybrid fast-path turn). */
  let extra: ConversationMessage[] = [];
  let hybridResult: BuiltSession | null = null;
  let streamingText: string | null = null;
  /** Phase reported by engine callbacks while a send is in flight. */
  let livePhase: ConversationPhase | null = null;
  let busy = false;

  const listeners = new Set<() => void>();

  function compose(): SessionSnapshot {
    const result = hybridResult ?? engine.result;
    const phase: ConversationPhase = hybridResult
      ? 'done'
      : busy
        ? (livePhase ?? 'thinking')
        : engine.phase;
    return {
      messages: extra.length > 0 ? [...engine.messages, ...extra] : engine.messages,
      phase,
      streamingText,
      result,
      error: engine.error,
      canSend: !busy && result === null,
    };
  }

  // Snapshot is rebuilt only on emit so useSyncExternalStore sees a stable
  // reference between changes.
  let snapshot = compose();

  function emit(): void {
    snapshot = compose();
    for (const listener of listeners) listener();
  }

  /** Returns true when the fast-path fully handled the turn. */
  async function runHybrid(trimmed: string): Promise<boolean> {
    extra = [...extra, msg('user', trimmed)];
    livePhase = 'building';
    emit();
    try {
      const built = await deps.buildHybrid();
      extra = [...extra, msg('kai', hybridClosingLine(built.blockName))];
      hybridResult = built;
      return true;
    } catch {
      // Preset failed (should not happen) — drop the optimistic bubble and let
      // the engine path take the same text so the user still gets a session.
      extra = extra.slice(0, -1);
      return false;
    }
  }

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed.length === 0 || busy || snapshot.result !== null) return;
    busy = true;

    if (deps.isHybridAsk(trimmed)) {
      const handled = await runHybrid(trimmed);
      if (handled) {
        busy = false;
        livePhase = null;
        emit();
        return;
      }
    }

    streamingText = null;
    livePhase = 'thinking';
    emit();
    try {
      engine = await sendMessage(engine, trimmed, deps.engine, {
        onDelta: (fragment) => {
          streamingText = (streamingText ?? '') + fragment;
          emit();
        },
        onPhase: (phase) => {
          livePhase = phase;
          emit();
        },
      });
    } catch (e) {
      // The engine's contract is never-reject; this is belt and braces so a
      // downstream bug can't freeze the input. Surfaces a retryable error.
      engine = { ...engine, phase: 'error', error: e instanceof Error ? e.message : String(e) };
      extra = [...extra, msg('kai', 'Algo se ha torcido por mi lado. Prueba otra vez.')];
    }
    busy = false;
    livePhase = null;
    streamingText = null;
    emit();
  }

  async function retry(): Promise<void> {
    const last = engine.utterances.at(-1);
    if (!last) return;
    await send(last);
  }

  function reset(): void {
    engine = initConversation();
    extra = [];
    hybridResult = null;
    streamingText = null;
    livePhase = null;
    busy = false;
    emit();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    retry,
    reset,
  };
}
