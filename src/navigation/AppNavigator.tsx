// KAIROS — App Navigator (Updated for V3)
// CAMBIO: WorkoutTab reemplazado por BlockLibraryScreen

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Screens existentes (no tocar)
import WelcomeScreen from '../screens/WelcomeScreen';
import SetupScreen from '../screens/SetupScreen';

// Tabs
import HomeTab from '../screens/tabs/HomeTab';
import BlockLibraryScreen from '../screens/BlockLibraryScreen';
import ProgressTab from '../screens/tabs/ProgressTab';
import ProfileTab from '../screens/tabs/ProfileTab';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(0,0,0,0.08)',
          borderTopWidth: 0.5,
          height: 90,
          paddingBottom: 30,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: '#C9A96E',
        tabBarInactiveTintColor: '#ADADAD',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTab}
        options={{
          tabBarLabel: 'Inicio',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="WorkoutTab"
        component={BlockLibraryScreen}
        options={{
          tabBarLabel: 'Blocks',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>📂</Text>,
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressTab}
        options={{
          tabBarLabel: 'Progreso',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTab}
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: () => <Text style={{ fontSize: 24 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Dashboard" component={DashboardTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
