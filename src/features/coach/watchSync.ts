// Keeps the Apple Watch app in step with the coach: today's pre-planned
// session (and the rest of the week) goes to the wrist whenever it changes,
// and sessions logged on the wrist come back as ordinary Kairos sessions.

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { estimateHrMax } from '../../lib/health/workoutImport';
import { watchModule } from '../../lib/watch/native';
import {
  parseWatchResult,
  planForWatch,
  planKey,
  sessionFromWatch,
} from '../../lib/watch/protocol';
import { useCoachStore } from '../../store/coachStore';

let lastKey: string | null = null;

/** Sends the plan if it changed since the last push. Safe to call often. */
export function pushPlanToWatch(force = false): void {
  const m = watchModule();
  if (!m) return;
  const { plan, sessions, dayPlan, biometrics } = useCoachStore.getState();
  const payload = planForWatch(plan, sessions, dayPlan, estimateHrMax(biometrics?.hrMax));
  const key = planKey(payload);
  if (!force && key === lastKey) return;
  try {
    m.updatePlan(JSON.stringify(payload));
    lastKey = key;
  } catch (e) {
    // Not activated yet: onState fires once it is, and pushes again.
    console.warn('[watch] plan not sent yet', e);
  }
}

/**
 * Stores every session the watch has delivered, then acknowledges it so the
 * native side can forget it. A session from a newer watch protocol stays
 * queued: an app update can still read it.
 */
export function ingestWatchSessions(): number {
  const m = watchModule();
  if (!m) return 0;
  let pending: string[];
  try {
    pending = m.pendingSessions();
  } catch (e) {
    console.warn('[watch] could not read pending sessions', e);
    return 0;
  }
  const ack: string[] = [];
  let added = 0;
  for (const json of pending) {
    const parsed = parseWatchResult(json);
    if (!parsed.ok) {
      const id = rawId(json);
      if (parsed.error.includes('newer than this app')) continue;
      console.warn('[watch] dropping an unreadable session', parsed.error);
      if (id) ack.push(id);
      continue;
    }
    const r = parsed.value;
    const { plan, sessions, recordSession } = useCoachStore.getState();
    const log = sessionFromWatch(r, plan);
    if (log && !sessions.some((s) => s.id === log.id)) {
      recordSession(log);
      added++;
    }
    ack.push(r.id);
  }
  if (ack.length) m.ackSessions(ack);
  return added;
}

function rawId(json: string): string | null {
  try {
    const id = (JSON.parse(json) as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  } catch {
    // Not JSON at all: the native side keyed it by id, so it had one; nothing to ack by.
    return null;
  }
}

export function useWatchSync(): void {
  useEffect(() => {
    const m = watchModule();
    if (!m) return;
    const start = () => {
      ingestWatchSessions();
      pushPlanToWatch(true);
    };
    const unsubHydrate = useCoachStore.persist.hasHydrated()
      ? (start(), () => {})
      : useCoachStore.persist.onFinishHydration(start);

    const subs = [
      m.addListener('onSession', () => ingestWatchSessions()),
      m.addListener('onState', (s) => {
        if (s.activated && s.installed) pushPlanToWatch(true);
      }),
    ];
    // Plan, today's adjustment or history changed: the wrist should know.
    const unsubStore = useCoachStore.subscribe((s, prev) => {
      if (
        s.plan !== prev.plan ||
        s.dayPlan !== prev.dayPlan ||
        s.sessions !== prev.sessions ||
        s.biometrics?.hrMax !== prev.biometrics?.hrMax
      )
        pushPlanToWatch();
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') ingestWatchSessions();
    });
    return () => {
      unsubHydrate();
      subs.forEach((x) => x.remove());
      unsubStore();
      app.remove();
    };
  }, []);
}
