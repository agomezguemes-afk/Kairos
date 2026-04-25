// KAIROS — Navigation Types
// Centralised param lists for type-safe navigation.

import type { NavigatorScreenParams } from '@react-navigation/native';

// ======================== TAB PARAMS ========================

export type DashboardTabParamList = {
  HomeTab: undefined;
  WorkoutTab: { highlightBlockId?: string } | undefined;
  AchievementsTab: undefined;
  AILabTab: undefined;
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
  Badges: undefined;
  PRCards: undefined;
  ProgressTree: undefined;
  AIChat: undefined;
};
