// KAIROS — Direct-Groq dev fallback gate (security boundary).
//
// The app can reach the LLM two ways:
//   1. The Supabase "ai-chat" Edge Function (production path). The Groq /
//      Anthropic key lives only on the server; the client sends a JWT and
//      the server enforces the per-tier 24h quota / paywall.
//   2. A direct call to Groq using EXPO_PUBLIC_GROQ_API_KEY (this module).
//
// Path 2 is a DEVELOPMENT-ONLY convenience so a SKIP_AUTH session can hit
// the model without running the backend. It must never run in a release
// build, because:
//   - Any `EXPO_PUBLIC_*` value referenced in code is inlined into the JS
//     bundle by Metro and is trivially extractable from a shipped app —
//     so a release build that read this key would leak it to every user.
//   - With the key in hand a user bypasses the server quota/paywall
//     entirely by calling Groq directly.
//
// `__DEV__` is the right gate: Metro defines it as the literal `false` in
// every release (production AND staging) build, so the guard below
// constant-folds to `return null` and the `process.env` read — and thus
// the key reference — is dead-code-eliminated out of the production
// bundle. The build-time guard in app.config.ts is the second layer: it
// fails a production build outright if the key is present in the env.

/** True only in a development build. Never true in staging/production. */
export function isDevFallbackAllowed(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * The Groq key for the dev fallback, or null. Returns null in every
 * non-dev build regardless of whether the env var is set, so a release
 * build can never use (or, after minification, even contain) the key.
 */
export function readDevGroqKey(): string | null {
  // Direct literal check (not the helper) so Metro can fold this to
  // `return null` in production and strip the read below.
  if (typeof __DEV__ === 'undefined' || __DEV__ !== true) return null;
  const k = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  return typeof k === 'string' && k.trim().length > 0 ? k.trim() : null;
}
