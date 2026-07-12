// KAIROS — STT proxy Edge Function (ai-stt).
//
// One job: authenticate the user, validate + bound the uploaded audio,
// then forward it to Groq's Whisper transcription endpoint with the
// server-side key. Mirrors ai-chat's auth and error conventions so the
// client (src/lib/ai/stt/transcribe.ts) shares one status→SttError
// mapping across both transports (proxy and dev-direct).
//
// Wire format: multipart/form-data with the same field names as Groq's
// own endpoint (file, model, language, prompt, temperature), so the
// client builds ONE FormData regardless of transport. Client values are
// hints, never trusted: the model is whitelisted, the prompt is bounded,
// temperature is clamped, and response_format is forced server-side.
//
// Status mapping contract with the client (transcribe.ts taxonomy):
//   401 → auth            (caller's Supabase JWT missing/invalid)
//   400/413 → invalid_audio (payload rejected, here or upstream)
//   429 → rate_limited     (Groq rate limit passed through)
//   5xx → server           (misconfig, upstream 5xx, upstream unreachable)
// Groq 401/403 (OUR key bad) deliberately maps to 502, not 401 — the
// caller's credentials are fine, the server is misconfigured.
//
// Quota: intentionally NOT recorded in ai_quota. ai_quota_reserve counts
// every ledger row against the chat dailyCap with no per-model weighting,
// so inserting STT rows here would burn one full chat unit per utterance —
// contradicting the deliberate 0.2-unit STT weighting on the client
// (src/lib/ai/stt/quota.ts, folded into the pill by useAiQuota). STT
// usage stays client-counted until a weighted STT ledger RPC exists.
// Server-side abuse bounds meanwhile: JWT auth, 10MB size cap, model
// whitelist, and per-call upstream timeout.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const GROQ_STT_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const UPSTREAM_TIMEOUT_MS = 30_000;

/**
 * Hard cap on the uploaded audio file. ~10 minutes of 128kbps m4a — far
 * above any push-to-talk utterance, well below Groq's own 25MB limit.
 */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
// Cheap pre-parse guard: audio cap + slack for multipart boundaries/fields.
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

const DEFAULT_MODEL = 'whisper-large-v3-turbo';
const ALLOWED_MODELS = new Set([DEFAULT_MODEL, 'whisper-large-v3']);

// Whisper prompts are truncated to ~224 tokens upstream anyway; bounding
// characters here keeps a hostile client from shipping a megabyte "hint".
const MAX_PROMPT_CHARS = 1_000;

// ISO-639-1/2 code, optionally with a region tag. Invalid hints are
// dropped (not rejected) — language is advisory, Whisper auto-detects.
const LANGUAGE_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,8})?$/;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // ── 1. Authenticate (same pattern as ai-chat) ─────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('[ai-stt] missing supabase env vars');
    return json({ error: 'server_misconfigured' }, 500);
  }

  // User-scoped client (anon + caller JWT) just to verify the token. No
  // service-role client here: ai-stt does no privileged DB work (see the
  // quota note in the header).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult?.user) {
    return json({ error: 'invalid_token' }, 401);
  }
  const userId = userResult.user.id;

  // ── 2. Parse + bound the multipart payload ────────────────────────
  const declaredLen = Number(req.headers.get('content-length') ?? 0);
  if (declaredLen > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large', maxBytes: MAX_AUDIO_BYTES }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // Wrong content-type or malformed multipart body.
    return json({ error: 'invalid_form_data' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: 'missing_audio' }, 400);
  }
  // Content-Length includes multipart overhead; the file's own size is
  // the authoritative check against the audio cap.
  if (file.size > MAX_AUDIO_BYTES) {
    return json({ error: 'audio_too_large', maxBytes: MAX_AUDIO_BYTES }, 413);
  }

  const modelRaw = form.get('model');
  const model = typeof modelRaw === 'string' && modelRaw.trim() ? modelRaw.trim() : DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(model)) {
    return json({ error: 'model_not_allowed', allowed: [...ALLOWED_MODELS] }, 400);
  }

  const languageRaw = form.get('language');
  const language =
    typeof languageRaw === 'string' && LANGUAGE_RE.test(languageRaw.trim())
      ? languageRaw.trim()
      : null;

  const promptRaw = form.get('prompt');
  const prompt =
    typeof promptRaw === 'string' && promptRaw.trim()
      ? promptRaw.trim().slice(0, MAX_PROMPT_CHARS)
      : null;

  const temperature = clampFloat(form.get('temperature'), 0, 1);

  // ── 3. Forward to Groq with the server-side key ───────────────────
  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) {
    console.error('[ai-stt] GROQ_API_KEY not set');
    return json({ error: 'upstream_misconfigured' }, 500);
  }

  const upstream = new FormData();
  // Groq detects the audio container from the file NAME extension, so the
  // client's file name must survive the hop (transcribe.ts derives it
  // from the MIME type when the recorder doesn't provide one).
  upstream.append('file', file, file.name || 'utterance.m4a');
  upstream.append('model', model);
  // verbose_json is the only format that reports the detected language;
  // forced here so a client can't switch the shape the app parses.
  upstream.append('response_format', 'verbose_json');
  if (language) upstream.append('language', language);
  if (prompt) upstream.append('prompt', prompt);
  if (temperature !== null) upstream.append('temperature', String(temperature));

  let upstreamRes: Response;
  try {
    upstreamRes = await fetchWithTimeout(GROQ_STT_ENDPOINT, {
      method: 'POST',
      // No Content-Type header: fetch sets the multipart boundary itself.
      headers: { Authorization: `Bearer ${groqKey}` },
      body: upstream,
    });
  } catch (e) {
    console.warn('[ai-stt] upstream fetch failed', e);
    return json({ error: 'upstream_unreachable' }, 504);
  }

  if (!upstreamRes.ok) {
    // Log the provider's detail server-side, never echo it to the client
    // (same stance as ai-chat: upstream bodies can leak internals).
    const detail = await upstreamRes.text().catch(() => '');
    console.warn('[ai-stt] upstream error', upstreamRes.status, detail.slice(0, 500));

    if (upstreamRes.status === 429) {
      return json({ error: 'upstream_rate_limited' }, 429);
    }
    if (upstreamRes.status === 401 || upstreamRes.status === 403) {
      // OUR key was rejected — server misconfig, not the caller's fault.
      return json({ error: 'upstream_misconfigured' }, 502);
    }
    if (upstreamRes.status >= 400 && upstreamRes.status < 500) {
      return json({ error: 'upstream_rejected_audio', status: upstreamRes.status }, 400);
    }
    return json({ error: 'upstream_error', status: upstreamRes.status }, 502);
  }

  // Cheap observability while usage counting stays client-side.
  console.info('[ai-stt] ok', { userId, model, bytes: file.size });

  // ── 4. Pass Groq's verbose_json straight through ──────────────────
  return new Response(upstreamRes.body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// ── Helpers ─────────────────────────────────────────────────────────

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Clamp a client-supplied float into [min, max]; null when absent/NaN. */
function clampFloat(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
