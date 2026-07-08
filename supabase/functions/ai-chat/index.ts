// KAIROS — AI chat proxy Edge Function.
//
// One job: authenticate the user, check their 24h quota against their
// tier policy, then proxy the chat completion to the upstream provider
// (Groq for free, Anthropic for pro). The upstream API key never leaves
// the server; the client only ever sees this function.
//
// Wire format intentionally mirrors the OpenAI/Groq chat-completions
// shape (messages, tools, tool_choice, json_mode, stream) so the
// existing client code in src/lib/ai/client.ts can move to this proxy
// with a single URL swap.
//
// Quota semantics:
//   1. Count current 24h calls via ai_quota_count_24h RPC.
//   2. If count >= cap → return 429 with reset hint. Pro upsell flag in
//      the body so the app can present the paywall.
//   3. Otherwise call upstream. On success insert into ai_quota AFTER
//      the call returns — failed calls (5xx, timeouts) do NOT burn
//      quota.
//   4. Stream responses pass through as text/event-stream; non-stream
//      responses are returned as JSON.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { REQUEST_LIMITS, TIER_POLICY, type Tier } from '../_shared/tiers.ts';

interface ChatRequest {
  messages: Array<Record<string, unknown>>;
  tools?: unknown[];
  tool_choice?: unknown;
  json_mode?: boolean;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  /** Override the model — currently ignored (server picks per tier). */
  model?: string;
}

