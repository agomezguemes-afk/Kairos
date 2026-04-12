import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { TrainingProvider } from './src/context/TrainingContext';
import { UserProfileProvider } from './src/context/UserProfileContext';
import { GamificationProvider } from './src/context/GamificationContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UserProfileProvider>
          <GamificationProvider>
            <TrainingProvider>
              <AppNavigator />
            </TrainingProvider>
          </GamificationProvider>
        </UserProfileProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
