// KAIROS — Custom Tab Bar
// Animated bottom tab bar with Feather icons and sliding gold indicator.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Typography, Animation } from '../theme/index';

const TAB_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; label: string }> = {
  HomeTab: { icon: 'home', label: 'Inicio' },
  WorkoutTab: { icon: 'grid', label: 'Bloques' },
  AchievementsTab: { icon: 'award', label: 'Logros' },
  AILabTab: { icon: 'cpu', label: 'AI Lab' },
  ProfileTab: { icon: 'user', label: 'Perfil' },
};

const INDICATOR_WIDTH = 24;
const SCREEN_W = Dimensions.get('window').width;

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;

  // Compute indicator X position from tab index using screen width.
  const tabWidth = SCREEN_W / tabCount;
  const indicatorX = useSharedValue(state.index * tabWidth + tabWidth / 2 - INDICATOR_WIDTH / 2);

  // Update indicator when tab changes.
  React.useEffect(() => {
    const targetX = state.index * tabWidth + tabWidth / 2 - INDICATOR_WIDTH / 2;
    indicatorX.value = withSpring(targetX, Animation.spring.ios);
  }, [state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Sliding indicator */}
      <Animated.View style={[styles.indicator, indicatorStyle]} />

      {state.routes.map((route, index) => {
        const config = TAB_CONFIG[route.name] ?? { icon: 'circle' as const, label: route.name };
        const isFocused = state.index === index;

        return (
          <TabButton
            key={route.key}
            icon={config.icon}
            label={config.label}
            isFocused={isFocused}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

interface TabButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  isFocused: boolean;
  onPress: () => void;
}

const TabButton = React.memo(({ icon, label, isFocused, onPress }: TabButtonProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPressIn={() => {
        scale.value = withSpring(0.85, Animation.spring.tabIcon);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Animation.spring.tabIcon);
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        <Feather
          name={icon}
          size={22}
          color={isFocused ? Colors.accent.primary : Colors.text.tertiary}
        />
        <Text
          style={[
            styles.label,
            { color: isFocused ? Colors.accent.primary : Colors.text.tertiary },
            isFocused && styles.labelActive,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: INDICATOR_WIDTH,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.accent.primary,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: Typography.weight.medium,
    marginTop: 4,
  },
  labelActive: {
    fontWeight: Typography.weight.semibold,
  },
});
