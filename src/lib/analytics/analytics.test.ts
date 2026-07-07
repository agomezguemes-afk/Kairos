import { describe, it, expect, vi } from 'vitest';

import { AnalyticsQueue, type AnalyticsEvent, type KeyValueStorage } from './queue';
import { ANALYTICS_EVENTS } from './events';

const KEY = 'test_analytics';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

function persistedEvents(storage: { data: Map<string, string> }): AnalyticsEvent[] {
  const raw = storage.data.get(KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as { events: AnalyticsEvent[] }).events;
}

describe('AnalyticsQueue — track', () => {
  it('records event name, props and a coherent timestamp', async () => {
    const q = new AnalyticsQueue(memoryStorage(), KEY);
    const before = Date.now();
    q.track('onboarding_started', { source: 'quiz' });
    const after = Date.now();

    const events = await q.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('onboarding_started');
    expect(events[0].props).toEqual({ source: 'quiz' });
    expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(events[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('omits props when not provided', async () => {
    const q = new AnalyticsQueue(memoryStorage(), KEY);
    q.track('paywall_viewed');
    const [e] = await q.getEvents();
    expect(e.props).toBeUndefined();
  });

  it('preserves order across consecutive tracks', async () => {
    const q = new AnalyticsQueue(memoryStorage(), KEY);
    for (let i = 0; i < 5; i++) q.track(`e${i}`);
    const events = await q.getEvents();
    expect(events.map((e) => e.event)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    const times = events.map((e) => e.timestamp);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('drops empty event names without throwing', async () => {
    const onError = vi.fn();
    const q = new AnalyticsQueue(memoryStorage(), KEY, { onError });
    q.track('');
    q.track('   ');
    expect(await q.getEvents()).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('drops non-serializable props but keeps the event', async () => {
    const onError = vi.fn();
    const q = new AnalyticsQueue(memoryStorage(), KEY, { onError });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    q.track('space_generated', circular);

    const [e] = await q.getEvents();
    expect(e.event).toBe('space_generated');
    expect(e.props).toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe('AnalyticsQueue — persistence', () => {
  it('persists tracked events to storage', async () => {
    const storage = memoryStorage();
    const q = new AnalyticsQueue(storage, KEY);
    q.track('onboarding_completed', { source: 'template' });
    await q.flush();

    const persisted = persistedEvents(storage);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].event).toBe('onboarding_completed');
  });

  it('hydrates persisted history before this-session events', async () => {
    const old: AnalyticsEvent = { event: 'onboarding_started', timestamp: 1000 };
    const storage = memoryStorage({ [KEY]: JSON.stringify({ events: [old] }) });
    const q = new AnalyticsQueue(storage, KEY);

    // Track BEFORE any read forces hydration — must not clobber history.
    q.track('quiz_step_viewed', { step: 1 });

    const events = await q.getEvents();
    expect(events.map((e) => e.event)).toEqual(['onboarding_started', 'quiz_step_viewed']);
  });

  it('recovers from corrupt storage payloads', async () => {
    const onError = vi.fn();
    const storage = memoryStorage({ [KEY]: '{not json' });
    const q = new AnalyticsQueue(storage, KEY, { onError });
    q.track('paywall_dismissed');

    const events = await q.getEvents();
    expect(events).toHaveLength(1);
    expect(onError).toHaveBeenCalled();
  });

  it('recovers from an unexpected persisted shape', async () => {
    const onError = vi.fn();
    const storage = memoryStorage({ [KEY]: JSON.stringify({ nope: true }) });
    const q = new AnalyticsQueue(storage, KEY, { onError });
    expect(await q.getEvents()).toHaveLength(0);
    expect(onError).toHaveBeenCalled();
  });

  it('filters malformed entries out of a persisted list', async () => {
    const good: AnalyticsEvent = { event: 'ok', timestamp: 5 };
    const storage = memoryStorage({
      [KEY]: JSON.stringify({ events: [good, { bad: true }, 42, null] }),
    });
    const q = new AnalyticsQueue(storage, KEY);
    const events = await q.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('ok');
  });

  it('survives storage write failures with the in-memory queue intact', async () => {
    const onError = vi.fn();
    const failing: KeyValueStorage = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('disk full');
      },
      removeItem: async () => {},
    };
    const q = new AnalyticsQueue(failing, KEY, { onError });
    q.track('first_workout_started');
    await q.flush();

    expect(await q.getEvents()).toHaveLength(1);
    expect(onError).toHaveBeenCalled();
  });

  it('caps the queue dropping the oldest events', async () => {
    const storage = memoryStorage();
    const q = new AnalyticsQueue(storage, KEY, { maxEvents: 10 });
    for (let i = 0; i < 15; i++) q.track(`e${i}`);
    await q.flush();

    const events = await q.getEvents();
    expect(events).toHaveLength(10);
    expect(events[0].event).toBe('e5');
    expect(events[9].event).toBe('e14');
    expect(persistedEvents(storage)).toHaveLength(10);
  });
});

describe('AnalyticsQueue — export & clear', () => {
  it('exports a parseable JSON document with metadata', async () => {
    const q = new AnalyticsQueue(memoryStorage(), KEY);
    q.track('plan_reveal_viewed');
    q.track('reveal_action', { action: 'start' });

    const json = await q.exportJSON();
    const parsed = JSON.parse(json) as {
      exportedAt: string;
      count: number;
      events: AnalyticsEvent[];
    };
    expect(parsed.count).toBe(2);
    expect(parsed.events).toHaveLength(2);
    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false);
    expect(parsed.events[1].props).toEqual({ action: 'start' });
  });

  it('clear() empties memory and storage', async () => {
    const storage = memoryStorage();
    const q = new AnalyticsQueue(storage, KEY);
    q.track('paywall_viewed');
    await q.flush();
    expect(persistedEvents(storage)).toHaveLength(1);

    await q.clear();
    expect(await q.getEvents()).toHaveLength(0);
    expect(storage.data.has(KEY)).toBe(false);
  });

  it('tracking after clear() starts a fresh queue', async () => {
    const storage = memoryStorage();
    const q = new AnalyticsQueue(storage, KEY);
    q.track('a');
    await q.clear();
    q.track('b');
    await q.flush();

    const events = await q.getEvents();
    expect(events.map((e) => e.event)).toEqual(['b']);
    expect(persistedEvents(storage).map((e) => e.event)).toEqual(['b']);
  });
});

describe('event catalogue', () => {
  it('contains the complete funnel from the backlog', () => {
    expect(Object.values(ANALYTICS_EVENTS)).toEqual([
      'onboarding_started',
      'quiz_step_viewed',
      'onboarding_step_completed',
      'space_generated',
      'plan_reveal_viewed',
      'reveal_action',
      'paywall_viewed',
      'paywall_dismissed',
      'onboarding_completed',
      'first_workout_started',
      'first_workout_completed',
    ]);
  });
});
