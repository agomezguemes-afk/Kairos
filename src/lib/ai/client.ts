// KAIROS — Unified Groq client.
// Replaces src/lib/ai/groq.ts and the inline fetch in src/services/aiService.ts.
//
// Supports plain text completions, JSON-mode, and (Fase 1+) tool calling.
// Streaming hooks are stubbed but not wired yet — see Fase 4.
//
// Model choice (verified 2026-05 against Groq docs): llama-3.3-70b-versatile
// is on the free tier, has a 128k context window, supports parallel tool
// calling, and is the most capable Llama variant available without a paid
// plan. We keep it as the default; alternatives (qwen3-32b, llama-4-scout)
// can be swapped in via the `model` option without touching call sites.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 25_000;

// ======================== TYPES ========================

export type GroqRole = 'system' | 'user' | 'assistant' | 'tool';

export interface GroqTextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqToolMessage {
  role: 'tool';
  /** Must match the assistant message's `tool_calls[i].id`. */
  tool_call_id: string;
  /** Stringified JSON result (the tool's return value). */
  content: string;
  /** Optional human-readable name; some Groq models echo it. */
  name?: string;
}

export interface GroqAssistantToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface GroqAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: GroqAssistantToolCall[];
}

export type GroqMessage = GroqTextMessage | GroqToolMessage | GroqAssistantMessage;

export interface GroqToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface GroqOptions {
  model?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  tools?: GroqToolDefinition[];
  /** 'auto' | 'none' | { type:'function', function:{name} } */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface GroqCompletionChoice {
  index?: number;
  message: GroqAssistantMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
}

export interface GroqCompletion {
  id?: string;
  choices: GroqCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// ======================== ERRORS ========================

export class GroqError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'GroqError';
  }
}

// ======================== CONFIG ========================

export function getGroqApiKey(): string | null {
  const k = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  return typeof k === 'string' && k.trim().length > 0 ? k.trim() : null;
}

export function isGroqAvailable(): boolean {
  return getGroqApiKey() !== null;
}

// ======================== LOW-LEVEL CALL ========================

/**
 * Generic Groq chat completion. Returns the full first choice so the caller
 * can inspect tool_calls or raw content. Throws GroqError on any failure.
 */
export async function chatCompletion(
  messages: GroqMessage[],
  opts: GroqOptions = {},
): Promise<GroqCompletionChoice> {
  const key = getGroqApiKey();
  if (!key) throw new GroqError('EXPO_PUBLIC_GROQ_API_KEY no configurada');

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1024,
  };

  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? 'auto';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new GroqError('No se pudo contactar con Groq', e);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GroqError(`Groq ${res.status}: ${text.slice(0, 300)}`);
  }

  let json: GroqCompletion;
  try {
    json = (await res.json()) as GroqCompletion;
  } catch (e) {
    throw new GroqError('Respuesta de Groq no era JSON', e);
  }

  const choice = json.choices?.[0];
  if (!choice) throw new GroqError('Groq devolvió 0 choices');
  return choice;
}

// ======================== TEXT-ONLY HELPER ========================

/**
 * Convenience for legacy call sites (coach.ts, insights.ts) that just want
 * the raw assistant text. Throws if the model returned tool_calls instead
 * of plain content (callers asking for text shouldn't be passing tools).
 */
export async function callGroq(
  messages: GroqMessage[],
  opts: GroqOptions = {},
): Promise<string> {
  const choice = await chatCompletion(messages, opts);
  const content = choice.message.content;
  if (typeof content !== 'string') {
    throw new GroqError('Groq devolvió tool_calls cuando se esperaba texto');
  }
  return content;
}
