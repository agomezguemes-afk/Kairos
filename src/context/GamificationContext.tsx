// KAIROS — Gamification Context
// Manages streak, badges, PR cards, and exercise bests.
// All persisted to AsyncStorage under @kairos_* keys.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Streak,
  Badge,
  PRCard,
  ExerciseBestMap,
  GamificationStats,
} from '../types/gamification';
import { createEmptyStreak } from '../types/gamification';
import type { ExerciseCard, ExerciseSet, WorkoutBlock } from '../types/core';
import {
  updateStreak as computeNewStreak,
  checkBadges,
  checkForPR,
  computeStats,
} from '../services/gamificationService';

// ======================== STORAGE KEYS ========================

const KEYS = {
  streak: '@kairos_streak',
  badges: '@kairos_badges',
  prCards: '@kairos_pr_cards',
  exerciseBest: '@kairos_exercise_best',
  blockCount: '@kairos_user_block_count',
  missionCount: '@kairos_completed_mission_count',
} as const;

// ======================== CONTEXT TYPE ========================

interface GamificationContextType {
  streak: Streak;
  badges: Badge[];
  prCards: PRCard[];
  isLoading: boolean;

  /**
   * Call when a set is toggled to completed.
   * Handles streak update, badge checks, and PR detection.
   * Returns newly unlocked badges and a PR card if one was created.
   */
  onSetCompleted: (
    exercise: ExerciseCard,
    set: ExerciseSet,
    allBlocks: WorkoutBlock[],
  ) => Promise<{ newBadges: Badge[]; prCard: PRCard | null }>;

  /**
   * Call when the user creates a new block (for badge check).
   */
  onBlockCreated: (allBlocks: WorkoutBlock[]) => Promise<{ newBadges: Badge[] }>;

  /**
   * Call when a mission is completed (for mission_complete badge).
   */
  onMissionCompleted: (allBlocks: WorkoutBlock[]) => Promise<{ newBadges: Badge[] }>;

