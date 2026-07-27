import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { TrainingProvider } from './src/context/TrainingContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { GamificationProvider } from './src/context/GamificationContext';
import { TreeProvider } from './src/context/TreeContext';
import { MissionBridge } from './src/context/MissionBridge';
import { useAuthStore, startAuthListener } from './src/store/useAuthStore';
import { seedSyntheticData } from './src/dev/seedSyntheticData';
import { syncDailyBiometricSample } from './src/lib/health/dailySync';
import { ThemeProvider } from './src/theme/ThemeContext';
import FontGate from './src/theme/FontGate';

// Separate component so useAuthStore hook runs inside the React tree
// (after GestureHandlerRootView / SafeAreaProvider are mounted).
function AppContent() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // Restore existing Supabase session from AsyncStorage and load profile
    initialize();
    // DEV demo data (no-op in release / when SEED_SYNTHETIC is off)
    seedSyntheticData();
    // Rolling HRV/sleep sample for the adaptive readiness engine — no-op
    // until HealthKit is natively activated and the user has granted read
    // permission.
    syncDailyBiometricSample();
    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const unsubscribe = startAuthListener();
    return unsubscribe;
  }, [initialize]);

  return (
    <ThemeProvider>
      {/* FontGate holds first paint until the brand faces load — the premium
          onboarding (El Manuscrito) renders with them from the first frame. */}
      <FontGate>
        <UserProfileProvider>
          <GamificationProvider>
            <TreeProvider>
              <MissionBridge>
                <TrainingProvider>
                  <AppNavigator />
                </TrainingProvider>
              </MissionBridge>
            </TreeProvider>
          </GamificationProvider>
        </UserProfileProvider>
      </FontGate>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Light bg (#F7F7F5) — keep status bar text dark across the app.
            Screens with dark/gold full-bleed hero surfaces can override
            locally with another <StatusBar style="light" />. */}
        <StatusBar style="dark" />
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
