import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { TrainingProvider } from './src/context/TrainingContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { GamificationProvider } from './src/context/GamificationContext';
import { TreeProvider } from './src/context/TreeContext';
import { MissionBridge } from './src/context/MissionBridge';
import { useAuthStore, startAuthListener } from './src/store/useAuthStore';
import { ThemeProvider } from './src/theme/ThemeContext';

// Separate component so useAuthStore hook runs inside the React tree
// (after GestureHandlerRootView / SafeAreaProvider are mounted).
function AppContent() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // Restore existing Supabase session from AsyncStorage and load profile
    initialize();
    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const unsubscribe = startAuthListener();
    return unsubscribe;
  }, [initialize]);

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
