// KAIROS — Tab Bar v4 (direction "D · Bloque", 2026-11-09)
//
// A brutalist capsule: 2px ink outline + hard offset shadow. The active tab
// grows into a gold pill that shows its label; inactive tabs are icons.
// Width and label animate together so the eye follows where focus went.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon, { type KIconName } from './icons/KIcon';
import { Brut, Spacing } from '../theme/tokens';
import { BText } from '../features/coach/ui/brut';

const BAR_HEIGHT = 58;
const TAB_SIZE = 44;
const ACTIVE_W = 112;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

const TAB_ICONS: Record<string, KIconName> = {
  CoachTab: 'unlock',
  HomeTab: 'note',
  WorkoutTab: 'zap',
  ProgressTab: 'chart',
  ProfileTab: 'settings',
};

const TAB_LABELS: Record<string, string> = {
  CoachTab: 'Coach',
  HomeTab: 'Hoy',
  WorkoutTab: 'Bloques',
  ProgressTab: 'Progreso',
  ProfileTab: 'Perfil',
};

interface TabProps {
  icon: KIconName;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const Tab = React.memo(function Tab({ icon, label, focused, onPress, onLongPress }: TabProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    t.value = reduce
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, { duration: Brut.motion.tab, easing: EASE });
  }, [focused, reduce, t]);

  const pill = useAnimatedStyle(() => ({
    width: interpolate(t.value, [0, 1], [TAB_SIZE, ACTIVE_W]),
    backgroundColor: interpolateColor(t.value, [0, 1], ['rgba(201,169,110,0)', Brut.accent]),
    borderColor: interpolateColor(t.value, [0, 1], ['rgba(18,18,17,0)', Brut.ink]),
  }));
  // The label fades in after the pill has started opening, so it never
  // renders squashed inside a pill that is still too narrow.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.45, 1], [0, 1], 'clamp'),
    maxWidth: interpolate(t.value, [0, 1], [0, ACTIVE_W - 40]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
    >
      <Animated.View style={[styles.tab, pill]}>
        <KIcon name={icon} size={20} color={Brut.ink} strokeWidth={focused ? 2.2 : 1.8} />
        <Animated.View style={[styles.labelWrap, labelStyle]}>
          <BText variant="bodyBold" size={13} numberOfLines={1}>
            {label}
          </BText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

export default function KairosTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { bottom: insets.bottom + Spacing.md }]}
      pointerEvents="box-none"
    >
      <View style={styles.shadow} pointerEvents="none" />
      <View style={styles.capsule}>
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          return (
            <Tab
              key={route.key}
              icon={TAB_ICONS[route.name] ?? 'note'}
              label={TAB_LABELS[route.name] ?? route.name}
              focused={focused}
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
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg + Brut.shadow.sm,
  },
  shadow: {
    position: 'absolute',
    top: Brut.shadow.sm,
    left: Brut.shadow.sm,
    right: -Brut.shadow.sm,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: Brut.ink,
  },
  capsule: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  tab: {
    height: TAB_SIZE,
    borderRadius: TAB_SIZE / 2,
    borderWidth: Brut.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  labelWrap: { overflow: 'hidden' },
});
