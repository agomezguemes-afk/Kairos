import { describe, expect, it, vi } from 'vitest';

import { estimateTokens, planRoute, routeChat } from './router';
import type { ChatResult, LlmProvider, ProviderKind, RouteContext } from './types';

const ctx: RouteContext = {
  online: true,
  cloudConsent: true,
  foreground: true,
  thermal: 'nominal',
};

function fake(
  id: string,
  kind: ProviderKind,
  reply: () => Promise<ChatResult>,
  opts: { available?: boolean; json?: boolean; tools?: boolean } = {},
): LlmProvider & { calls: number } {
  const p = {
    id,
    kind,
    calls: 0,
    capabilities: { json: opts.json ?? true, tools: opts.tools ?? true, contextTokens: 4096 },
    status: () => ({ available: opts.available ?? true }),
    complete: () => {
      p.calls++;
      return reply();
    },
  };
  return p;
}

const ok = (content: string) => () => Promise.resolve({ content });
const fail = (msg: string) => () => Promise.reject(new Error(msg));
const req = { messages: [{ role: 'user' as const, content: 'hola' }] };
const accept = (r: ChatResult) => r.content ?? '';

describe('planRoute', () => {
  const apple = fake('apple', 'apple', ok('a'));
  const local = fake('llama', 'local', ok('l'));
  const cloud = fake('groq', 'cloud', ok('c'));
  const all = [cloud, local, apple];
  const ids = (p: { order: LlmProvider[] }) => p.order.map((x) => x.id);

  it('orders providers by the task policy, not by registration', () => {
    expect(ids(planRoute('goal', req, all, ctx))).toEqual(['apple', 'llama', 'groq']);
    expect(ids(planRoute('agent', req, all, ctx))).toEqual(['llama', 'apple', 'groq']);
    expect(ids(planRoute('review', req, all, ctx))).toEqual(['groq', 'llama', 'apple']);
  });

  it('never sends anything to the cloud without consent', () => {
    const plan = planRoute('review', req, all, { ...ctx, cloudConsent: false });
    expect(ids(plan)).toEqual(['llama', 'apple']);
    expect(plan.skipped).toContainEqual({ id: 'groq', reason: 'no-consent' });
  });

  it('skips the cloud offline and on-device models in the background or when hot', () => {
    expect(ids(planRoute('goal', req, all, { ...ctx, online: false }))).toEqual(['apple', 'llama']);
    expect(ids(planRoute('goal', req, all, { ...ctx, foreground: false }))).toEqual(['groq']);
    expect(ids(planRoute('goal', req, all, { ...ctx, thermal: 'serious' }))).toEqual(['groq']);
  });

  it('skips providers that cannot do what the request needs', () => {
    const noTools = fake('tiny', 'local', ok('t'), { tools: false });
    const tools = [
      { type: 'function' as const, function: { name: 'x', description: '', parameters: {} } },
    ];
    const plan = planRoute('agent', { ...req, tools }, [noTools, cloud], ctx);
    expect(ids(plan)).toEqual(['groq']);
    expect(plan.skipped).toContainEqual({ id: 'tiny', reason: 'no-tools' });
  });

  it('skips unavailable providers', () => {
    const missing = fake('llama', 'local', ok('l'), { available: false });
    expect(ids(planRoute('goal', req, [missing, cloud], ctx))).toEqual(['groq']);
  });
});

describe('routeChat', () => {
  it('falls through to the next provider when one fails', async () => {
    const local = fake('llama', 'local', fail('jetsam'));
    const cloud = fake('groq', 'cloud', ok('nube'));
    const attempts: { id: string; error: string }[] = [];
    const r = await routeChat(
      'goal',
      req,
      [local, cloud],
      ctx,
      { timeoutMs: 1000, accept },
      attempts,
    );
    expect(r).toEqual({ value: 'nube', providerId: 'groq' });
    expect(attempts).toEqual([{ id: 'llama', error: 'jetsam' }]);
  });

  it('an answer the caller rejects counts as a failure', async () => {
    const local = fake('llama', 'local', ok('no es json'));
    const cloud = fake('groq', 'cloud', ok('{"ok":true}'));
    const r = await routeChat('goal', req, [local, cloud], ctx, {
      timeoutMs: 1000,
      accept: (x) => JSON.parse(x.content ?? '') as { ok: boolean },
    });
    expect(r?.value).toEqual({ ok: true });
    expect(r?.providerId).toBe('groq');
  });

  it('a provider that hangs is abandoned after its timeout', async () => {
    vi.useFakeTimers();
    const hung = fake('llama', 'local', () => new Promise<ChatResult>(() => {}));
    const cloud = fake('groq', 'cloud', ok('nube'));
    const pending = routeChat('goal', req, [hung, cloud], ctx, { timeoutMs: 500, accept });
    await vi.advanceTimersByTimeAsync(500);
    expect((await pending)?.providerId).toBe('groq');
    vi.useRealTimers();
  });

  it('returns null when nothing answers, so the caller uses its rules', async () => {
    const cloud = fake('groq', 'cloud', fail('429'));
    expect(await routeChat('goal', req, [cloud], ctx, { timeoutMs: 1000, accept })).toBeNull();
  });

  it('stops trying once the caller cancels', async () => {
    const controller = new AbortController();
    const first = fake('llama', 'local', () => {
      controller.abort();
      return Promise.reject(new Error('cancelled'));
    });
    const cloud = fake('groq', 'cloud', ok('nube'));
    const r = await routeChat('goal', req, [first, cloud], ctx, {
      timeoutMs: 1000,
      accept,
      signal: controller.signal,
    });
    expect(r).toBeNull();
    expect(cloud.calls).toBe(0);
  });
});

describe('fit for the task and the context', () => {
  it('skips a provider that does not suit the task', () => {
    const goalsOnly = { ...fake('tiny', 'local', ok('t')), suits: (t: string) => t === 'goal' };
    expect(planRoute('coach', req, [goalsOnly], ctx).skipped).toEqual([
      { id: 'tiny', reason: 'not-suited' },
    ]);
    expect(planRoute('goal', req, [goalsOnly], ctx).order.map((p) => p.id)).toEqual(['tiny']);
  });

  it('skips a provider whose context cannot hold the request', () => {
    const small = fake('tiny', 'local', ok('t')); // 4096 tokens
    const long = { messages: [{ role: 'user' as const, content: 'x'.repeat(20_000) }] };
    expect(planRoute('goal', long, [small], ctx).skipped).toEqual([
      { id: 'tiny', reason: 'too-long' },
    ]);
    expect(estimateTokens(long)).toBeGreaterThan(4096);
  });
});
