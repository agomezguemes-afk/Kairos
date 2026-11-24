// Puts the on-device model behind the router and keeps it in step with
// the app's lifecycle. Called once from the app root.

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { registerProvider, updateRouteContext } from '../providers';
import { findModel, LOCAL_MODELS } from './catalog';
import { createLocalProvider } from './llamaProvider';
import { localRuntime } from './runtime';
import { useLocalAiStore } from './store';

/** iOS purges Caches under storage pressure: re-check what is really there. */
async function refreshDownloaded(): Promise<void> {
  if (!localRuntime) return;
  const { setDownloaded } = useLocalAiStore.getState();
  for (const m of LOCAL_MODELS) setDownloaded(m.id, await localRuntime.isDownloaded(m));
}

export function useLocalAi(): void {
  useEffect(() => {
    const runtime = localRuntime;
    if (!runtime) return;
    registerProvider(
      createLocalProvider({
        runtime,
        activeModel: () => findModel(useLocalAiStore.getState().activeModelId),
        isDownloaded: (id) => !!useLocalAiStore.getState().downloaded[id],
        markMissing: (id) => useLocalAiStore.getState().setDownloaded(id, false),
      }),
    );
    const check = () =>
      refreshDownloaded().catch((e) => console.warn('[local-ai] could not check models', e));
    const unsubHydrate = useLocalAiStore.persist.hasHydrated()
      ? (check(), () => {})
      : useLocalAiStore.persist.onFinishHydration(check);

    updateRouteContext({ foreground: AppState.currentState === 'active' });
    const appState = AppState.addEventListener('change', (state) => {
      updateRouteContext({ foreground: state === 'active' });
      // iOS rejects GPU work from the background: stop before it does.
      if (state === 'background')
        runtime.stop().catch((e) => console.warn('[local-ai] stop failed', e));
      if (state === 'active') check();
    });
    // The model is the biggest thing the app holds: give it back first.
    const memory = AppState.addEventListener('memoryWarning', () => {
      runtime.release().catch((e) => console.warn('[local-ai] release failed', e));
    });
    return () => {
      unsubHydrate();
      appState.remove();
      memory.remove();
    };
  }, []);
}
