// KAIROS — User Profile Context
// Manages onboarding state and user profile data.
// Persists to AsyncStorage; structured for future Supabase sync.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, FitnessLevel, FitnessGoal } from '../types/profile';
import type { Discipline } from '../types/core';
import { createEmptyProfile } from '../types/profile';

const PROFILE_KEY = 'kairos_user_profile';

interface UserProfileContextType {
  profile: UserProfile;
  isLoading: boolean;
  isOnboardingComplete: boolean;

  // Setters for individual fields (used during onboarding)
  setFitnessLevel: (level: FitnessLevel) => void;
  setPrimaryGoal: (goal: FitnessGoal) => void;
  setDisciplines: (disciplines: Discipline[]) => void;
  setWeeklyFrequency: (freq: number) => void;
  setBodyStats: (stats: { age?: number; weight?: number; height?: number }) => void;
  setDisplayName: (name: string) => void;

  // Complete onboarding — sets the flag and persists everything
  completeOnboarding: () => Promise<void>;

  // Update profile (post-onboarding edits)
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;

  // Reset (for development / logout)
  resetProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile);
  const [isLoading, setIsLoading] = useState(true);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (raw) {
          const parsed: UserProfile = JSON.parse(raw);
          setProfile(parsed);
        }
      } catch (e) {
        console.warn('Kairos: Error loading user profile', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (updated: UserProfile) => {
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Kairos: Error saving user profile', e);
    }
  }, []);

  const update = useCallback(
    (updater: (prev: UserProfile) => UserProfile) => {
      setProfile((prev) => {
        const next = { ...updater(prev), updatedAt: new Date().toISOString() };
        // Fire-and-forget persistence
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setFitnessLevel = useCallback(
    (fitnessLevel: FitnessLevel) => update((p) => ({ ...p, fitnessLevel })),
    [update],
  );
  const setPrimaryGoal = useCallback(
    (primaryGoal: FitnessGoal) => update((p) => ({ ...p, primaryGoal })),
    [update],
  );
  const setDisciplines = useCallback(
    (disciplines: Discipline[]) => update((p) => ({ ...p, disciplines })),
    [update],
  );
  const setWeeklyFrequency = useCallback(
    (weeklyFrequency: number) => update((p) => ({ ...p, weeklyFrequency })),
    [update],
  );
  const setBodyStats = useCallback(
    (stats: { age?: number; weight?: number; height?: number }) =>
      update((p) => ({
        ...p,
        ...(stats.age !== undefined && { age: stats.age }),
        ...(stats.weight !== undefined && { weight: stats.weight }),
        ...(stats.height !== undefined && { height: stats.height }),
      })),
    [update],
  );
  const setDisplayName = useCallback(
    (displayName: string) => update((p) => ({ ...p, displayName })),
    [update],
  );

  const completeOnboarding = useCallback(async () => {
    const now = new Date().toISOString();
    setProfile((prev) => {
      const next: UserProfile = { ...prev, onboardingCompletedAt: now, updatedAt: now };
      persist(next);
      return next;
    });
  }, [persist]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      update((p) => ({ ...p, ...updates }));
    },
    [update],
  );

  const resetProfile = useCallback(async () => {
    const fresh = createEmptyProfile();
    setProfile(fresh);
    await AsyncStorage.removeItem(PROFILE_KEY);
  }, []);

  const isOnboardingComplete = profile.onboardingCompletedAt !== null;

  const value = useMemo<UserProfileContextType>(
    () => ({
      profile,
      isLoading,
      isOnboardingComplete,
      setFitnessLevel,
      setPrimaryGoal,
      setDisciplines,
      setWeeklyFrequency,
      setBodyStats,
      setDisplayName,
      completeOnboarding,
      updateProfile,
      resetProfile,
    }),
    [
      profile,
      isLoading,
      isOnboardingComplete,
      setFitnessLevel,
      setPrimaryGoal,
      setDisciplines,
      setWeeklyFrequency,
      setBodyStats,
      setDisplayName,
      completeOnboarding,
      updateProfile,
      resetProfile,
    ],
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextType {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
}
