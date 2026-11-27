// Provider-agnostic language-model layer.
//
// Every back end (Apple Foundation Models, a downloaded model through
// llama.rn, a cloud API) answers the same OpenAI-style chat request, so the
// router can try them in order and callers never know which one ran. The
// message shapes are the ones the Groq client already speaks; llama.rn and
// Apple's tool calls map onto them.

import type { GroqAssistantToolCall, GroqMessage, GroqToolDefinition } from '../client';

export type ChatMessage = GroqMessage;
export type ToolDefinition = GroqToolDefinition;
export type ToolCall = GroqAssistantToolCall;

/** What the app asks a model to do; each task has its own routing policy. */
export type AiTask = 'goal' | 'agent' | 'coach' | 'review';

/** Where a back end runs. Health data only leaves the phone on 'cloud'. */
export type ProviderKind = 'apple' | 'local' | 'cloud';

export interface ProviderStatus {
  available: boolean;
  /** Why not, in words a settings screen can show. */
  reason?: string;
}

export interface ProviderCapabilities {
  /** Output constrained to valid JSON (JSON mode, grammar or guided generation). */
  json: boolean;
  tools: boolean;
  /** Prompt + output tokens the back end can hold. */
  contextTokens: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  json?: boolean;
  /**
   * JSON Schema the answer must follow. On-device models turn it into a
   * grammar, so they cannot emit anything else; JSON-mode-only back ends
   * use it as `json`. The caller still validates: a grammar fixes syntax,
   * not meaning.
   */
  schema?: Record<string, unknown>;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface LlmProvider {
  id: string;
  kind: ProviderKind;
  capabilities: ProviderCapabilities;
  /** Cheap and synchronous: called on every routing decision. */
  status(): ProviderStatus;
  /**
   * Whether this back end does the task well enough to be tried. Absent
   * means every task: a small on-device model answers a goal well but
   * would botch a multi-step tool agent, so it opts out of that.
   */
  suits?(task: AiTask): boolean;
  complete(req: ChatRequest): Promise<ChatResult>;
}

/** The device and person at the moment of the request. */
export interface RouteContext {
  /** Unknown counts as online: a cloud attempt then fails fast and falls through. */
  online: boolean;
  /** The person allowed sending their training summaries to a cloud model. */
  cloudConsent: boolean;
  /** iOS rejects GPU work from the background; on-device models only run in the foreground. */
  foreground: boolean;
  /** ProcessInfo.thermalState; from 'serious' up, on-device generation is skipped. */
  thermal: 'nominal' | 'fair' | 'serious' | 'critical';
}
