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
import { ThemeProvider } from './src/theme/ThemeContext';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  SpaceMono_400Regular_Italic,
  SpaceMono_700Bold_Italic,
} from '@expo-google-fonts/space-mono';

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
  const [fontsLoaded, fontError] = useFonts({
    Anton_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular_Italic,
    SpaceMono_700Bold_Italic,
  });
  // A font load failure must not brick the app: system fonts are an
  // acceptable fallback, so only wait while loading is still pending.
  if (!fontsLoaded && !fontError) return null;

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
