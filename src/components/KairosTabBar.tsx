// KAIROS — Tab Bar v3 (floating capsule, simplified active state)
// Spec: docs/superpowers/specs/2026-04-27-kairos-visual-refinement-design.md §4.1
//
// Design:
//   - Floating capsule with BlurView + warm overlay, hairline border, elevated shadow.
//   - Single animated gold glow pill tracks the active tab (springs.indicator).
//   - Icon-only. accessibilityLabel carries the human name for VoiceOver.
//   - Active icon: strokeWidth 2, gold. Inactive: strokeWidth 1.6, ink.muted.
//     Color and weight swap on focus change (no cross-fade — Apple-style snap).
//   - Pop on focus: scale 1.0 → 1.12 → 1.0 in 240ms via spring (springs.tap).
//   - Haptic on tab change: selectionAsync.

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon, { type KIconName } from './icons/KIcon';
import { Colors, Radius, Shadows, Spacing } from '../theme/tokens';
import { springs, timings } from '../theme/animations';

const BAR_HEIGHT = 56;
const PILL_SIZE  = 36;

const TAB_ICONS: Record<string, KIconName> = {
  HomeTab:     'note',
  WorkoutTab:  'zap',
  ProgressTab: 'chart',
  ProfileTab:  'settings',
};

const TAB_LABELS: Record<string, string> = {
  HomeTab:     'Hoy',
  WorkoutTab:  'Bloques',
  ProgressTab: 'Progreso',
  ProfileTab:  'Perfil',
};

interface TabIconProps {
  name: KIconName;
  focused: boolean;
}

/**
 * Tab icon with snap color/weight switch on focus and a subtle scale-pop
 * to reinforce the change. No cross-fade layer — the gold pill behind
 * the icon already carries the spatial motion; the icon itself reads as
 * a discrete state change, which is faster and matches iOS conventions.
 */
const TabIcon = React.memo(function TabIcon({ name, focused }: TabIconProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!focused || reduceMotion) return;
    // Pop only when becoming focused. Inactive→inactive shouldn't fire.
    scale.value = withSequence(
      withSpring(1.12, { ...springs.tap, mass: 0.4 }),
      withSpring(1.0,  springs.tap),
    );
  }, [focused, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[iconStyles.wrapper, animatedStyle]}>
      <KIcon
        name={name}
        size={22}
        color={focused ? Colors.gold.base : Colors.ink.muted}
        strokeWidth={focused ? 2 : 1.6}
      />
    </Animated.View>
  );
});

const iconStyles = StyleSheet.create({
  wrapper: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function KairosTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Layout of the bar — needed to position the pill.
  const tabWidthsRef = useRef<number[]>([]);
  const tabXsRef    = useRef<number[]>([]);
  const pillX       = useSharedValue(0);
  const pillVisible = useSharedValue(0);

  const updatePill = useCallback((index: number) => {
    const x = tabXsRef.current[index];
    const w = tabWidthsRef.current[index];
    if (x === undefined || w === undefined) return;
    // Center the pill within the tab.
    pillX.value = withSpring(x + (w - PILL_SIZE) / 2, springs.indicator);
  }, [pillX]);

  // When tabs are laid out, record positions and snap pill to initial active tab.
  const handleTabLayout = useCallback((event: LayoutChangeEvent, index: number) => {
    const { x, width } = event.nativeEvent.layout;
    tabXsRef.current[index]  = x;
    tabWidthsRef.current[index] = width;

    // Once we have all tab positions, position the pill.
    if (tabXsRef.current.filter(Boolean).length === state.routes.length) {
      pillVisible.value = withTiming(1, timings.fast);
      updatePill(state.index);
    }
  }, [state.routes.length, state.index, pillVisible, updatePill]);

  // Animate pill when active index changes.
  useEffect(() => {
    updatePill(state.index);
  }, [state.index, updatePill]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    opacity: pillVisible.value,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 16,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Floating capsule */}
      <View style={styles.capsule}>
        {/* Blur layer */}
        <BlurView
          intensity={28}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        {/* Warm overlay on top of blur */}
        <View style={[StyleSheet.absoluteFill, styles.warmOverlay]} />

        {/* Animated gold pill — sits below icons */}
        <Animated.View
          style={[styles.pill, pillStyle]}
          pointerEvents="none"
        />

        {/* Tabs */}
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          const icon    = TAB_ICONS[route.name] ?? 'note';
          const label   = TAB_LABELS[route.name] ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={focused ? { selected: true } : undefined}
              hitSlop={8}
              onLayout={(e) => handleTabLayout(e, idx)}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
                }
              }}
              style={styles.tab}
            >
              <TabIcon name={icon} focused={focused} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left:  Spacing.lg,
    right: Spacing.lg,
    // bottom set inline using insets
  },
  capsule: {
    height: BAR_HEIGHT,
    borderRadius: Radius['3xl'],
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    ...Shadows.elevated,
  },
  warmOverlay: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: Radius['3xl'],
  },
  pill: {
    position: 'absolute',
    top: (BAR_HEIGHT - PILL_SIZE) / 2,
    left: 0,
    width:  PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    backgroundColor: Colors.gold.glow,
  },
  tab: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
