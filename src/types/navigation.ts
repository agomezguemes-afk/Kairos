// KAIROS — Navigation Types
// Centralised param lists for type-safe navigation.

import type { NavigatorScreenParams } from '@react-navigation/native';

// ======================== TAB PARAMS ========================

export type DashboardTabParamList = {
  HomeTab: undefined;
  WorkoutTab: { highlightBlockId?: string } | undefined;
  ProgressTab: undefined;
  ProfileTab: undefined;
};

// ======================== ROOT STACK PARAMS ========================

export type RootStackParamList = {
  // Auth
  Welcome: undefined;
  Auth: undefined;
  ProfileSetup: undefined;
  // Legacy onboarding (kept for local-only users who skip Supabase)
  Onboarding: undefined;
  // Main app
  Dashboard: NavigatorScreenParams<DashboardTabParamList> | undefined;
  BlockDetail: { blockId: string };
  Canvas: { blockId: string };
  ActiveWorkout: {
    blockId: string;
    /** Schedule assignment this session belongs to. Absent for free starts. */
    assignmentId?: string;
    /** ISO date YYYY-MM-DD this session is scheduled for. Defaults to today when absent. */
    scheduledDate?: string;
    /** Where the user came from. Drives history attribution + Kai signal context. */
    source?: 'today' | 'calendar' | 'free' | 'history';
  };
  Badges: undefined;
  PRCards: undefined;
  ProgressTree: undefined;
  AIChat: undefined;
  AILabScreen: undefined;
};
