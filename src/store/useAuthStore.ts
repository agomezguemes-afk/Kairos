// KAIROS — Auth Store
// Zustand store for Supabase session + profile sync.
// Kept separate from workoutStore so auth state is a clean, independent slice.

import { create } from 'zustand';
import type { Session, AuthError, PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, FitnessLevel, FitnessGoal, WorkoutPlace } from '../types/profile';
import type { Discipline } from '../types/core';
import { createEmptyProfile } from '../types/profile';

// ======================== SUPABASE ROW SHAPE ========================
// Mirrors the `profiles` table. Snake_case matches Postgres convention.

interface SupabaseProfileRow {
  id: string;
  name: string | null;           // your existing column (kept as-is)
  display_name: string | null;   // added via ALTER TABLE
  fitness_level: string | null;
  primary_goal: string | null;
  disciplines: string[] | null;
  weekly_frequency: number | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  injuries: string | null;
  workout_place: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProfile(row: SupabaseProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name ?? row.name,  // prefer new column, fall back to old
    fitnessLevel: (row.fitness_level as FitnessLevel | null) ?? null,
    primaryGoal: (row.primary_goal as FitnessGoal | null) ?? null,
    disciplines: (row.disciplines ?? []) as Discipline[],
    weeklyFrequency: row.weekly_frequency,
    age: row.age,
    weight: row.weight_kg,
    height: row.height_cm,
    injuries: row.injuries,
    workoutPlace: (row.workout_place as WorkoutPlace | null) ?? null,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function profileToRow(profile: UserProfile): Omit<SupabaseProfileRow, 'created_at'> {
  return {
    id: profile.id,
    name: profile.displayName,           // keep old column in sync
    display_name: profile.displayName,
    fitness_level: profile.fitnessLevel,
    primary_goal: profile.primaryGoal,
    disciplines: profile.disciplines,
    weekly_frequency: profile.weeklyFrequency,
    age: profile.age,
    weight_kg: profile.weight,
    height_cm: profile.height,
    injuries: profile.injuries,
    workout_place: profile.workoutPlace,
    onboarding_completed_at: profile.onboardingCompletedAt,
    updated_at: new Date().toISOString(),
  };
}

// ======================== STORE SHAPE ========================

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<AuthError | null>;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  loadProfile: (userId: string) => Promise<UserProfile | null>;
  upsertProfile: (updates: Partial<UserProfile>) => Promise<AuthError | PostgrestError | null>;
  clearError: () => void;
}

// ======================== STORE ========================

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      set({ session });
      if (session?.user) {
        await get().loadProfile(session.user.id);
      }
    } catch (e) {
      console.warn('[Kairos/Auth] initialize error:', e);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ isLoading: false, error: error.message });
      return error;
    }
    if (data.user) {
      // The handle_new_user trigger already created the profile row.
      // Just load it so we have it in state.
      set({ session: data.session });
      await get().loadProfile(data.user.id);
      set({ isLoading: false });
    } else {
      set({ isLoading: false });
    }
    return null;
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      return error;
    }
    set({ session: data.session });
    if (data.user) {
      await get().loadProfile(data.user.id);
    }
    set({ isLoading: false });
    return null;
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ session: null, profile: null, isLoading: false, error: null });
  },

  loadProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Row doesn't exist yet — create a blank one
      if (error?.code === 'PGRST116') {
        const blank = createEmptyProfile();
        blank.id = userId;
        await supabase.from('profiles').upsert(profileToRow(blank));
        set({ profile: blank });
        return blank;
      }
      console.warn('[Kairos/Auth] loadProfile error:', error?.message);
      return null;
    }

    const profile = rowToProfile(data as SupabaseProfileRow);
    set({ profile });
    return profile;
  },

  upsertProfile: async (updates) => {
    const current = get().profile;
    const session = get().session;
    if (!session?.user || !current) return null;

    const merged: UserProfile = {
      ...current,
      ...updates,
      id: session.user.id,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(profileToRow(merged));

    if (error) {
      console.warn('[Kairos/Auth] upsertProfile error:', error.message);
      return error;
    }

    set({ profile: merged });
    return null;
  },

  clearError: () => set({ error: null }),
}));

// ======================== AUTH STATE LISTENER ========================
// Call this once in App.tsx to keep the store in sync with Supabase auth events.

export function startAuthListener(): () => void {
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();
    useAuthStore.setState({ session });

    if (event === 'SIGNED_IN' && session?.user) {
      await store.loadProfile(session.user.id);
    }
    if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ profile: null });
    }
  });

  return () => data.subscription.unsubscribe();
}
