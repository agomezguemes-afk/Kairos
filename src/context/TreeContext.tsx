// KAIROS — Tree Context
// Manages tree type selection, metrics accumulation, and progress.
// Persisted to AsyncStorage under @kairos_tree_* keys.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TreeType, TreeProgress, TreeMetrics } from '../types/tree';
import { createEmptyMetrics } from '../types/tree';
import type { ExerciseCard, ExerciseSet, WorkoutBlock } from '../types/core';
import {
  calculateProgress,
  updateMetricsForSet,
  incrementPRCount,
  computeMetricsFromBlocks,
} from '../services/treeService';

// ======================== STORAGE KEYS ========================

const KEYS = {
  treeType: '@kairos_tree_type',
  metrics: '@kairos_tree_metrics',
} as const;

// ======================== CONTEXT TYPE ========================

interface TreeContextType {
  treeType: TreeType | null;
  metrics: TreeMetrics;
  progress: TreeProgress | null;
  isLoading: boolean;

  /** Select a tree type (first time or change). */
  selectTreeType: (type: TreeType) => Promise<void>;

  /** Call when a set is completed — updates volume/distance/active days. */
  onTreeSetCompleted: (exercise: ExerciseCard, set: ExerciseSet) => void;

  /** Call when a PR card is created — increments PR count. */
  onTreePRCreated: () => void;

  /** Recompute metrics from scratch (e.g. after data reset). */
  recomputeFromBlocks: (blocks: WorkoutBlock[], prCount: number) => void;

  /** Reset all tree data. */
  resetTree: () => Promise<void>;
}

const TreeContext = createContext<TreeContextType | null>(null);

// ======================== PROVIDER ========================

export function TreeProvider({ children }: { children: React.ReactNode }) {
  const [treeType, setTreeType] = useState<TreeType | null>(null);
  const [metrics, setMetrics] = useState<TreeMetrics>(createEmptyMetrics);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Load ----
  useEffect(() => {
    (async () => {
      try {
        const [rawType, rawMetrics] = await Promise.all([
          AsyncStorage.getItem(KEYS.treeType),
          AsyncStorage.getItem(KEYS.metrics),
        ]);
        if (rawType) setTreeType(JSON.parse(rawType));
        if (rawMetrics) setMetrics(JSON.parse(rawMetrics));
      } catch (e) {
        console.warn('Kairos: Error loading tree data', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ---- Persist ----
  const persistType = useCallback(async (t: TreeType) => {
    try { await AsyncStorage.setItem(KEYS.treeType, JSON.stringify(t)); } catch {}
  }, []);
  const persistMetrics = useCallback(async (m: TreeMetrics) => {
    try { await AsyncStorage.setItem(KEYS.metrics, JSON.stringify(m)); } catch {}
  }, []);

  // ---- Actions ----

  const selectTreeType = useCallback(async (type: TreeType) => {
    setTreeType(type);
    await persistType(type);
  }, [persistType]);

  const onTreeSetCompleted = useCallback(
    (exercise: ExerciseCard, set: ExerciseSet) => {
      setMetrics((prev) => {
        const next = updateMetricsForSet(prev, set, exercise.fields);
        persistMetrics(next);
        return next;
      });
    },
    [persistMetrics],
  );

  const onTreePRCreated = useCallback(() => {
    setMetrics((prev) => {
      const next = incrementPRCount(prev);
      persistMetrics(next);
      return next;
    });
  }, [persistMetrics]);

  const recomputeFromBlocks = useCallback(
    (blocks: WorkoutBlock[], prCount: number) => {
      const fresh = computeMetricsFromBlocks(blocks, prCount);
      setMetrics(fresh);
      persistMetrics(fresh);
    },
    [persistMetrics],
  );

  const resetTree = useCallback(async () => {
    setTreeType(null);
    setMetrics(createEmptyMetrics());
    await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
  }, []);

  // ---- Derived progress ----
  const progress = useMemo<TreeProgress | null>(
    () => (treeType ? calculateProgress(treeType, metrics) : null),
    [treeType, metrics],
  );

  const value = useMemo<TreeContextType>(
    () => ({
      treeType,
      metrics,
      progress,
      isLoading,
      selectTreeType,
      onTreeSetCompleted,
      onTreePRCreated,
      recomputeFromBlocks,
      resetTree,
    }),
    [treeType, metrics, progress, isLoading, selectTreeType, onTreeSetCompleted, onTreePRCreated, recomputeFromBlocks, resetTree],
  );

  return (
    <TreeContext.Provider value={value}>
      {children}
    </TreeContext.Provider>
  );
}

export function useTree(): TreeContextType {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error('useTree must be used within TreeProvider');
  return ctx;
}
