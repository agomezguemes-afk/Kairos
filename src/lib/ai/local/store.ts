// Which downloaded model the coach uses, and which files are on the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface LocalAiState {
  activeModelId: string | null;
  /** Last known: the file was complete when it was checked. */
  downloaded: Record<string, boolean>;
  setActive: (id: string | null) => void;
  setDownloaded: (id: string, value: boolean) => void;
}

export const useLocalAiStore = create<LocalAiState>()(
  persist(
    (set, get) => ({
      activeModelId: null,
      downloaded: {},
      setActive: (id) => set({ activeModelId: id }),
      setDownloaded: (id, value) => {
        const downloaded = { ...get().downloaded, [id]: value };
        // A model that is gone cannot stay the active one.
        set(
          !value && get().activeModelId === id
            ? { downloaded, activeModelId: null }
            : { downloaded },
        );
      },
    }),
    {
      name: 'kairos-local-ai-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) =>
        (persisted && typeof persisted === 'object' ? persisted : {}) as LocalAiState,
      partialize: (s) => ({ activeModelId: s.activeModelId, downloaded: s.downloaded }),
    },
  ),
);
