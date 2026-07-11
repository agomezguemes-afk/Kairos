// KAIROS — Speech-to-text: shared types (M2, voz de entrada).
//
// The public boundary is a discriminated union, never a throw: the M3
// push-to-talk caller must always be able to branch into the tactile
// fallback on any failure without try/catch gymnastics mid-workout.

/** The recorded audio handed to the transcriber. */
export interface TranscribeInput {
  /** Local file URI from the recorder (file://…). */
  uri: string;
  /** Container MIME type, e.g. 'audio/m4a' (expo-audio's iOS default). */
  mimeType: string;
  /**
   * Recorded length in ms when the recorder knows it. Used to reject
   * empty recordings locally before paying for a network round trip.
   */
  durationMs?: number;
  /** Explicit file name; when absent one is derived from the MIME type. */
  fileName?: string;
}

export interface TranscribeOptions {
  /** ISO-639-1 hint. Spanish-first product → defaults to 'es'. */
  language?: string;
  /** Whisper model id; defaults to DEFAULT_STT_MODEL. */
  model?: string;
  /** Domain vocabulary hint (exercise names, "RPE", …). Max ~224 tokens. */
  prompt?: string;
  /** 0–1 sampling temperature; omit for Groq's default (0). */
  temperature?: number;
  /** Caller-side cancellation (e.g. user releases push-to-talk to discard). */
  signal?: AbortSignal;
  /** Hard cap override; defaults to DEFAULT_STT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Injectable usage tracker (tests / custom wiring). Defaults to the shared one. */
  usageTracker?: SttUsageTracker;
}

export type SttErrorKind =
  | 'unavailable' // no route to STT right now (no dev key / no proxy yet)
  | 'invalid_audio' // local validation failed, or upstream 4xx rejected the payload
  | 'auth' // 401/403 — key invalid or revoked
  | 'rate_limited' // 429
  | 'server' // 5xx
  | 'bad_response' // 2xx but the body was not the JSON shape we expect
  | 'network' // fetch itself failed (offline, DNS, TLS)
  | 'timeout' // hard latency cap hit
  | 'aborted' // caller's AbortSignal fired
  | 'empty'; // upstream succeeded but heard nothing (whitespace-only text)

export interface SttError {
  kind: SttErrorKind;
  /** Spanish, safe to surface directly in UI copy. */
  message: string;
  /** HTTP status when the upstream answered. */
  status?: number;
  /** True when retrying the same audio might succeed (transient failure). */
  retryable: boolean;
  cause?: unknown;
}

export interface TranscribeSuccess {
  ok: true;
  /** Trimmed transcription. Never empty — whitespace-only maps to kind 'empty'. */
  text: string;
  /** Wall-clock latency of the STT round trip in ms (M2 budget: <3s). */
  durationMs: number;
  /** Language Whisper detected (verbose_json), or null when unreported. */
  language: string | null;
}

export type TranscribeResult = TranscribeSuccess | { ok: false; error: SttError };

/**
 * Rolling-24h on-device counter for STT calls. On-device because the
 * ai-chat proxy doesn't handle audio yet: server-side recording lands
 * with the future ai-stt Edge Function; until then this keeps the quota
 * pill honest about voice usage.
 */
export interface SttUsageTracker {
  /** Count one processed transcription. Must never throw. */
  record(now?: number): Promise<void>;
  /** Calls within the last 24h. Must never throw. */
  count24h(now?: number): Promise<number>;
  clear(): Promise<void>;
}
