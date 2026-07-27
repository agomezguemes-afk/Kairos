// Keeps the OS surface (iOS Live Activity / Android ongoing notification)
// mirroring the active workout. Mount once inside ActiveWorkoutScreen — the
// activity lives and dies with the SESSION, not with the screen's focus.
//
// The payload is derived by a pure function (payload.ts) from the same machine
// + formatter the phone scoreboard uses, so the lock screen and the phone can
// never disagree. The button→store bridge lives in widgetBridge.ts because it
// must outlive this hook.

import { useEffect, useMemo, useRef } from 'react';

import {
  startWorkoutActivity,
  updateWorkoutActivity,
  endWorkoutActivity,
  isLiveActivitySupported,
  type LiveActivityWorkoutState,
} from '../../../modules/kairos-live-activity';
import { useWorkoutStore } from '../../store/workoutStore';

import { buildLiveActivityPayload, type LiveActivityPayload } from './payload';
import { installWidgetActionBridge } from './widgetBridge';

// Installed at import time (module scope), not on mount: iOS can relaunch a
// killed app in the background to run the App Intent, and the tap must be
// applied even though no screen ever mounts in that launch.
installWidgetActionBridge();

export interface LiveActivitySyncOptions {
  /** The screen's "has the user tapped Empezar on this exercise" bit. */
  hasEnteredCurrentExercise: boolean;
}

function toNativeState(payload: LiveActivityPayload): LiveActivityWorkoutState {
  return { ...payload };
}

export function useLiveActivitySync({ hasEnteredCurrentExercise }: LiveActivitySyncOptions): void {
  const aw = useWorkoutStore((s) => s.activeWorkout);
  const blocks = useWorkoutStore((s) => s.blocks);

  const payload = useMemo(() => {
    if (!aw) return null;
    const block = blocks.find((b) => b.id === aw.blockId);
    return buildLiveActivityPayload({
      blockName: block?.name ?? 'Entrenamiento',
      currentExerciseIndex: aw.currentExerciseIndex,
      currentSetIndex: aw.currentSetIndex,
      exercises: aw.exercises,
      restTimer: aw.restTimer,
      hasEnteredCurrentExercise,
    });
  }, [aw, blocks, hasEnteredCurrentExercise]);

  // One string per meaningful payload change. ActivityKit's update budget is
  // finite, so the surface is only pushed when what it SHOWS actually changes —
  // not on every store mutation that leaves the scoreboard identical.
  const signature = payload ? JSON.stringify(payload) : null;

  const sentRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!payload || !signature) {
      if (startedRef.current) {
        startedRef.current = false;
        sentRef.current = null;
        void endWorkoutActivity();
      }
      return;
    }
    if (sentRef.current === signature) return;
    if (!isLiveActivitySupported()) return;

    sentRef.current = signature;
    const state = toNativeState(payload);
    if (!startedRef.current) {
      startedRef.current = true;
      void startWorkoutActivity(state);
    } else {
      void updateWorkoutActivity(state);
    }
  }, [payload, signature]);

  // On unmount: end the activity only if the SESSION is over. Finish/cancel null
  // out activeWorkout (the effect above already ended it), so this is normally a
  // no-op. If a session is somehow still live when the screen goes away, the
  // lock-screen scoreboard must survive — the whole point is that it works with
  // the app out of the picture, and widgetBridge still applies its taps.
  useEffect(() => {
    return () => {
      if (!startedRef.current) return;
      if (useWorkoutStore.getState().activeWorkout) return;
      startedRef.current = false;
      void endWorkoutActivity();
    };
  }, []);
}
