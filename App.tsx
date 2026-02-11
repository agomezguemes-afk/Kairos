import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { TrainingProvider } from './src/context/TrainingContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TrainingProvider>
        <AppNavigator />
      </TrainingProvider>
    </GestureHandlerRootView>
  );
}
