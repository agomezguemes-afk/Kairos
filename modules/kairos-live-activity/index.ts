// JS API for the Kairos Live Activity native module.
//
// The native side is OPTIONAL by design: until the owner runs prebuild (and,
// for the Dynamic Island UI, adds the widget extension target) every call is
// a silent no-op. The app must never crash because the module isn't linked.

import { requireOptionalNativeModule, NativeModule } from 'expo-modules-core';

export interface LiveActivityWorkoutState {
  blockName: string;
  exerciseName: string;
  /** 1-based index of the current set. */
  setIndex: number;
  setTotal: number;
  targetWeight: number | null;
  targetReps: number | null;
  /** Epoch ms when the running rest ends; null = not resting. */
  restEndsAt: number | null;
}

export type WidgetAction = 'completeSet' | 'extendRest';

export interface WidgetActionEvent {
  action: WidgetAction;
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
    // ActivityKit refusals (user disabled Live Activities, low power…) are
    // non-events for the workout flow.
  }
}

export async function updateWorkoutActivity(state: LiveActivityWorkoutState): Promise<void> {
  if (!native) return;
  try {
    await native.updateActivity(state);
  } catch {}
}

export async function endWorkoutActivity(): Promise<void> {
  if (!native) return;
  try {
    await native.endActivity();
  } catch {}
}

/** Subscribe to taps on the Live Activity / notification action buttons. */
export function addWidgetActionListener(listener: (e: WidgetActionEvent) => void): {
  remove: () => void;
} {
  if (!native) return { remove: () => {} };
  const sub = native.addListener('onWidgetAction', listener);
  return { remove: () => sub.remove() };
}
