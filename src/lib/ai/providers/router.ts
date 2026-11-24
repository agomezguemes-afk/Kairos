// Chooses which model answers a request, and falls through on failure.
//
// Order per task (docs/research_notes/local-ai-2026-11.md §1):
// - goal:   short extraction into a closed schema; small on-device models
//           with constrained decoding do this well.
// - agent:  block edits through tools; Apple's 4K window fits only a few
//           tool definitions, so the downloaded model goes first.
// - coach:  short Spanish paraphrase of numbers the engine already computed.
// - review: the most quality-sensitive text; cloud first when allowed.
// Every chain ends in the caller's deterministic answer: a null result
// means "use the rules", never an error the person sees.

import type {
  AiTask,
  ChatRequest,
  ChatResult,
  LlmProvider,
  ProviderKind,
  RouteContext,
} from './types';

export const TASK_ORDER: Record<AiTask, ProviderKind[]> = {
  goal: ['apple', 'local', 'cloud'],
  agent: ['local', 'apple', 'cloud'],
  coach: ['apple', 'local', 'cloud'],
  review: ['cloud', 'local', 'apple'],
};

/** Why a provider was not tried, for logs and an internal inspector. */
export type SkipReason =
  | 'unavailable'
  | 'no-consent'
  | 'offline'
  | 'background'
  | 'too-hot'
  | 'no-json'
  | 'no-tools';

export interface RoutePlan {
  order: LlmProvider[];
  skipped: { id: string; reason: SkipReason }[];
}

function skipReason(p: LlmProvider, req: ChatRequest, ctx: RouteContext): SkipReason | null {
  if (!p.status().available) return 'unavailable';
  if (p.kind === 'cloud') {
    if (!ctx.cloudConsent) return 'no-consent';
    if (!ctx.online) return 'offline';
  } else {
    if (!ctx.foreground) return 'background';
    if (ctx.thermal === 'serious' || ctx.thermal === 'critical') return 'too-hot';
  }
  if (req.json && !p.capabilities.json) return 'no-json';
  if (req.tools?.length && !p.capabilities.tools) return 'no-tools';
  return null;
}

export function planRoute(
  task: AiTask,
  req: ChatRequest,
  providers: LlmProvider[],
  ctx: RouteContext,
): RoutePlan {
  const order: LlmProvider[] = [];
  const skipped: RoutePlan['skipped'] = [];
  for (const kind of TASK_ORDER[task]) {
    for (const p of providers.filter((x) => x.kind === kind)) {
      const reason = skipReason(p, req, ctx);
      if (reason) skipped.push({ id: p.id, reason });
      else order.push(p);
    }
  }
  return { order, skipped };
}

export interface RouteOptions<T> {
  /** Per attempt; a slow provider must not hold the next one back for long. */
  timeoutMs: number;
  /**
   * Turns a raw answer into the caller's value, or throws if it is unusable
   * (malformed JSON, a schema miss, an invented tool). Constrained decoding
   * guarantees syntax, not meaning, so every answer passes through here.
   */
  accept: (result: ChatResult) => T;
  /** Cancels the whole chain, e.g. when the screen that asked goes away. */
  signal?: AbortSignal;
}

export interface Routed<T> {
  value: T;
  providerId: string;
}

export interface Attempt {
  id: string;
  error: string;
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`sin respuesta en ${ms} ms`);
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Tries each eligible provider in order until one gives an answer `accept`
 * takes. Returns null when none did, so the caller falls back to its rules.
 * `attempts` collects what went wrong with each, for diagnostics.
 */
export async function routeChat<T>(
  task: AiTask,
  req: ChatRequest,
  providers: LlmProvider[],
  ctx: RouteContext,
  opts: RouteOptions<T>,
  attempts: Attempt[] = [],
): Promise<Routed<T> | null> {
  const { order } = planRoute(task, req, providers, ctx);
  for (const p of order) {
    if (opts.signal?.aborted) return null;
    try {
      const result = await withTimeout(p.complete({ ...req, signal: opts.signal }), opts.timeoutMs);
      return { value: opts.accept(result), providerId: p.id };
    } catch (e) {
      attempts.push({ id: p.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return null;
}
