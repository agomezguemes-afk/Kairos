// The existing Groq client behind the provider interface.

import { chatCompletion, isGroqAvailable } from '../client';
import type { ChatRequest, ChatResult, LlmProvider } from './types';

export const groqProvider: LlmProvider = {
  id: 'groq',
  kind: 'cloud',
  capabilities: { json: true, tools: true, contextTokens: 128_000 },
  status: () =>
    isGroqAvailable()
      ? { available: true }
      : { available: false, reason: 'No hay clave de Groq configurada.' },
  async complete(req: ChatRequest): Promise<ChatResult> {
    const choice = await chatCompletion(req.messages, {
      jsonMode: req.json,
      tools: req.tools,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
    });
    return {
      content: typeof choice.message.content === 'string' ? choice.message.content : null,
      toolCalls: 'tool_calls' in choice.message ? choice.message.tool_calls : undefined,
    };
  },
};
