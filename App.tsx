import React from 'react';
<<<<<<< HEAD
import AppNavigator from './src/navigation/AppNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TrainingProvider } from './src/context/TrainingContext';

export default function App() {
  return (
    <TrainingProvider>
      <AppNavigator />
    </TrainingProvider>
=======
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from './src/screens/WelcomeScreen';
import SetupScreen from './src/screens/SetupScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false, // quitamos la barra superior
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
>>>>>>> 5bcc65205956b5acdd0b4049749b663822733ed5
  );
}
