// KAIROS — Conversational intake: public surface.
//
// The voice→block loop. Import the engine + default deps here; the transport
// wiring stays behind dynamic imports so pure consumers (and tests) stay light.

export {
  createConversation,
  initConversation,
  sendMessage,
  MAX_QUESTION_TURNS,
  type Conversation,
} from './engine';
export { defaultConversationDeps, deterministicConversationDeps } from './defaultDeps';
export {
  inferBriefFromText,
  briefToStarterAnswers,
  parseBriefArgs,
  BUILD_SESSION_TOOL,
} from './brief';
export { buildSessionBlockDeterministic, summarizeBlock } from './blockFromBrief';
export { wantsHybridSession, buildHybridSession } from './hybridFastPath';
export { CONVERSATION_SYSTEM_PROMPT, CONVERSATION_PROMPT_VERSION } from './prompts';
export type {
  ConversationState,
  ConversationMessage,
  ConversationDeps,
  ConversationPhase,
  SessionBrief,
  BuiltSession,
  IntakeDecision,
  SendCallbacks,
} from './types';
