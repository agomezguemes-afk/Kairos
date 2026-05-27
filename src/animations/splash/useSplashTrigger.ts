// src/animations/splash/useSplashTrigger.ts
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEY, STORAGE_VERSION } from './choreography';

export type SplashMode = 'full' | 'condensed' | 'loading';

interface StoredFlag {
  version: number;
  seenAt: string;
}

export interface SplashTriggerResult {
  mode: SplashMode;
  markCompleted: () => Promise<void>;
  replayBoot: () => void;
}

let pendingReplay = false; // module-scoped — survives re-mount within session

export function useSplashTrigger(): SplashTriggerResult {
  const [mode, setMode] = useState<SplashMode>('loading');

  useEffect(() => {
    let cancelled = false;

    async function decide() {
      if (pendingReplay) {
        pendingReplay = false;
        if (!cancelled) setMode('full');
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;

        if (!raw) {
          setMode('full');
          return;
        }

        const parsed = JSON.parse(raw) as StoredFlag;
        if (parsed?.version === STORAGE_VERSION) {
          setMode('condensed');
        } else {
          // version mismatch — treat as never-seen so user can re-experience the
          // refreshed boot sequence
          setMode('full');
        }
      } catch {
        // corrupted / storage failure — treat as never-seen.
        // Better than crashing.
        if (!cancelled) setMode('full');
      }
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, []);

  const markCompleted = useCallback(async () => {
    try {
      const value: StoredFlag = {
        version: STORAGE_VERSION,
        seenAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // silent fail — worst case: full sequence plays again next launch
    }
  }, []);

  const replayBoot = useCallback(() => {
    pendingReplay = true;
  }, []);

  return { mode, markCompleted, replayBoot };
}
