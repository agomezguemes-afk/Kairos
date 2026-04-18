// KAIROS — Mission Context
// Manages active mission, completed missions, and skip count.
// Persisted to AsyncStorage under @kairos_mission_* keys.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Mission, CompletedMission } from '../types/mission';
import type { WorkoutBlock } from '../types/core';
import type { Streak, Badge, PRCard } from '../types/gamification';
import {
  generateWeeklyMission,
  evaluateMissionProgress,
  isMissionCompleted,
  getCurrentWeekId,
} from '../services/missionService';

// ======================== STORAGE KEYS ========================

const KEYS = {
  activeMission: '@kairos_active_mission',
  completedMissions: '@kairos_completed_missions',
  skipCount: '@kairos_mission_skip_count',
  skipWeek: '@kairos_mission_skip_week',
  weeklyPRCount: '@kairos_mission_weekly_prs',
  weeklyPRWeek: '@kairos_mission_weekly_pr_week',
} as const;

const MAX_SKIPS = 3;

// ======================== CONTEXT TYPE ========================

interface MissionContextType {
  activeMission: Mission | null;
  completedMissions: CompletedMission[];
  skipsRemaining: number;
  isLoading: boolean;

  /** Skip the current mission and generate a new one. */
  skipMission: () => Promise<void>;

  /** Accept the current mission (no-op, it's already active). */
  acceptMission: () => void;

  /**
   * Update mission progress. Call after sets are completed / blocks change.
   * Returns true if the mission was just completed.
   */
  updateMissionProgress: (
    blocks: WorkoutBlock[],
    streak: Streak,
  ) => Promise<boolean>;

  /** Record a new PR for mission tracking. */
  recordPRForMission: () => Promise<void>;

  /** Force-generate a new mission (for first load or new week). */
  generateNewMission: () => void;
}

const MissionContext = createContext<MissionContextType | null>(null);

// ======================== PROVIDER ========================

