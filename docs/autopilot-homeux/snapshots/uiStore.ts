// src/store/uiStore.ts
// Tiny persisted UI store (`kairos-ui`). Mirrors the scheduleStore idiom
// (persist + createJSONStorage + partialize + onRehydrateStorage). Kept apart
// from workoutStore on purpose: that store is domain-only behind a versioned
// migrate (v4), and UI state has no place in its persisted shape. See STORY-03 §2.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UIState {
  /** Estado abierto/cerrado de cada carpeta de disciplina en Blocks, keyed por
   *  disciplina. Ausente = nunca tocada (undefined → resolveBlockFolderOpen). */
  blockFoldersOpen: Record<string, boolean>;
  /** Falso hasta que persist rehidrata desde disco (evita flash de estado). */
  _hasHydrated: boolean;
  setBlockFolderOpen: (discipline: string, open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      blockFoldersOpen: {},
      _hasHydrated: false,
      setBlockFolderOpen: (discipline, open) =>
        set((s) => ({ blockFoldersOpen: { ...s.blockFoldersOpen, [discipline]: open } })),
    }),
    {
      name: 'kairos-ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        blockFoldersOpen: s.blockFoldersOpen,
      }),
      onRehydrateStorage: () => () => useUIStore.setState({ _hasHydrated: true }),
    },
  ),
);
