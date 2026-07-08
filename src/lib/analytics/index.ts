// src/lib/analytics/index.ts
// Offline-first analytics sink. `track()` never touches the network on its own —
// it appends to an in-memory ring buffer and fans out to registered sinks. A
// real provider (PostHog / RevenueCat / Supabase) is wired later by registering
// a sink; until then events are still observable in dev and in tests.
//
// Contract for the rest of the app: `import { track, ANALYTICS_EVENTS }`.

import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsProps } from './events';

export { ANALYTICS_EVENTS };
export type { AnalyticsEventName, AnalyticsProps };

export interface AnalyticsRecord {
  event: string;
  props: AnalyticsProps;
  /** Epoch millis when tracked. */
  ts: number;
}

export type AnalyticsSink = (record: AnalyticsRecord) => void;

// Bounded so a long-running session can't leak memory. Newest events win.
const RING_MAX = 200;
const ring: AnalyticsRecord[] = [];
const sinks = new Set<AnalyticsSink>();

/**
 * Record an event. Returns the stored record so callers/tests can assert on it.
 * A throwing sink is isolated: tracking must never break the feature that emits.
 */
export function track(
  event: AnalyticsEventName | string,
  props: AnalyticsProps = {},
): AnalyticsRecord {
  const record: AnalyticsRecord = { event, props, ts: Date.now() };
  ring.push(record);
  if (ring.length > RING_MAX) ring.shift();
  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      // A misbehaving sink is swallowed on purpose — analytics is best-effort.
    }
  }
  return record;
}

/** Register a sink (e.g. a console logger in dev, a real provider in prod). Returns an unsubscribe. */
export function registerAnalyticsSink(sink: AnalyticsSink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

/** Read-only view of buffered events (most recent last). For debugging + tests. */
export function getTrackedEvents(): readonly AnalyticsRecord[] {
  return ring;
}

/** All events matching a name, oldest→newest. */
export function getTrackedEventsByName(event: AnalyticsEventName | string): AnalyticsRecord[] {
  return ring.filter((r) => r.event === event);
}

/** Clear buffer + sinks. Test-only isolation hook; harmless in prod. */
export function resetAnalytics(): void {
  ring.length = 0;
  sinks.clear();
}