  /** Reset all gamification data (dev). */
  resetGamification: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

// ======================== PROVIDER ========================

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [streak, setStreak] = useState<Streak>(createEmptyStreak);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [prCards, setPRCards] = useState<PRCard[]>([]);
  const [bestMap, setBestMap] = useState<ExerciseBestMap>({});
  const [blockCount, setBlockCount] = useState(0);
  const [missionCount, setMissionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Load from storage ----
  useEffect(() => {
    (async () => {
      try {
        const [rawStreak, rawBadges, rawPR, rawBest, rawCount, rawMissionCount] = await Promise.all([
          AsyncStorage.getItem(KEYS.streak),
          AsyncStorage.getItem(KEYS.badges),
          AsyncStorage.getItem(KEYS.prCards),
          AsyncStorage.getItem(KEYS.exerciseBest),
          AsyncStorage.getItem(KEYS.blockCount),
          AsyncStorage.getItem(KEYS.missionCount),
        ]);
        if (rawStreak) setStreak(JSON.parse(rawStreak));
        if (rawBadges) setBadges(JSON.parse(rawBadges));
        if (rawPR) setPRCards(JSON.parse(rawPR));
        if (rawBest) setBestMap(JSON.parse(rawBest));
        if (rawCount) setBlockCount(JSON.parse(rawCount));
        if (rawMissionCount) setMissionCount(JSON.parse(rawMissionCount));
      } catch (e) {
        console.warn('Kairos: Error loading gamification data', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ---- Persist helpers ----
  const persistStreak = useCallback(async (s: Streak) => {
    try { await AsyncStorage.setItem(KEYS.streak, JSON.stringify(s)); } catch {}
  }, []);
  const persistBadges = useCallback(async (b: Badge[]) => {
    try { await AsyncStorage.setItem(KEYS.badges, JSON.stringify(b)); } catch {}
  }, []);
  const persistPRCards = useCallback(async (cards: PRCard[]) => {
    try { await AsyncStorage.setItem(KEYS.prCards, JSON.stringify(cards)); } catch {}
  }, []);
  const persistBestMap = useCallback(async (m: ExerciseBestMap) => {
    try { await AsyncStorage.setItem(KEYS.exerciseBest, JSON.stringify(m)); } catch {}
  }, []);
  const persistBlockCount = useCallback(async (c: number) => {
    try { await AsyncStorage.setItem(KEYS.blockCount, JSON.stringify(c)); } catch {}
  }, []);
  const persistMissionCount = useCallback(async (c: number) => {
    try { await AsyncStorage.setItem(KEYS.missionCount, JSON.stringify(c)); } catch {}
  }, []);

  // ======================== SET COMPLETED ========================

  const onSetCompleted = useCallback(
    async (
      exercise: ExerciseCard,
      set: ExerciseSet,
      allBlocks: WorkoutBlock[],
    ): Promise<{ newBadges: Badge[]; prCard: PRCard | null }> => {
      // 1. Update streak
      const newStreak = computeNewStreak(streak);
      setStreak(newStreak);
      persistStreak(newStreak);

      // 2. Check for PR
      const { card: prCard, updatedBests } = checkForPR(exercise, set, bestMap);
      const newBestMap = { ...bestMap, [exercise.id]: updatedBests };
      setBestMap(newBestMap);
      persistBestMap(newBestMap);

      if (prCard) {
        const newCards = [prCard, ...prCards];
        setPRCards(newCards);
        persistPRCards(newCards);
      }

      // 3. Check badges
      const stats = computeStats(allBlocks, blockCount, newStreak);
      const newBadges = checkBadges(stats, badges);
      if (newBadges.length > 0) {
        const allBadges = [...badges, ...newBadges];
        setBadges(allBadges);
        persistBadges(allBadges);
      }

      return { newBadges, prCard };
    },
    [streak, bestMap, prCards, badges, blockCount, persistStreak, persistBestMap, persistPRCards, persistBadges],
  );

  // ======================== BLOCK CREATED ========================

  const onBlockCreated = useCallback(
    async (allBlocks: WorkoutBlock[]): Promise<{ newBadges: Badge[] }> => {
      const newCount = blockCount + 1;
      setBlockCount(newCount);
      persistBlockCount(newCount);

      const stats = computeStats(allBlocks, newCount, streak);
      const newBadges = checkBadges(stats, badges);
      if (newBadges.length > 0) {
        const allBadges = [...badges, ...newBadges];
        setBadges(allBadges);
        persistBadges(allBadges);
      }

      return { newBadges };
    },
    [blockCount, streak, badges, persistBlockCount, persistBadges],
  );

  // ======================== MISSION COMPLETED ========================

  const onMissionCompleted = useCallback(
    async (allBlocks: WorkoutBlock[]): Promise<{ newBadges: Badge[] }> => {
      const newCount = missionCount + 1;
      setMissionCount(newCount);
      persistMissionCount(newCount);

      const stats = { ...computeStats(allBlocks, blockCount, streak), completedMissions: newCount };
      const newBadges = checkBadges(stats, badges);
      if (newBadges.length > 0) {
        const allBadges = [...badges, ...newBadges];
        setBadges(allBadges);
        persistBadges(allBadges);
      }

      return { newBadges };
    },
    [missionCount, blockCount, streak, badges, persistMissionCount, persistBadges],
  );

  // ======================== RESET ========================

  const resetGamification = useCallback(async () => {
    setStreak(createEmptyStreak());
    setBadges([]);
    setPRCards([]);
    setBestMap({});
    setBlockCount(0);
    setMissionCount(0);
    await Promise.all(
      Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)),
    );
  }, []);

  // ======================== VALUE ========================

  const value = useMemo<GamificationContextType>(
    () => ({
      streak,
      badges,
      prCards,
      isLoading,
      onSetCompleted,
      onBlockCreated,
      onMissionCompleted,
      resetGamification,
    }),
    [streak, badges, prCards, isLoading, onSetCompleted, onBlockCreated, onMissionCompleted, resetGamification],
  );

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification(): GamificationContextType {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error('useGamification must be used within GamificationProvider');
  return ctx;
}
