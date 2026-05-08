// Kai global chat: profile-aware Groq call routed through the agent loop.
//
// IMPORTANT — no silent mock fallback. If Groq is unconfigured or fails
// we surface an AIUnavailableError that the UI must render as an error,
// rather than handing back a fabricated reply.

import type { AIMessage } from '../../../types/ai';
import { generateId } from '../../../types/core';
import {
  buildUserContextSnapshot,
  renderContextForPrompt,
  type RawUserContext,
} from '../../../utils/userContext';
import { runAgent, AgentError, type AgentProgressFn } from '../agent';
import type { GroqMessage } from '../client';
import { isGroqAvailable, GroqError } from '../client';
import { COACH_CHAT_SYSTEM } from '../prompts/system';

export type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

export class AIUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

function buildUserPrompt(
  snapshot: ReturnType<typeof buildUserContextSnapshot>,
  query: string,
  history: ChatHistoryItem[],
): string {
  const context = renderContextForPrompt(snapshot);
  const histText = history.length > 0
    ? '\n\nHISTORIAL DE CONVERSACIÓN:\n' +
      history.slice(-6).map((m) => `${m.role === 'user' ? 'Usuario' : 'Kai'}: ${m.content}`).join('\n')
    : '';
  return `${context}${histText}\n\nMENSAJE DEL USUARIO:\n${query}`;
}

export interface GlobalChatOptions {
  onProgress?: AgentProgressFn;
}

/**
 * Process a global chat message through Groq via the tool-calling agent.
 * Throws AIUnavailableError if the API key is missing or Groq fails — the
 * caller is responsible for surfacing that to the user.
 */
export async function processGlobalChat(
  userText: string,
  rawCtx: RawUserContext,
  history: ChatHistoryItem[] = [],
  options: GlobalChatOptions = {},
): Promise<AIMessage> {
  if (!isGroqAvailable()) {
    throw new AIUnavailableError(
      'No hay clave de Groq configurada (EXPO_PUBLIC_GROQ_API_KEY).',
    );
  }

  const snapshot = buildUserContextSnapshot(rawCtx);
  const userPrompt = buildUserPrompt(snapshot, userText, history);

  const messages: GroqMessage[] = [
    { role: 'system', content: COACH_CHAT_SYSTEM },
    { role: 'user', content: userPrompt },
  ];

  let result;
  try {
    result = await runAgent(messages, {
      temperature: 0.5,
      maxTokens: 2048,
      onProgress: options.onProgress,
    });
  } catch (e) {
    if (e instanceof AgentError || e instanceof GroqError) {
      throw new AIUnavailableError(`Groq falló: ${e.message}`, e);
    }
    const detail = e instanceof Error ? e.message : String(e);
    throw new AIUnavailableError(`Groq falló: ${detail}`, e);
  }

  // The agent might create a single new block — surface its id for "Ver bloque".
  const created = result.toolResults
    .filter((r) => r.ok && r.name === 'create_block')
    .map((r) => (r.data as { blockId?: string } | undefined)?.blockId)
    .filter((id): id is string => typeof id === 'string');
  const affectedBlockId = created.length === 1 ? created[0] : undefined;

  return {
    id: generateId(),
    role: 'assistant',
    content: result.text,
    toolResults: result.toolResults,
    affectedBlockId,
    timestamp: Date.now(),
  };
}

// Re-export under the legacy name so existing call sites can flip with a
// single rename. Will be deleted once consumers migrate.
export { GroqError };