interface QuotaExceededBody {
  error: 'quota_exceeded';
  tier: Tier;
  dailyCap: number;
  usedToday: number;
  resetsAt: string;
  upgradeAvailable: boolean;
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const UPSTREAM_TIMEOUT_MS = 60_000;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // ── 1. Authenticate ────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('[ai-chat] missing supabase env vars');
    return json({ error: 'server_misconfigured' }, 500);
  }

  // user-scoped client (anon + caller JWT) just to identify the user.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult?.user) {
    return json({ error: 'invalid_token' }, 401);
  }
  const userId = userResult.user.id;

  // service-role client for DB reads + writes that bypass RLS (quota,
  // tier lookup). Never expose this client outside the function.
  const adminClient = createClient(supabaseUrl, serviceKey);

  // ── 2. Look up tier ────────────────────────────────────────────────
  const { data: profileRow, error: profileErr } = await adminClient
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  // A missing profile row defaults to free — better than 500 for users
  // mid-onboarding who haven't created their profile row yet.
  if (profileErr && profileErr.code !== 'PGRST116') {
    console.error('[ai-chat] profile lookup failed', profileErr);
    return json({ error: 'profile_lookup_failed' }, 500);
  }
  const tier: Tier = (profileRow?.subscription_tier as Tier) ?? 'free';
  const policy = TIER_POLICY[tier];

  // ── 3. Parse + validate request body ──────────────────────────────
  // Validate BEFORE reserving a quota slot — a malformed request must not burn
  // the caller's quota.
  // Cheap pre-parse guard: reject oversized bodies before reading them.
  const declaredLen = Number(req.headers.get('content-length') ?? 0);
  if (declaredLen > REQUEST_LIMITS.maxBodyBytes) {
    return json({ error: 'payload_too_large' }, 413);
  }

  let payload: ChatRequest;
  try {
    payload = (await req.json()) as ChatRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return json({ error: 'missing_messages' }, 400);
  }
  if (payload.messages.length > REQUEST_LIMITS.maxMessages) {
    return json({ error: 'too_many_messages' }, 400);
  }
  // Bound total prompt size — the daily-call cap limits frequency, this
  // limits the cost of any single call.
  const totalChars = payload.messages.reduce((sum, m) => {
    const c = (m as { content?: unknown }).content;
    return sum + (typeof c === 'string' ? c.length : 0);
  }, 0);
  if (totalChars > REQUEST_LIMITS.maxTotalChars) {
    return json({ error: 'payload_too_large' }, 413);
  }

  // Clamp generation params server-side — never trust client values. Output
  // tokens are capped per tier (cost control); temperature to a sane range.
  const maxTokens = clampInt(payload.max_tokens, 1, policy.maxOutputTokens, policy.maxOutputTokens);
  const temperature = clampFloat(payload.temperature, 0, 2, 0.6);

  // ── 4. Reserve a quota slot atomically ────────────────────────────
  // The reserve RPC counts + inserts under a per-user advisory lock, so
  // concurrent bursts can't all slip past the cap (TOCTOU). The reserved row
  // is the ledger row: finalized on success, released on upstream failure.
  const { data: reserveData, error: reserveErr } = await adminClient.rpc('ai_quota_reserve', {
    p_user_id: userId,
    p_cap: policy.dailyCap,
    p_tier: tier,
    p_provider: policy.provider,
    p_model: policy.model,
  });
  if (reserveErr) {
    console.error('[ai-chat] quota reserve failed', reserveErr);
    return json({ error: 'quota_check_failed' }, 500);
  }
  const reservation = (Array.isArray(reserveData) ? reserveData[0] : reserveData) as
    | { allowed: boolean; used_today: number; reservation_id: number | null; oldest_used_at: string | null }
    | undefined;

  if (!reservation?.allowed) {
    const oldest = reservation?.oldest_used_at;
    const resetsAt = oldest
      ? new Date(new Date(oldest).getTime() + 24 * 3600 * 1000).toISOString()
      : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const body: QuotaExceededBody = {
      error: 'quota_exceeded',
      tier,
      dailyCap: policy.dailyCap,
      usedToday: reservation?.used_today ?? policy.dailyCap,
      resetsAt,
      upgradeAvailable: tier === 'free',
    };
    return json(body, 429);
  }
  const reservationId = reservation.reservation_id;

  // ── 5. Proxy upstream ─────────────────────────────────────────────
  // A quota slot is now reserved. Every failure path below must release it so
  // a failed call doesn't burn the user's quota.
  let upstreamRes: Response;
  try {
    if (policy.provider === 'groq') {
      const groqKey = Deno.env.get('GROQ_API_KEY');
      if (!groqKey) {
        console.error('[ai-chat] GROQ_API_KEY not set');
        return await releaseAndJson(adminClient, userId, reservationId, {
          error: 'upstream_misconfigured',
        }, 500);
      }
      const body: Record<string, unknown> = {
        model: policy.model,
        messages: payload.messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (payload.json_mode) body.response_format = { type: 'json_object' };
      if (payload.tools) {
        body.tools = payload.tools;
        body.tool_choice = payload.tool_choice ?? 'auto';
      }
      if (payload.stream) body.stream = true;

      upstreamRes = await fetchWithTimeout(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
          ...(payload.stream ? { Accept: 'text/event-stream' } : {}),
        },
        body: JSON.stringify(body),
      });
    } else if (policy.provider === 'anthropic') {
      // Wired but unreachable until we have a Pro subscriber. Kept here
      // so production day-one of Pro doesn't need an emergency redeploy.
      const anthKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!anthKey) {
        console.error('[ai-chat] ANTHROPIC_API_KEY not set (pro tier user)');
        return await releaseAndJson(adminClient, userId, reservationId, {
          error: 'upstream_misconfigured',
        }, 500);
      }
      // Anthropic API differs from OpenAI wire — translate minimally.
      const sysMessage = payload.messages.find((m) => (m as { role: string }).role === 'system');
      const nonSys = payload.messages.filter((m) => (m as { role: string }).role !== 'system');
      const body: Record<string, unknown> = {
        model: policy.model,
        max_tokens: maxTokens,
        temperature,
        messages: nonSys,
        ...(sysMessage ? { system: (sysMessage as { content: string }).content } : {}),
      };
      if (payload.stream) body.stream = true;

      upstreamRes = await fetchWithTimeout(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
    } else {
      return await releaseAndJson(adminClient, userId, reservationId, {
        error: 'unsupported_provider',
      }, 500);
    }
  } catch (e) {
    // Network failure / timeout (AbortError) — the call never completed, so
    // release the reservation.
    console.warn('[ai-chat] upstream fetch failed', e);
    return await releaseAndJson(adminClient, userId, reservationId, {
      error: 'upstream_unreachable',
    }, 504);
  }

  if (!upstreamRes.ok) {
    // Log the provider's detail server-side for debugging, but never echo it
    // to the client — upstream error bodies can carry internal request ids,
    // rate-limit headers, or account hints we don't want to expose.
    const text = await upstreamRes.text().catch(() => '');
    console.warn('[ai-chat] upstream error', upstreamRes.status, text.slice(0, 500));
    return await releaseAndJson(adminClient, userId, reservationId, {
      error: 'upstream_error',
      status: upstreamRes.status,
    }, 502);
  }

  // ── 6. Finalize quota + return response ───────────────────────────
  // The reservation row already counts this call against the cap. For streamed
  // responses we can't easily count tokens here, so the row keeps tokens=0 (the
  // call-count quota gate is unaffected; provider dashboards have exact token
  // counts for billing). For non-streamed we finalize the token count.
  if (payload.stream) {
    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const responseJson = (await upstreamRes.json()) as Record<string, unknown>;
  const usage = responseJson.usage as { total_tokens?: number } | undefined;
  const tokensUsed = usage?.total_tokens ?? 0;

  await finalizeReservation(adminClient, userId, reservationId, tokensUsed);

  return new Response(JSON.stringify(responseJson), {
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

/** Clamp a client-supplied integer into [min, max], falling back when absent/NaN. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Clamp a client-supplied float into [min, max], falling back when absent/NaN. */
function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
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

/** Undo a reservation when the upstream call failed — failed calls don't burn quota. */
async function releaseReservation(
  admin: ReturnType<typeof createClient>,
  userId: string,
  reservationId: number | null,
): Promise<void> {
  if (reservationId === null || reservationId === undefined) return;
  const { error } = await admin.rpc('ai_quota_release', {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
  if (error) console.error('[ai-chat] failed to release reservation', error);
}

/** Release the reservation, then return the error response. */
async function releaseAndJson(
  admin: ReturnType<typeof createClient>,
  userId: string,
  reservationId: number | null,
  body: unknown,
  status: number,
): Promise<Response> {
  await releaseReservation(admin, userId, reservationId);
  return json(body, status);
}

/** Record the real token count on a reserved row after a successful call. */
async function finalizeReservation(
  admin: ReturnType<typeof createClient>,
  userId: string,
  reservationId: number | null,
  tokens: number,
): Promise<void> {
  if (reservationId === null || reservationId === undefined) return;
  const { error } = await admin.rpc('ai_quota_finalize', {
    p_user_id: userId,
    p_reservation_id: reservationId,
    p_tokens: tokens,
  });
  if (error) {
    // The user already got their response; an unfinalized token count only
    // affects cost analytics, not the call-count quota gate.
    console.error('[ai-chat] failed to finalize reservation', error);
  }
}
