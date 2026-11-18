// JS face of modules/kairos-watch (WatchConnectivity). Required lazily like
// the HealthKit bridge: web, tests and builds without the module get `null`
// and every caller treats that as "no Apple Watch".

import { Platform } from 'react-native';

export interface WatchState {
  supported: boolean;
  activated: boolean;
  paired: boolean;
  installed: boolean;
  reachable: boolean;
}

interface Subscription {
  remove(): void;
}

interface Events {
  onSession: () => void;
  onLive: (e: { json: string }) => void;
  onState: (s: WatchState) => void;
}

interface KairosWatchNative {
  getState(): WatchState;
  updatePlan(json: string): void;
  pendingSessions(): string[];
  ackSessions(ids: string[]): void;
  sendCommand(json: string): boolean;
  startWatchWorkout(activityType: number, outdoor: boolean): Promise<boolean>;
  addListener<E extends keyof Events>(event: E, listener: Events[E]): Subscription;
}

let native: KairosWatchNative | null | undefined;

export function watchModule(): KairosWatchNative | null {
  if (native !== undefined) return native;
  native = null;
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
    native = requireOptionalNativeModule<KairosWatchNative>('KairosWatch');
  } catch (e) {
    console.warn('[watch] KairosWatch module not in this build', e);
  }
  return native;
}

export function watchState(): WatchState | null {
  const m = watchModule();
  if (!m) return null;
  try {
    return m.getState();
  } catch (e) {
    console.warn('[watch] state unavailable', e);
    return null;
  }
}
