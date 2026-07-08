import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ANALYTICS_EVENTS,
  getTrackedEvents,
  getTrackedEventsByName,
  registerAnalyticsSink,
  resetAnalytics,
  track,
} from './index';

describe('analytics sink', () => {
  beforeEach(() => resetAnalytics());

  it('buffers a tracked event with props and a timestamp', () => {
    const before = Date.now();
    const rec = track(ANALYTICS_EVENTS.kai_action_applied, { kind: 'start_block' });
    expect(rec.event).toBe('kai_action_applied');
    expect(rec.props).toEqual({ kind: 'start_block' });
    expect(rec.ts).toBeGreaterThanOrEqual(before);
    expect(getTrackedEvents()).toHaveLength(1);
  });

  it('defaults props to an empty object', () => {
    const rec = track(ANALYTICS_EVENTS.paywall_dismissed);
    expect(rec.props).toEqual({});
  });

  it('fans out to registered sinks and supports unsubscribe', () => {
    const sink = vi.fn();
    const off = registerAnalyticsSink(sink);
    track(ANALYTICS_EVENTS.paywall_viewed, { source: 'today' });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0].event).toBe('paywall_viewed');
    off();
    track(ANALYTICS_EVENTS.paywall_viewed);
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing sink so tracking still succeeds', () => {
    registerAnalyticsSink(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    registerAnalyticsSink(ok);
    expect(() => track(ANALYTICS_EVENTS.data_exported)).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('filters buffered events by name', () => {
    track(ANALYTICS_EVENTS.kai_signal_viewed, { id: 'a' });
    track(ANALYTICS_EVENTS.kai_action_applied, { id: 'b' });
    track(ANALYTICS_EVENTS.kai_signal_viewed, { id: 'c' });
    const viewed = getTrackedEventsByName(ANALYTICS_EVENTS.kai_signal_viewed);
    expect(viewed.map((r) => r.props.id)).toEqual(['a', 'c']);
  });

  it('caps the ring buffer at 200 entries, dropping the oldest', () => {
    for (let i = 0; i < 250; i++) track(ANALYTICS_EVENTS.data_imported, { i });
    const events = getTrackedEvents();
    expect(events).toHaveLength(200);
    expect(events[0].props.i).toBe(50);
    expect(events[events.length - 1].props.i).toBe(249);
  });
});