export function MissionProvider({
  children,
  blocks,
  streak,
  badges,
  prCards,
}: {
  children: React.ReactNode;
  blocks: WorkoutBlock[];
  streak: Streak;
  badges: Badge[];
  prCards: PRCard[];
}) {
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [completedMissions, setCompletedMissions] = useState<CompletedMission[]>([]);
  const [skipCount, setSkipCount] = useState(0);
  const [skipWeek, setSkipWeek] = useState('');
  const [weeklyPRCount, setWeeklyPRCount] = useState(0);
  const [weeklyPRWeek, setWeeklyPRWeek] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const currentWeek = getCurrentWeekId();

  // ---- Load from storage ----
  useEffect(() => {
    (async () => {
      try {
        const [rawMission, rawCompleted, rawSkips, rawSkipWeek, rawPRCount, rawPRWeek] =
          await Promise.all([
            AsyncStorage.getItem(KEYS.activeMission),
            AsyncStorage.getItem(KEYS.completedMissions),
            AsyncStorage.getItem(KEYS.skipCount),
            AsyncStorage.getItem(KEYS.skipWeek),
            AsyncStorage.getItem(KEYS.weeklyPRCount),
            AsyncStorage.getItem(KEYS.weeklyPRWeek),
          ]);

        if (rawCompleted) setCompletedMissions(JSON.parse(rawCompleted));

        // Reset skip count if it's a new week
        const storedSkipWeek = rawSkipWeek ?? '';
        if (storedSkipWeek === currentWeek && rawSkips) {
          setSkipCount(JSON.parse(rawSkips));
          setSkipWeek(storedSkipWeek);
        } else {
          setSkipCount(0);
          setSkipWeek(currentWeek);
        }

        // Reset PR count if new week
        const storedPRWeek = rawPRWeek ?? '';
        if (storedPRWeek === currentWeek && rawPRCount) {
          setWeeklyPRCount(JSON.parse(rawPRCount));
          setWeeklyPRWeek(storedPRWeek);
        } else {
          setWeeklyPRCount(0);
          setWeeklyPRWeek(currentWeek);
        }

        // Check if active mission is still valid (same week, not expired)
        if (rawMission) {
          const mission: Mission = JSON.parse(rawMission);
          if (mission.weekId === currentWeek && mission.status === 'active') {
            setActiveMission(mission);
          } else {
            // Expired — clear it, will auto-generate
            setActiveMission(null);
          }
        }
      } catch (e) {
        console.warn('Kairos: Error loading mission data', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ---- Auto-generate mission if none active ----
  useEffect(() => {
    if (!isLoading && activeMission === null) {
      const ctx = {
        streak,
        badges,
        blocks,
        completedMissions,
        prCount: prCards.length,
      };
      const mission = generateWeeklyMission(ctx);
      setActiveMission(mission);
      persistMission(mission);
    }
  }, [isLoading, activeMission]);

  // ---- Persist helpers ----
  const persistMission = useCallback(async (m: Mission | null) => {
    try {
      if (m) {
        await AsyncStorage.setItem(KEYS.activeMission, JSON.stringify(m));
      } else {
        await AsyncStorage.removeItem(KEYS.activeMission);
      }
    } catch {}
  }, []);

  const persistCompleted = useCallback(async (list: CompletedMission[]) => {
    try {
      await AsyncStorage.setItem(KEYS.completedMissions, JSON.stringify(list));
    } catch {}
  }, []);

  const persistSkips = useCallback(async (count: number, week: string) => {
    try {
      await AsyncStorage.setItem(KEYS.skipCount, JSON.stringify(count));
      await AsyncStorage.setItem(KEYS.skipWeek, week);
    } catch {}
  }, []);

  const persistWeeklyPR = useCallback(async (count: number, week: string) => {
    try {
      await AsyncStorage.setItem(KEYS.weeklyPRCount, JSON.stringify(count));
      await AsyncStorage.setItem(KEYS.weeklyPRWeek, week);
    } catch {}
  }, []);

  // ======================== ACTIONS ========================

  const skipMission = useCallback(async () => {
    if (skipCount >= MAX_SKIPS) return;

    const newSkipCount = skipCount + 1;
    setSkipCount(newSkipCount);
    setSkipWeek(currentWeek);
    await persistSkips(newSkipCount, currentWeek);

    const ctx = {
      streak,
      badges,
      blocks,
      completedMissions,
      prCount: prCards.length,
    };
    const excludeIds = activeMission ? [activeMission.id] : [];
    const newMission = generateWeeklyMission(ctx, excludeIds);
    setActiveMission(newMission);
    await persistMission(newMission);
  }, [
    skipCount,
    currentWeek,
    streak,
    badges,
    blocks,
    completedMissions,
    prCards,
    activeMission,
    persistSkips,
    persistMission,
  ]);

  const acceptMission = useCallback(() => {
    // No-op — mission is already active. Could add UI state later.
  }, []);

  const recordPRForMission = useCallback(async () => {
    const week = getCurrentWeekId();
    const newCount = (weeklyPRWeek === week ? weeklyPRCount : 0) + 1;
    setWeeklyPRCount(newCount);
    setWeeklyPRWeek(week);
    await persistWeeklyPR(newCount, week);
  }, [weeklyPRCount, weeklyPRWeek, persistWeeklyPR]);

  const updateMissionProgress = useCallback(
    async (currentBlocks: WorkoutBlock[], currentStreak: Streak): Promise<boolean> => {
      if (!activeMission || activeMission.status !== 'active') return false;

      const newValue = evaluateMissionProgress(
        activeMission,
        currentBlocks,
        currentStreak,
        weeklyPRWeek === currentWeek ? weeklyPRCount : 0,
        new Set<string>(), // TODO: track previous exercise IDs
      );

      const updated: Mission = { ...activeMission, currentValue: newValue };

      if (isMissionCompleted(updated)) {
        updated.status = 'completed';
        updated.completedAt = new Date().toISOString();

        const record: CompletedMission = {
          id: updated.id,
          title: updated.title,
          icon: updated.icon,
          category: updated.category,
          completedAt: updated.completedAt,
          weekId: updated.weekId,
        };

        const newCompleted = [record, ...completedMissions];
        setCompletedMissions(newCompleted);
        await persistCompleted(newCompleted);

        setActiveMission(updated);
        await persistMission(updated);
        return true;
      }

      setActiveMission(updated);
      await persistMission(updated);
      return false;
    },
    [
      activeMission,
      weeklyPRCount,
      weeklyPRWeek,
      currentWeek,
      completedMissions,
      persistCompleted,
      persistMission,
    ],
  );

  const generateNewMission = useCallback(() => {
    const ctx = {
      streak,
      badges,
      blocks,
      completedMissions,
      prCount: prCards.length,
    };
    const mission = generateWeeklyMission(ctx);
    setActiveMission(mission);
    persistMission(mission);
  }, [streak, badges, blocks, completedMissions, prCards, persistMission]);

  // ======================== VALUE ========================

  const skipsRemaining = Math.max(0, MAX_SKIPS - skipCount);

  const value = useMemo<MissionContextType>(
    () => ({
      activeMission,
      completedMissions,
      skipsRemaining,
      isLoading,
      skipMission,
      acceptMission,
      updateMissionProgress,
      recordPRForMission,
      generateNewMission,
    }),
    [
      activeMission,
      completedMissions,
      skipsRemaining,
      isLoading,
      skipMission,
      acceptMission,
      updateMissionProgress,
      recordPRForMission,
      generateNewMission,
    ],
  );

  return (
    <MissionContext.Provider value={value}>
      {children}
    </MissionContext.Provider>
  );
}

export function useMission(): MissionContextType {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission must be used within MissionProvider');
  return ctx;
}
