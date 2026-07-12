// KAIROS — Unified AI client.
//
// Routes every chat completion through one of two upstreams:
//
//   1. Supabase Edge Function "ai-chat" (default in production).
//      The function authenticates via JWT, checks the caller's 24h
//      quota against their tier policy, calls Groq / Anthropic with the
//      server-side key, and records the call in ai_quota. The upstream
//      key is never in the bundle. Returns 429 with paywall payload
//      when the user hits their cap.
//
//   2. Direct Groq (dev-only fallback). Used when EXPO_PUBLIC_GROQ_API_KEY
//      is present AND there is no active Supabase session. Lets SKIP_AUTH
//      development sessions hit the LLM without spinning up the backend.
//      This path is hard-gated to development builds (see devFallback.ts):
//      in any release build the key is never read, so it cannot leak into
//      the bundle and cannot be used to bypass the server-side quota.
//
// The public API (callGroq, chatCompletion, streamChatCompletion) keeps
// its name + shape so existing call sites in agent.ts, coach.ts, etc.
// don't change. Sprint 7 · Commit 2.

import { supabase } from '../supabase';
import { readDevGroqKey } from './devFallback';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 25_000;

// The Supabase URL is already a public identifier (lives in the bundle).
// We append the standard Edge Functions path so the proxy lives at the
// same origin as the rest of the auth/data calls.
function getProxyEndpoint(): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/functions/v1/ai-chat`;
}

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
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GroqError';
  }
}

/**
 * Thrown when the upstream proxy refuses the call because the user has
 * exceeded their tier cap in the rolling 24h window. The UI catches
 * this specifically to present the Pro upgrade sheet.
 *
 * Payload mirrors the server-side QuotaExceededBody in the Edge
 * Function so consumers can render the reset hint without re-fetching.
 */
export class QuotaExceededError extends Error {
  constructor(
    readonly tier: 'free' | 'pro',
    readonly dailyCap: number,
    readonly usedToday: number,
    readonly resetsAt: string,
    readonly upgradeAvailable: boolean,
  ) {
    super(`AI quota exceeded (${usedToday}/${dailyCap} on ${tier})`);
    this.name = 'QuotaExceededError';
  }
}

// ======================== CONFIG ========================

/**
 * The direct-Groq key, or null. This is a DEV-ONLY fallback: it returns
 * null in every release build so the key is never used (or shipped) in
 * production, where AI must go through the authenticated Supabase proxy.
 * See devFallback.ts for the full rationale.
 */
export function getGroqApiKey(): string | null {
  return readDevGroqKey();
}

/**
 * @deprecated Use isAIAvailable. Will be removed once all call sites
 * migrate. Kept as a thin alias so the rename is a no-op upgrade.
 */
export function isGroqAvailable(): boolean {
  return isAIAvailable();
}

/**
 * True when the app can make an AI call right now — either we have a
 * Supabase session (proxy path) or a Groq key in the env (dev fallback).
 *
 * NOTE: this is synchronous and only checks the cached session.
 * `supabase.auth.getSession()` returns the last-known session without a
 * network call, so this is safe in render code. A user who just
 * authenticated may need to wait one tick for the session to land.
 */
export function isAIAvailable(): boolean {
  if (getProxyEndpoint() && hasActiveSession()) return true;
  return getGroqApiKey() !== null;
}

/**
 * Synchronous "is someone signed in" check, shared with the other AI
 * surfaces (STT routes on it too — see stt/transcribe.ts). supabase-js
 * v2 doesn't expose a synchronous session getter, so we mirror it
 * ourselves via the onAuthStateChange listener below. The cache is
 * seeded on cold start from AsyncStorage, so a just-authenticated user
 * may lag one tick.
 */
export function hasActiveSession(): boolean {
  return cachedAccessToken !== null;
}

let cachedAccessToken: string | null = null;

// Subscribe once at module load so the cache reflects sign-in /
// sign-out events. The promise-based getSession() call seeds the cache
// from AsyncStorage on cold start.
supabase.auth.getSession().then(({ data }) => {
  cachedAccessToken = data.session?.access_token ?? null;
});
supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null;
});

/**
 * The Supabase access token for proxy calls, or null when signed out.
 * Prefers the listener-maintained cache; falls back to getSession() so
 * a cold start (cache not yet seeded) still finds the stored session.
 */
export async function getActiveAccessToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;
  const { data } = await supabase.auth.getSession();
  cachedAccessToken = data.session?.access_token ?? null;
  return cachedAccessToken;
}

// ======================== LOW-LEVEL CALL ========================

/**
 * Generic chat completion. Routes through the Supabase proxy when an
 * authenticated session is available, otherwise falls back to direct
 * Groq if a dev key is present. Returns the full first choice so the
 * caller can inspect tool_calls or raw content. Throws GroqError on
 * upstream failure, QuotaExceededError on 429.
 */
export async function chatCompletion(
  messages: GroqMessage[],
  opts: GroqOptions = {},
): Promise<GroqCompletionChoice> {
  const proxyUrl = getProxyEndpoint();
  const token = proxyUrl ? await getActiveAccessToken() : null;

  if (proxyUrl && token) {
    return chatCompletionViaProxy(proxyUrl, token, messages, opts);
  }

  const key = getGroqApiKey();
  if (!key) {
    throw new GroqError(
      'No hay forma de llamar al AI: sin sesión Supabase y sin EXPO_PUBLIC_GROQ_API_KEY',
    );
  }
  return chatCompletionDirectGroq(key, messages, opts);
}

async function chatCompletionViaProxy(
  proxyUrl: string,
  accessToken: string,
  messages: GroqMessage[],
  opts: GroqOptions,
): Promise<GroqCompletionChoice> {
  const body: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.jsonMode) body.json_mode = true;
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice ?? 'auto';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new GroqError('No se pudo contactar con el proxy AI', e);
  }
  clearTimeout(timer);

  if (res.status === 429) {
    const quotaErr = await parseQuotaError(res);
    if (quotaErr) throw quotaErr;
    throw new GroqError('AI proxy 429 (sin payload de cuota)');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GroqError(`AI proxy ${res.status}: ${text.slice(0, 300)}`);
  }

  let json: GroqCompletion;
  try {
    json = (await res.json()) as GroqCompletion;
  } catch (e) {
    throw new GroqError('Respuesta del proxy no era JSON', e);
  }
  const choice = json.choices?.[0];
  if (!choice) throw new GroqError('Proxy devolvió 0 choices');
  return choice;
}

async function chatCompletionDirectGroq(
  key: string,
  messages: GroqMessage[],
  opts: GroqOptions,
): Promise<GroqCompletionChoice> {
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
    res = await fetch(GROQ_ENDPOINT, {
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

async function parseQuotaError(res: Response): Promise<QuotaExceededError | null> {
  try {
    const body = (await res.json()) as {
      error?: string;
      tier?: 'free' | 'pro';
      dailyCap?: number;
      usedToday?: number;
      resetsAt?: string;
      upgradeAvailable?: boolean;
    };
    if (body.error !== 'quota_exceeded') return null;
    return new QuotaExceededError(
      body.tier ?? 'free',
      body.dailyCap ?? 0,
      body.usedToday ?? 0,
      body.resetsAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      body.upgradeAvailable ?? true,
    );
  } catch {
    return null;
  }
}

// ======================== TEXT-ONLY HELPER ========================

/**
 * Convenience for legacy call sites (coach.ts, insights.ts) that just want
 * the raw assistant text. Throws if the model returned tool_calls instead
 * of plain content (callers asking for text shouldn't be passing tools).
 */
export async function callGroq(messages: GroqMessage[], opts: GroqOptions = {}): Promise<string> {
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
  onDone?: (final: { text: string; toolCalls: StreamedToolCall[]; finishReason: string }) => void;
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
export async function streamChatCompletion(
  messages: GroqMessage[],
  opts: StreamOptions = {},
  callbacks: StreamCallbacks = {},
): Promise<GroqCompletionChoice> {
  const proxyUrl = getProxyEndpoint();
  const token = proxyUrl ? await getActiveAccessToken() : null;

  let endpoint: string;
  let authHeader: string;
  const body: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1024,
    stream: true,
  };

  if (proxyUrl && token) {
    endpoint = proxyUrl;
    authHeader = `Bearer ${token}`;
    if (opts.jsonMode) body.json_mode = true;
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? 'auto';
    }
  } else {
    const key = getGroqApiKey();
    if (!key) {
      return Promise.reject(
        new GroqError(
          'No hay forma de stream-llamar al AI: sin sesión Supabase y sin EXPO_PUBLIC_GROQ_API_KEY',
        ),
      );
    }
    endpoint = GROQ_ENDPOINT;
    authHeader = `Bearer ${key}`;
    body.model = opts.model ?? DEFAULT_MODEL;
    if (opts.jsonMode) body.response_format = { type: 'json_object' };
    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools;
      body.tool_choice = opts.toolChoice ?? 'auto';
    }
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

    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', authHeader);
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

        // 429 path — surface as QuotaExceededError so the UI can present
        // the paywall sheet without an extra round-trip.
        if (xhr.status === 429) {
          try {
            const parsed = JSON.parse(xhr.responseText) as {
              error?: string;
              tier?: 'free' | 'pro';
              dailyCap?: number;
              usedToday?: number;
              resetsAt?: string;
              upgradeAvailable?: boolean;
            };
            if (parsed.error === 'quota_exceeded') {
              const qe = new QuotaExceededError(
                parsed.tier ?? 'free',
                parsed.dailyCap ?? 0,
                parsed.usedToday ?? 0,
                parsed.resetsAt ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                parsed.upgradeAvailable ?? true,
              );
              callbacks.onError?.(qe as unknown as GroqError);
              settle(() => reject(qe));
              return;
            }
          } catch {
            /* fall through to generic error path */
          }
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          fail(
            new GroqError(
              `Upstream ${xhr.status}: ${xhr.responseText.slice(0, 300) || 'stream failed'}`,
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
