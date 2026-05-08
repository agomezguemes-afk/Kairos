// Kai global chat: profile-aware Groq call → parsed actions.
// Replaces src/services/aiService.ts → processWithGroq.
//
// IMPORTANT — no silent mock fallback. If Groq is unconfigured or fails
// we surface a system AIMessage that the UI must render as an error,
// rather than handing back a fabricated reply (which used to happen via
// the mock chat service and made real failures invisible).

import type { AIMessage } from '../../../types/ai';
import { generateId } from '../../../types/core';
import {
  buildUserContextSnapshot,
  renderContextForPrompt,
  type RawUserContext,
} from '../../../utils/userContext';
import { callGroq, isGroqAvailable, GroqError } from '../client';
import { COACH_CHAT_SYSTEM } from '../prompts/system';
import { parseResponse } from '../parser/actionsParser';

export type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

export class AIUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

function buildUserPrompt(snapshot: ReturnType<typeof buildUserContextSnapshot>, query: string, history: ChatHistoryItem[]): string {
  const context = renderContextForPrompt(snapshot);
  const histText = history.length > 0
    ? '\n\nHISTORIAL DE CONVERSACIÓN:\n' +
      history.slice(-6).map((m) => `${m.role === 'user' ? 'Usuario' : 'Kai'}: ${m.content}`).join('\n')
    : '';
  return `${context}${histText}\n\nMENSAJE DEL USUARIO:\n${query}`;
}

/**
 * Process a global chat message through Groq. Throws AIUnavailableError if
 * the API key is missing or Groq fails — the caller is responsible for
 * surfacing this to the user.
 */
export async function processGlobalChat(
  userText: string,
  raw: RawUserContext,
  history: ChatHistoryItem[] = [],
): Promise<AIMessage> {
  if (!isGroqAvailable()) {
    throw new AIUnavailableError(
      'No hay clave de Groq configurada (EXPO_PUBLIC_GROQ_API_KEY).',
    );
  }

  const snapshot = buildUserContextSnapshot(raw);
  const userPrompt = buildUserPrompt(snapshot, userText, history);

  let raw$: string;
  try {
    raw$ = await callGroq(
      [
        { role: 'system', content: COACH_CHAT_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      { jsonMode: true, temperature: 0.6, maxTokens: 2048 },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new AIUnavailableError(`Groq falló: ${detail}`, e);
  }

  let parsed;
  try {
    parsed = parseResponse(raw$);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new AIUnavailableError(`Respuesta inválida: ${detail}`, e);
  }

  return {
    id: generateId(),
    role: 'assistant',
    content: parsed.message,
    actions: parsed.actions,
    timestamp: Date.now(),
  };
}

// Re-export under the legacy name so existing call sites can flip with a
// single rename. Will be deleted once consumers migrate.
export { GroqError };
