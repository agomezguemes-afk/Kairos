// Kairos analytics — local-first, offline-always. Events land in an
// in-memory queue and persist to AsyncStorage; nothing leaves the device.
// Export as JSON when a human (or a future backend) wants the funnel.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsQueue, type AnalyticsEvent } from './queue';

const STORAGE_KEY = 'kairos_analytics_v1';

declare const __DEV__: boolean | undefined;

const queue = new AnalyticsQueue(AsyncStorage, STORAGE_KEY, {
  onError: (message, error) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`Kairos ${message}`, error ?? '');
    }
  },
});

/** Record an event. Synchronous, fire-and-forget, never throws. */
export function track(event: string, props?: Record<string, unknown>): void {
  queue.track(event, props);
}

/** Snapshot of the recorded events (persisted history included). */
export function getAnalyticsEvents(): Promise<AnalyticsEvent[]> {
  return queue.getEvents();
}

/** Full queue as pretty-printed JSON for sharing/debugging. */
export function exportAnalyticsJSON(): Promise<string> {
  return queue.exportJSON();
}

/** Wipe the queue (dev reset / after a successful export upload). */
export function clearAnalytics(): Promise<void> {
  return queue.clear();
}

/** Await pending persistence — useful before app teardown or in tests. */
export function flushAnalytics(): Promise<void> {
  return queue.flush();
}

export { ANALYTICS_EVENTS, type AnalyticsEventName } from './events';
export type { AnalyticsEvent } from './queue';
