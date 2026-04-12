// KAIROS — App Navigator
// Conditional root: onboarding flow vs main dashboard.
// 5-tab layout: Home, Blocks, Logros, Progress, Profile.
// Badges and PRCards are stack screens on top of the tabs.

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingChatScreen from '../screens/OnboardingChatScreen';

import HomeTab from '../screens/tabs/HomeTab';
import BlockLibraryScreen from '../screens/BlockLibraryScreen';
import AchievementsTab from '../screens/tabs/AchievementsTab';
import ProgressTab from '../screens/tabs/ProgressTab';
import ProfileTab from '../screens/tabs/ProfileTab';
import BadgesScreen from '../screens/BadgesScreen';
import PRCardsScreen from '../screens/PRCardsScreen';
import ProgressTreeScreen from '../screens/ProgressTreeScreen';
import CustomTabBar from '../components/CustomTabBar';
import { useUserProfile } from '../context/UserProfileContext';
import { Colors } from '../theme/index';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeTab} />
      <Tab.Screen name="WorkoutTab" component={BlockLibraryScreen} />
      <Tab.Screen name="AchievementsTab" component={AchievementsTab} />
      <Tab.Screen name="ProgressTab" component={ProgressTab} />
      <Tab.Screen name="ProfileTab" component={ProfileTab} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoading, isOnboardingComplete } = useUserProfile();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background.void, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.accent.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isOnboardingComplete ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardTabs} />
            <Stack.Screen name="Badges" component={BadgesScreen} />
            <Stack.Screen name="PRCards" component={PRCardsScreen} />
            <Stack.Screen name="ProgressTree" component={ProgressTreeScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen
              name="Onboarding"
              component={OnboardingChatScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen name="Dashboard" component={DashboardTabs} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
