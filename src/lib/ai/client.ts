// KAIROS — Unified Groq client.
// Replaces src/lib/ai/groq.ts and the inline fetch in src/services/aiService.ts.
//
// Supports plain text completions, JSON-mode, tool calling, and
// (Fase 4) SSE streaming via XMLHttpRequest. RN 0.81 + Hermes do NOT expose
// fetch's Response.body.getReader(), so we lean on XHR's onprogress event
// which keeps `responseText` populated mid-flight when the server sends
// chunks with Content-Type text/event-stream. No extra dep needed.
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

// ======================== STREAMING (SSE) ========================

/** Accumulated tool call assembled from streamed deltas. */
export interface StreamedToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface StreamCallbacks {
  /** Fires for every text fragment streamed in. Concatenate to build the body. */
  onTextDelta?: (delta: string) => void;
  /** Fires once when the model commits to tool calls (after finish_reason). */
  onToolCalls?: (calls: StreamedToolCall[]) => void;
  /**
   * Fires exactly once when the turn ends.
   *  - `text`: final accumulated text (may be empty if tool_calls path).
   *  - `toolCalls`: assembled tool calls (empty array if none).
   *  - `finishReason`: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string
   */
  onDone?: (final: {
    text: string;
    toolCalls: StreamedToolCall[];
    finishReason: string;
  }) => void;
  /** Fires on transport / parse failure. The promise rejects too. */
  onError?: (err: GroqError) => void;
}

export interface StreamOptions extends GroqOptions {
  /** AbortSignal — when aborted, the underlying XHR is cancelled and the
   *  promise rejects with a GroqError('aborted'). */
  signal?: AbortSignal;
}

/**
 * Stream a Groq chat completion. Returns the same final shape as
 * chatCompletion (so the agent loop can treat both paths uniformly), but
 * also fires per-token callbacks for the UI.
 *
 * Implementation note: we use XMLHttpRequest because RN's fetch on Hermes
 * does not expose Response.body as a ReadableStream. XHR's `progress`
 * event keeps `responseText` populated incrementally for SSE responses.
 */
export function streamChatCompletion(
  messages: GroqMessage[],
  opts: StreamOptions = {},
  callbacks: StreamCallbacks = {},
): Promise<GroqCompletionChoice> {
  const key = getGroqApiKey();
  if (!key) {
    return Promise.reject(new GroqError('EXPO_PUBLIC_GROQ_API_KEY no configurada'));
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1024,
    stream: true,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? 'auto';
  }

  return new Promise<GroqCompletionChoice>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const aggregatedText: string[] = [];
    const toolCallAccumulator = new Map<number, StreamedToolCall>();
    let finishReason: string = 'stop';
    let processedOffset = 0;
    let toolCallsEmitted = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      action();
    };

    const fail = (err: GroqError) => {
      callbacks.onError?.(err);
      settle(() => reject(err));
    };

    const handleAbort = () => {
      try {
        xhr.abort();
      } catch {
        /* noop */
      }
      fail(new GroqError('aborted'));
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        handleAbort();
        return;
      }
      opts.signal.addEventListener('abort', handleAbort);
    }

    timer = setTimeout(() => {
      try {
        xhr.abort();
      } catch {
        /* noop */
      }
      fail(new GroqError('Groq stream timeout'));
    }, REQUEST_TIMEOUT_MS);

    const drainBuffer = () => {
      // Parse all complete SSE events accumulated so far.
      const buf = xhr.responseText;
      let cursor = processedOffset;
      while (cursor < buf.length) {
        const nl = buf.indexOf('\n', cursor);
        if (nl === -1) break;
        const line = buf.slice(cursor, nl).trim();
        cursor = nl + 1;
        if (line.length === 0) continue;
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          processedOffset = cursor;
          continue;
        }
        let evt: StreamEventChunk;
        try {
          evt = JSON.parse(payload) as StreamEventChunk;
        } catch {
          // Partial JSON shouldn't happen at this point because we waited for \n,
          // but if it does, skip — the next progress tick will retry.
          continue;
        }
        const choice = evt.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          aggregatedText.push(delta.content);
          callbacks.onTextDelta?.(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tcDelta of delta.tool_calls) {
            const idx = tcDelta.index;
            if (typeof idx !== 'number') continue;
            const acc = toolCallAccumulator.get(idx) ?? {
              id: '',
              type: 'function' as const,
              function: { name: '', arguments: '' },
            };
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) acc.function.name = tcDelta.function.name;
            if (tcDelta.function?.arguments) {
              acc.function.arguments += tcDelta.function.arguments;
            }
            toolCallAccumulator.set(idx, acc);
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
      processedOffset = cursor;
    };

    xhr.open('POST', ENDPOINT, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${key}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    // RN XHR exposes responseText incrementally regardless of responseType,
    // but explicitly set 'text' so Hermes doesn't try to parse JSON.
    xhr.responseType = 'text';

    xhr.onreadystatechange = () => {
      // 3 = LOADING (chunks arriving). 4 = DONE.
      if (xhr.readyState === 3) {
        if (xhr.status >= 400) return; // error path handled at readyState 4
        drainBuffer();
      } else if (xhr.readyState === 4) {
        if (xhr.status === 0 && settled) return; // already aborted
        if (xhr.status < 200 || xhr.status >= 300) {
          fail(
            new GroqError(
              `Groq ${xhr.status}: ${xhr.responseText.slice(0, 300) || 'stream failed'}`,
            ),
          );
          return;
        }
        // Final flush — server may or may not have sent a trailing newline.
        drainBuffer();

        const calls = Array.from(toolCallAccumulator.values()).filter(
          (c) => c.function.name.length > 0,
        );
        const text = aggregatedText.join('');

        if (calls.length > 0 && !toolCallsEmitted) {
          toolCallsEmitted = true;
          callbacks.onToolCalls?.(calls);
        }
        callbacks.onDone?.({ text, toolCalls: calls, finishReason });

        const message: GroqAssistantMessage = {
          role: 'assistant',
          content: text.length > 0 ? text : null,
        };
        if (calls.length > 0) message.tool_calls = calls;

        settle(() =>
          resolve({
            message,
            finish_reason: finishReason,
          } as GroqCompletionChoice),
        );
      }
    };

    xhr.onerror = () => {
      fail(new GroqError('XHR error during stream'));
    };
    xhr.ontimeout = () => {
      fail(new GroqError('XHR timeout during stream'));
    };

    try {
      xhr.send(JSON.stringify(body));
    } catch (e) {
      fail(new GroqError('Failed to start XHR', e));
    }
  });
}

// ======================== STREAM CHUNK SHAPES ========================

interface StreamDeltaToolCall {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface StreamDelta {
  role?: GroqRole;
  content?: string | null;
  tool_calls?: StreamDeltaToolCall[];
}

interface StreamEventChoice {
  index?: number;
  delta?: StreamDelta;
  finish_reason?: string | null;
}

interface StreamEventChunk {
  id?: string;
  choices: StreamEventChoice[];
}
