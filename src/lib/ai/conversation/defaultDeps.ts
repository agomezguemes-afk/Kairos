// KAIROS — Production wiring for the conversation engine.
//
// Assembles the real ConversationDeps: Groq availability, the streamed intake
// turn, and the agent-backed block builder. The transport modules (client,
// agent, intake, aiBlockBuilder) are pulled in via dynamic import so this file
// can be referenced from the barrel without dragging the Groq/supabase graph
// into node unit tests that only touch the pure engine.

import { buildSessionBlockDeterministic } from './blockFromBrief';
import { inferBriefFromText } from './brief';
import type { ConversationDeps, IntakeDecision, SessionBrief } from './types';
import type { GroqMessage } from '../client';

export function defaultConversationDeps(): ConversationDeps {
  return {
    aiAvailable: () => {
      // Synchronous require via a cached dynamic import is not possible here;
      // isAIAvailable is cheap + sync, so we read it lazily through require to
      // avoid a static client import. Metro resolves this at bundle time.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../client') as typeof import('../client');
        return mod.isAIAvailable();
      } catch {
        return false;
      }
    },
    intakeTurn: async (
      history: GroqMessage[],
      onDelta: (delta: string) => void,
      forceBuild: boolean,
    ): Promise<IntakeDecision> => {
      const { realIntakeTurn } = await import('./intake');
      return realIntakeTurn(history, onDelta, forceBuild);
    },
    buildBlock: async (brief: SessionBrief) => {
      const { buildSessionBlockViaAgent } = await import('./aiBlockBuilder');
      return buildSessionBlockViaAgent(brief);
    },
  };
}

/**
 * Fully deterministic deps — no LLM, ever. Used as a safety net (and handy for
 * on-device smoke tests without a key): every turn infers a brief from the raw
 * text and builds the curated block immediately.
 */
export function deterministicConversationDeps(): ConversationDeps {
  return {
    aiAvailable: () => false,
    intakeTurn: async (history) => {
      const parts: string[] = [];
      for (const m of history) {
        if (m.role === 'user' && typeof m.content === 'string') parts.push(m.content);
      }
      return { kind: 'build', brief: inferBriefFromText(parts.join('. ')), closing: null };
    },
    buildBlock: async (brief) => buildSessionBlockDeterministic(brief),
  };
}
