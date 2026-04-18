// KAIROS — App Navigator
// Three-tier routing: unauthenticated → auth setup → main dashboard.
// When SKIP_AUTH is true the app bypasses all auth checks and shows
// the main tabs directly (with a SplashScreen overlay on first launch).

import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, DashboardTabParamList } from '../types/navigation';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import OnboardingChatScreen from '../screens/OnboardingChatScreen';
import SplashScreen from '../screens/SplashScreen';

import HomeTab from '../screens/tabs/HomeTab';
import BlockLibraryScreen from '../screens/BlockLibraryScreen';
import AchievementsTab from '../screens/tabs/AchievementsTab';
import AILabScreen from '../screens/AILabScreen';
import ProfileTab from '../screens/tabs/ProfileTab';
import BadgesScreen from '../screens/BadgesScreen';
import PRCardsScreen from '../screens/PRCardsScreen';
import ProgressTreeScreen from '../screens/ProgressTreeScreen';
import AIChatScreen from '../screens/AIChatScreen';
import CustomTabBar from '../components/CustomTabBar';

import { useAuthStore } from '../store/useAuthStore';
import { useUserProfile } from '../context/UserProfileContext';
import { Colors } from '../theme/index';
import { SKIP_AUTH } from '../config/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<DashboardTabParamList>();

// ======================== DASHBOARD TABS ========================

function DashboardTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab"         component={HomeTab} />
      <Tab.Screen name="WorkoutTab"      component={BlockLibraryScreen} />
      <Tab.Screen name="AchievementsTab" component={AchievementsTab} />
      <Tab.Screen name="AILabTab"        component={AILabScreen} />
      <Tab.Screen name="ProfileTab"      component={ProfileTab} />
    </Tab.Navigator>
  );
}

// ======================== MAIN NAVIGATOR ========================

export default function AppNavigator() {
  const { session, isInitialized } = useAuthStore();
  const { isLoading: profileLoading, isOnboardingComplete } = useUserProfile();

  // Splash overlay state — shown once on launch
  const [splashVisible, setSplashVisible] = useState(true);

  // ── SKIP_AUTH mode: jump straight to the dashboard ──────────────
  if (SKIP_AUTH) {
    return (
      <>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Dashboard"    component={DashboardTabs} />
            <Stack.Screen name="Badges"        component={BadgesScreen} />
            <Stack.Screen name="PRCards"       component={PRCardsScreen} />
            <Stack.Screen name="ProgressTree"  component={ProgressTreeScreen} />
            <Stack.Screen name="AIChat"        component={AIChatScreen} />
          </Stack.Navigator>
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
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.background.void,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={Colors.accent.primary} />
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
            <Stack.Screen name="Welcome"      component={WelcomeScreen} />
            <Stack.Screen name="Auth"          component={AuthScreen} />
          </>
        ) : !isOnboardingComplete ? (
          <>
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            <Stack.Screen name="Onboarding"   component={OnboardingChatScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard"    component={DashboardTabs} />
            <Stack.Screen name="Badges"        component={BadgesScreen} />
            <Stack.Screen name="PRCards"       component={PRCardsScreen} />
            <Stack.Screen name="ProgressTree"  component={ProgressTreeScreen} />
            <Stack.Screen name="AIChat"        component={AIChatScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
