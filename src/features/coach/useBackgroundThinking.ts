// Lets the engine think while the user is away: a consolidation pass when
// the app goes to the background (the session just ended, the phone goes
// in the pocket) and again when it comes back after a while, so the next
// session is already planned on the latest data. Real OS background
// execution (BGTaskScheduler) needs a native module and is a later step.

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useCoachStore } from '../../store/coachStore';

/** Coming back after this long, the forecast is stale (sleep, a new day). */
const STALE_MS = 3 * 3_600_000;

function runIfStale() {
  const { consolidatedAt, consolidate } = useCoachStore.getState();
  if (!consolidatedAt || Date.now() - new Date(consolidatedAt).getTime() > STALE_MS) consolidate();
}

export function useBackgroundThinking() {
  useEffect(() => {
    // Persisted state arrives asynchronously; think only once it is here.
    const unsubHydrate = useCoachStore.persist.hasHydrated()
      ? (runIfStale(), () => {})
      : useCoachStore.persist.onFinishHydration(runIfStale);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') useCoachStore.getState().consolidate();
      else if (state === 'active') runIfStale();
    });
    return () => {
      unsubHydrate();
      sub.remove();
    };
  }, []);
}
