// JS API for the Kairos Live Activity native module.
//
// The native side is OPTIONAL by design: until the owner runs the native build
// (and adds the widget extension target) every call is a silent no-op. The app
// must never crash — or throw across this boundary — because the module isn't
// linked, the user disabled Live Activities, or ActivityKit ran out of budget.
//
// The state shape here is the SAME contract as WorkoutActivityAttributes
// .ContentState (Swift) and postNotification() (Kotlin). Change one, change all
// three — ActivityKit matches the widget UI to the activity by the encoded
// shape of ContentState.

import { requireOptionalNativeModule, NativeModule } from 'expo-modules-core';

export interface LiveActivityWorkoutState {
  blockName: string;
  exerciseName: string;
  /** Pre-formatted giant target: "60 kg × 6", "5 km · 5:30 min/km". Null = none. */
  targetLine: string | null;
  /** 1-based index of the current set. */
  setIndex: number;
  setTotal: number;
  /** Epoch ms. Both null unless a rest is actually running. */
  restStartedAt: number | null;
  restEndsAt: number | null;
  /** "Siguiente" peek — next exercise, or the upcoming set during rest. */
  nextUp: string | null;
  /** Mirrors the scoreboard machine so the widget renders the same state. */
  phase: 'set' | 'rest' | 'change';
}

export type WidgetAction = 'completeSet' | 'extendRest' | 'skipRest';

export interface WidgetActionEvent {
  action: WidgetAction;
  /**
   * Epoch ms the button was tapped (iOS). The tap can outlive the JS runtime —
   * an intent may relaunch a killed app — so the consumer drops stale actions
   * instead of logging a set the user pressed 40 minutes ago. Absent on
   * Android, where the broadcast only lands in a live process.
   */
  ts?: number;
}

type LiveActivityEvents = {
  onWidgetAction(event: WidgetActionEvent): void;
};

declare class KairosLiveActivityNativeModule extends NativeModule<LiveActivityEvents> {
  isSupported(): boolean;
  startActivity(state: LiveActivityWorkoutState): Promise<void>;
  updateActivity(state: LiveActivityWorkoutState): Promise<void>;
  endActivity(): Promise<void>;
}

const native = requireOptionalNativeModule<KairosLiveActivityNativeModule>('KairosLiveActivity');

export function isLiveActivitySupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

export async function startWorkoutActivity(state: LiveActivityWorkoutState): Promise<void> {
  if (!native) return;
  try {
    await native.startActivity(state);
  } catch {
    // ActivityKit refusals (user disabled Live Activities, low power, budget
    // exhausted…) are non-events for the workout flow: the phone screen keeps
    // working. Never let the OS surface break the session.
  }
}

export async function updateWorkoutActivity(state: LiveActivityWorkoutState): Promise<void> {
  if (!native) return;
  try {
    await native.updateActivity(state);
  } catch {
    // Same contract as startWorkoutActivity: the mirror is best-effort.
  }
}

export async function endWorkoutActivity(): Promise<void> {
  if (!native) return;
  try {
    await native.endActivity();
  } catch {
    // A stray activity that outlives the session is ended on the next start().
  }
}

const WIDGET_ACTIONS: ReadonlySet<string> = new Set([
  'completeSet',
  'extendRest',
  'skipRest',
] satisfies WidgetAction[]);

export function isWidgetAction(value: unknown): value is WidgetAction {
  return typeof value === 'string' && WIDGET_ACTIONS.has(value);
}

/**
 * Subscribe to taps on the Live Activity / notification buttons.
 *
 * iOS: the module flushes any actions queued while JS was absent as soon as the
 * first listener attaches (OnStartObserving), so a tap that relaunched the app
 * is delivered here — with its original `ts`.
 */
export function addWidgetActionListener(listener: (e: WidgetActionEvent) => void): {
  remove: () => void;
} {
  if (!native) return { remove: () => {} };
  const sub = native.addListener('onWidgetAction', listener);
  return { remove: () => sub.remove() };
}
