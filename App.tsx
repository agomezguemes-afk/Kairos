import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TrainingProvider } from './src/context/TrainingContext';

export default function App() {
  return (
    <TrainingProvider>
      <AppNavigator />
    </TrainingProvider>
  );
}
