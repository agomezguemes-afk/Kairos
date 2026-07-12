// KAIROS — Groq Whisper speech-to-text client (M2/M2b, voz de entrada).
//
// Mirrors client.ts conventions (proxy-first routing, dev-fallback key,
// AbortController timeout, Spanish error copy) but returns a
// discriminated union instead of throwing: mid-workout the caller must
// always be able to fall back to tactile input, so no failure mode
// crosses this boundary as an exception.
//
// Transport routing (same order as the chat client):
//   1. ai-stt Edge Function — whenever a Supabase session exists. The
//      Groq key stays server-side; the proxy whitelists the model and
//      bounds the payload. Works in Release/TestFlight.
//   2. Direct Groq — dev builds only, via readDevGroqKey() (SKIP_AUTH
//      sessions without a backend). Never active in a release build.
//   3. Neither → kind 'unavailable'.
// Both transports speak the same multipart wire format and the same
// status→SttError mapping, so everything below the route resolution is
// transport-agnostic.

import { readDevGroqKey } from '../devFallback';
import { sharedSttUsageTracker } from './quota';
import type {
  SttError,
  SttErrorKind,
  SttSessionAuth,
  TranscribeInput,
  TranscribeOptions,
  TranscribeResult,
} from './types';

export const GROQ_STT_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';

export const STT_PROXY_PATH = '/functions/v1/ai-stt';

