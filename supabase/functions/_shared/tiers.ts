// KAIROS — Tier policy (server-side source of truth).
//
// Cap = max AI calls per rolling 24h window. Numbers are intentionally
// conservative for free: cheap to revise upward once Groq usage data
// confirms headroom. Pro starts at 500/day which is ~3 messages per
// active minute of use — well above any organic single-user pattern.
//
// model = upstream model id. Free goes to Groq's free Llama 70B (fast,
// no card required). Pro goes to a stronger model — placeholder is
// Claude Sonnet 4.6 via Anthropic; swappable to GPT or Gemini without
// changing the proxy contract.

export type Tier = 'free' | 'pro';

export interface TierPolicy {
  /** Max calls per rolling 24h window. */
  dailyCap: number;
  /** Which provider to route to. */
  provider: 'groq' | 'anthropic' | 'openai';
  /** Provider-specific model identifier. */
  model: string;
  /**
   * Hard ceiling on output tokens per call. The client requests a value but
   * the server clamps to this — without it a single call (limited only by
   * count) could request a huge completion and amplify cost far beyond what
   * the daily-call cap implies.
   */
  maxOutputTokens: number;
}

export const TIER_POLICY: Record<Tier, TierPolicy> = {
  free: {
    dailyCap: 30,
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxOutputTokens: 1024,
  },
  pro: {
    dailyCap: 500,
    provider: 'anthropic',
    // Wire Anthropic key in env when RevenueCat ships and we have real
    // Pro subscribers. Until then this branch is unreachable in practice
    // (no user has pro tier in DB yet) but the policy is checked-in so
    // the day-one-of-Pro doesn't require a migration.
    model: 'claude-sonnet-4-6',
    maxOutputTokens: 2048,
  },
};

// Request-shape limits shared across tiers. These bound the proxy's attack
// surface independent of the per-tier quota: a single authenticated call
// still can't ship an unbounded prompt.
export const REQUEST_LIMITS = {
  /** Max messages in one chat request. */
  maxMessages: 64,
  /** Max total characters across all message contents (~ a few hundred KB). */
  maxTotalChars: 200_000,
  /** Max raw request body size in bytes (cheap pre-parse guard). */
  maxBodyBytes: 512_000,
} as const;
