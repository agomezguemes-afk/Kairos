// Process-lifetime bridge: Live Activity / notification buttons → store.
//
// Why not inside the screen's hook: a lock-screen tap must land even when
// ActiveWorkoutScreen is NOT mounted — the user navigated away mid-session, or
// iOS relaunched a killed app in the background purely to run the App Intent.
// So the listener is installed once when this module is first imported (which
// happens at bundle evaluation, since AppNavigator statically imports the
// session screen) and is never removed. It is idempotent and cheap: one
// subscription, no timers, no renders.
//
// Hydration matters: on a cold relaunch the queued action can arrive before
// zustand/persist has read AsyncStorage, so `activeWorkout` would still be null
// and the tap would be silently dropped. We hold such actions until hydration
// finishes, then replay them — subject to the same staleness guard.

import {
  addWidgetActionListener,
  isWidgetAction,
  type WidgetActionEvent,
} from '../../../modules/kairos-live-activity';
import { useWorkoutStore } from '../../store/workoutStore';

import { applyWidgetAction, type WidgetActionOutcome } from './widgetActions';

let installed = false;
/** Taps that arrived before the store finished hydrating. */
const deferred: WidgetActionEvent[] = [];

function handle(event: WidgetActionEvent): WidgetActionOutcome | 'deferred' | 'ignored' {
  if (!isWidgetAction(event.action)) return 'ignored';

  const persist = useWorkoutStore.persist;
  if (persist && !persist.hasHydrated()) {
    deferred.push(event);
    return 'deferred';
  }

  return applyWidgetAction(event.action, event.ts);
}

function flushDeferred(): void {
  const queued = deferred.splice(0, deferred.length);
  for (const event of queued) {
    if (isWidgetAction(event.action)) applyWidgetAction(event.action, event.ts);
  }
}

export function installWidgetActionBridge(): void {
  if (installed) return;
  installed = true;

  const persist = useWorkoutStore.persist;
  if (persist) persist.onFinishHydration(flushDeferred);

  addWidgetActionListener((event) => {
    handle(event);
  });
}
