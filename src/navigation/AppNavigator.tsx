// KAIROS — App Navigator
// Three-tier routing: unauthenticated → auth setup → main dashboard.
// When SKIP_AUTH is true the app bypasses all auth checks and shows
// the main tabs directly (with a SplashScreen overlay on first launch).

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, DashboardTabParamList } from '../types/navigation';
import AnimatedKairosLogo from '../components/AnimatedKairosLogo';
import { Type, Spacing } from '../theme/tokens';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import OnboardingChatScreen from '../screens/OnboardingChatScreen';
import SplashScreen from '../screens/SplashScreen';

import HomeTab from '../screens/tabs/HomeTab';
import BlocksScreen from '../features/blocks/BlocksScreen';
import BlockEditorScreen from '../features/blocks/BlockEditorScreen';
import ProgressTab from '../screens/tabs/ProgressTab';
import AILabScreen from '../screens/AILabScreen';
import ProfileTab from '../screens/tabs/ProfileTab';
import BadgesScreen from '../screens/BadgesScreen';
import PRCardsScreen from '../screens/PRCardsScreen';
import ProgressTreeScreen from '../screens/ProgressTreeScreen';
import AIChatScreen from '../screens/AIChatScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import KairosTabBar from '../components/KairosTabBar';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

import { useAuthStore } from '../store/useAuthStore';
import { useUserProfile } from '../context/UserProfileContext';
import { useWorkoutStore } from '../store/workoutStore';
import { Colors } from '../theme/index';
import { SKIP_AUTH } from '../config/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<DashboardTabParamList>();

// ======================== DASHBOARD TABS ========================

function DashboardTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <KairosTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Tab bar is floating (absolute), so screens extend behind it.
        // Each screen's ScrollView adds paddingBottom: 88 to compensate.
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeTab} />
      <Tab.Screen name="WorkoutTab" component={BlocksScreen} />
      <Tab.Screen name="ProgressTab" component={ProgressTab} />
      <Tab.Screen name="ProfileTab" component={ProfileTab} />
    </Tab.Navigator>
  );
}

// ======================== MAIN NAVIGATOR ========================

export default function AppNavigator() {
  const { session, isInitialized } = useAuthStore();
  const { isLoading: profileLoading, isOnboardingComplete } = useUserProfile();
  // Canonical gate: flipped by workoutStore.completeOnboarding() when the
  // user accepts their generated space. Persisted; migration v4 backfills
  // users onboarded under the old userName-based gate.
  const onboardingCompletedAt = useWorkoutStore((s) => s.onboardingCompletedAt);
  const onboarded = onboardingCompletedAt !== null;

  // Splash overlay state — shown once on launch
  const [splashVisible, setSplashVisible] = useState(true);

  // ── SKIP_AUTH mode: jump straight to the dashboard ──────────────
  if (SKIP_AUTH) {
    return (
      <>
        <NavigationContainer>
          {onboarded ? (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Dashboard" component={DashboardTabs} />
              <Stack.Screen
                name="BlockDetail"
                component={BlockEditorScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ActiveWorkout"
                component={ActiveWorkoutScreen}
                options={{
                  // Immersive full-screen presentation so the dashboard
                  // never peeks behind the active session. Slide-from-
                  // bottom for the "arranca" affordance + a slightly
                  // longer easing curve so the transition reads as a
                  // moment, not a swipe. Gesture dismissal blocked —
                  // a workout shouldn't end by accident.
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom',
                  animationDuration: 380,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen name="Badges" component={BadgesScreen} />
              <Stack.Screen name="PRCards" component={PRCardsScreen} />
              <Stack.Screen name="ProgressTree" component={ProgressTreeScreen} />
              <Stack.Screen name="AIChat" component={AIChatScreen} />
              <Stack.Screen
                name="AILabScreen"
                component={AILabScreen}
                options={{ presentation: 'modal' }}
              />
            </Stack.Navigator>
          ) : (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Dashboard" component={DashboardTabs} />
              <Stack.Screen
                name="BlockDetail"
                component={BlockEditorScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ActiveWorkout"
                component={ActiveWorkoutScreen}
                options={{
                  // Immersive full-screen presentation so the dashboard
                  // never peeks behind the active session. Slide-from-
                  // bottom for the "arranca" affordance + a slightly
                  // longer easing curve so the transition reads as a
                  // moment, not a swipe. Gesture dismissal blocked —
                  // a workout shouldn't end by accident.
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom',
                  animationDuration: 380,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen name="Badges" component={BadgesScreen} />
              <Stack.Screen name="PRCards" component={PRCardsScreen} />
              <Stack.Screen name="ProgressTree" component={ProgressTreeScreen} />
              <Stack.Screen name="AIChat" component={AIChatScreen} />
              <Stack.Screen
                name="AILabScreen"
                component={AILabScreen}
                options={{ presentation: 'modal' }}
              />
            </Stack.Navigator>
          )}
        </NavigationContainer>

        {/* Splash sits on top of everything and fades itself out */}
        {splashVisible && <SplashScreen onDone={() => setSplashVisible(false)} />}
      </>
    );
  }

  // ── Auth mode: wait for Supabase init ────────────────────────────
  if (!isInitialized || profileLoading) {
    return (
      <>
        <View style={loadingStyles.container}>
          <AnimatedKairosLogo size={72} />
          <Text style={loadingStyles.caption}>Preparando tu espacio</Text>
        </View>
        {splashVisible && <SplashScreen onDone={() => setSplashVisible(false)} />}
      </>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        ) : !isOnboardingComplete ? (
          <>
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingChatScreen} />
          </>
        ) : !onboarded ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Dashboard" component={DashboardTabs} />
            <Stack.Screen
              name="BlockDetail"
              component={BlockEditorScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ActiveWorkout"
              component={ActiveWorkoutScreen}
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardTabs} />
            <Stack.Screen
              name="BlockDetail"
              component={BlockEditorScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ActiveWorkout"
              component={ActiveWorkoutScreen}
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            <Stack.Screen name="Badges" component={BadgesScreen} />
            <Stack.Screen name="PRCards" component={PRCardsScreen} />
            <Stack.Screen name="ProgressTree" component={ProgressTreeScreen} />
            <Stack.Screen name="AIChat" component={AIChatScreen} />
            <Stack.Screen
              name="AILabScreen"
              component={AILabScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.void,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  caption: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
});