// Same convention as client.ts: the Supabase URL is already a public
// identifier, and the proxy lives on the standard Edge Functions path.
function getSttProxyEndpoint(): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, '')}${STT_PROXY_PATH}`;
}

// Session access is lazy-required (not statically imported) so this
// module doesn't drag the supabase/react-native graph into node unit
// tests — same pattern as quota.ts and conversation/defaultDeps.ts.
// In node the require throws, which correctly reads as "no session".
function defaultSessionAuth(): SttSessionAuth {
  return {
    hasSession: () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../client') as typeof import('../client');
        return mod.hasActiveSession();
      } catch {
        return false;
      }
    },
    getToken: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('../client') as typeof import('../client');
        return await mod.getActiveAccessToken();
      } catch {
        return null;
      }
    },
  };
}

interface SttRoute {
  endpoint: string;
  bearer: string;
  via: 'proxy' | 'direct';
}

// Proxy first (production path, server-side key + limits), dev key as
// the fallback, null when neither. getToken() is consulted even when
// the sync cache is cold — client.ts seeds it from storage on demand,
// so a cold start still finds the proxy route.
async function resolveSttRoute(auth: SttSessionAuth): Promise<SttRoute | null> {
  const proxyUrl = getSttProxyEndpoint();
  if (proxyUrl) {
    const token = await auth.getToken();
    if (token) return { endpoint: proxyUrl, bearer: token, via: 'proxy' };
  }
  const devKey = readDevGroqKey();
  if (devKey) return { endpoint: GROQ_STT_ENDPOINT, bearer: devKey, via: 'direct' };
  return null;
}

/**
 * turbo: $0.04/audio-hour, ~12% WER — adequate for short Spanish
 * push-to-talk utterances and 2.8× cheaper than whisper-large-v3.
 * Override via options if accuracy ever beats cost.
 */
export const DEFAULT_STT_MODEL = 'whisper-large-v3-turbo';

export const DEFAULT_STT_LANGUAGE = 'es';

/**
 * M2 budget is <3s utterance→text; Groq inference for a short clip is
 * sub-second, so past ~2.5× the budget the UX is already broken and the
 * tactile fallback beats waiting. 8s = budget + gym-LTE upload margin.
 */
export const DEFAULT_STT_TIMEOUT_MS = 8_000;

/**
 * True when a transcription call can be attempted right now — either the
 * ai-stt proxy is reachable (Supabase session present) or the dev-direct
 * key exists. Synchronous: uses the cached session check, same caveat as
 * client.ts isAIAvailable (a just-signed-in user may lag one tick).
 */
export function isSttAvailable(auth: SttSessionAuth = defaultSessionAuth()): boolean {
  if (getSttProxyEndpoint() !== null && auth.hasSession()) return true;
  return readDevGroqKey() !== null;
}

// Whether retrying the same audio might succeed, per failure kind.
// Table (vs scattered flags) so the taxonomy stays auditable in one place.
const RETRYABLE: Record<SttErrorKind, boolean> = {
  unavailable: false,
  invalid_audio: false,
  auth: false,
  rate_limited: true,
  server: true,
  bad_response: true,
  network: true,
  timeout: true,
  aborted: false,
  empty: true,
};

function failure(
  kind: SttErrorKind,
  message: string,
  extra: { status?: number; cause?: unknown } = {},
): TranscribeResult {
  const error: SttError = { kind, message, retryable: RETRYABLE[kind], ...extra };
  return { ok: false, error };
}

// Groq infers the audio container from the file name extension, so a
// wrong extension (not a wrong MIME header) is what breaks decoding.
const EXT_BY_MIME: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

function fileNameFor(input: TranscribeInput): string {
  const explicit = input.fileName?.trim();
  if (explicit) return explicit;
  const mime = input.mimeType.split(';')[0].trim().toLowerCase();
  // expo-audio records AAC-in-m4a by default on iOS, hence the fallback.
  return `utterance.${EXT_BY_MIME[mime] ?? 'm4a'}`;
}

/**
 * Transcribe one recorded utterance via Groq Whisper.
 *
 * Never throws: every outcome is a TranscribeResult. Successful API
 * calls (including empty transcriptions — Groq bills processed audio
 * either way) are counted against the STT quota tracker.
 */
export async function transcribeAudio(
  input: TranscribeInput,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const route = await resolveSttRoute(opts.auth ?? defaultSessionAuth());
  if (!route) {
    return failure(
      'unavailable',
      'La transcripción de voz no está disponible ahora mismo (sin sesión y sin acceso directo al servicio STT)',
    );
  }

  const uri = input.uri.trim();
  if (!uri) return failure('invalid_audio', 'URI de audio vacío');
  if (!input.mimeType.trim()) return failure('invalid_audio', 'Tipo MIME de audio vacío');
  if (input.durationMs !== undefined && !(input.durationMs > 0)) {
    return failure('invalid_audio', 'La grabación está vacía (duración 0)');
  }
  if (opts.signal?.aborted) return failure('aborted', 'Transcripción cancelada');

  const form = new FormData();
  // RN's FormData accepts a {uri,name,type} descriptor for file parts;
  // the standard lib typing doesn't model it, so append through a
  // minimal structural view instead of `any`.
  const appendable = form as unknown as { append(name: string, value: unknown): void };
  appendable.append('file', { uri, name: fileNameFor(input), type: input.mimeType });
  form.append('model', opts.model ?? DEFAULT_STT_MODEL);
  form.append('language', opts.language ?? DEFAULT_STT_LANGUAGE);
  // verbose_json is the only format that reports the detected language.
  form.append('response_format', 'verbose_json');
  const prompt = opts.prompt?.trim();
  if (prompt) form.append('prompt', prompt);
  if (opts.temperature !== undefined) form.append('temperature', String(opts.temperature));

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_STT_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onCallerAbort);

  const startedAt = Date.now();
  let res: Response;
  try {
    // Same wire format on both routes: the proxy accepts Groq's own field
    // names and forwards the multipart body (bearer = Supabase JWT there,
    // Groq key on the dev-direct path).
    res = await fetch(route.endpoint, {
      method: 'POST',
      // No Content-Type header: fetch must set the multipart boundary itself.
      headers: { Authorization: `Bearer ${route.bearer}` },
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) return failure('timeout', 'La transcripción tardó demasiado', { cause: e });
    if (opts.signal?.aborted) return failure('aborted', 'Transcripción cancelada', { cause: e });
    return failure('network', 'No se pudo contactar con el servicio de voz', { cause: e });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onCallerAbort);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = body.slice(0, 300);
    if (res.status === 401 || res.status === 403) {
      return failure('auth', `Credenciales STT rechazadas (${res.status}): ${detail}`, {
        status: res.status,
      });
    }
    if (res.status === 429) {
      return failure('rate_limited', 'El servicio de voz está saturado, prueba en unos segundos', {
        status: res.status,
      });
    }
    if (res.status >= 500) {
      return failure('server', `El servicio de voz falló (${res.status}): ${detail}`, {
        status: res.status,
      });
    }
    return failure(
      'invalid_audio',
      `El servicio de voz rechazó el audio (${res.status}): ${detail}`,
      {
        status: res.status,
      },
    );
  }

  // From here on Groq has processed (and billed) the audio → count it,
  // even if the transcription turns out empty.
  const tracker = opts.usageTracker ?? sharedSttUsageTracker();
  try {
    await tracker.record();
  } catch {
    // Quota tracking must never break the voice loop.
  }

  let json: { text?: unknown; language?: unknown };
  try {
    json = (await res.json()) as { text?: unknown; language?: unknown };
  } catch (e) {
    return failure('bad_response', 'La respuesta del servicio de voz no era JSON', { cause: e });
  }
  if (typeof json.text !== 'string') {
    return failure('bad_response', 'La respuesta del servicio de voz no trae texto');
  }

  const text = json.text.trim();
  if (text.length === 0) {
    return failure('empty', 'No se oyó nada — prueba a hablar más cerca del micrófono');
  }

  return {
    ok: true,
    text,
    durationMs: Date.now() - startedAt,
    language: typeof json.language === 'string' ? json.language : null,
  };
}
