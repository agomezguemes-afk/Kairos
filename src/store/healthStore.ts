// src/store/healthStore.ts
// Rolling biometric sample log (HRV, sleep) — raw material for the adaptive
// readiness engine's personal baseline (src/lib/readiness/adaptiveEngine.ts).
// Kept apart from workoutStore on purpose, same rationale as uiStore: a
// focused, independently-persisted slice, not domain state.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BiometricSample } from '../lib/health/types';

const MAX_SAMPLES = 30;

interface HealthState {
  /** Rolling window, oldest first, one entry per date, capped at MAX_SAMPLES. */
  samples: BiometricSample[];
  _hasHydrated: boolean;
  /** Upserts by date — re-syncing the same day replaces, never duplicates. */
  recordSample: (sample: BiometricSample) => void;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      samples: [],
      _hasHydrated: false,
      recordSample: (sample) =>
        set((s) => {
          const withoutToday = s.samples.filter((x) => x.date !== sample.date);
          const next = [...withoutToday, sample].sort((a, b) => a.date.localeCompare(b.date));
          return { samples: next.slice(-MAX_SAMPLES) };
        }),
    }),
    {
      name: 'kairos-health',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ samples: s.samples }),
      onRehydrateStorage: () => () => useHealthStore.setState({ _hasHydrated: true }),
    },
  ),
);
