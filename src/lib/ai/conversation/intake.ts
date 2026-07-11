// KAIROS — Real intake turn against Groq (device/runtime only).
//
// One streamed turn with a single tool, build_session. Kai either streams a
// short question (text deltas → onDelta) or commits to the tool. We only parse
// the tool arguments once the stream closes (no partial-JSON rendering), then
// validate at the boundary via parseBriefArgs. Isolated here so the engine and
// its tests never import the streaming transport.

import { streamChatCompletion } from '../client';
import type { GroqMessage } from '../client';
import { BUILD_SESSION_TOOL, parseBriefArgs } from './brief';
import type { IntakeDecision } from './types';

const INTAKE_TEMPERATURE = 0.5;
const INTAKE_MAX_TOKENS = 480;

/** Concatenate every user utterance in the history — the fallback inference text. */
function userText(history: GroqMessage[]): string {
  const parts: string[] = [];
  for (const m of history) {
    if (m.role === 'user' && typeof m.content === 'string') parts.push(m.content);
  }
  return parts.join('. ');
}

export async function realIntakeTurn(
  history: GroqMessage[],
  onDelta: (delta: string) => void,
  forceBuild: boolean,
): Promise<IntakeDecision> {
  const choice = await streamChatCompletion(
    history,
    {
      tools: [BUILD_SESSION_TOOL],
      toolChoice: forceBuild ? { type: 'function', function: { name: 'build_session' } } : 'auto',
      temperature: INTAKE_TEMPERATURE,
      maxTokens: INTAKE_MAX_TOKENS,
    },
    { onTextDelta: onDelta },
  );

  const calls = choice.message.tool_calls ?? [];
  const build = calls.find((c) => c.function.name === 'build_session');
  if (build) {
    const { brief, closing } = parseBriefArgs(build.function.arguments ?? '', userText(history));
    return { kind: 'build', brief, closing };
  }

  const text = (choice.message.content ?? '').trim();
  return { kind: 'ask', text };
}
