// KAIROS — Tab Bar v5 (direction "D · Bloque", 2026-11-09)
//
// Left: a capsule with four groups. The active one grows into a gold pill
// with its label; dragging a finger across the capsule walks the pill to
// the neighbouring groups. Right: a round "start training" button of the
// same height, so the bar reads as two symmetric pieces.

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
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
import { BPress, BText } from '../features/coach/ui/brut';
import { useCoachStore } from '../store/coachStore';

const BAR_HEIGHT = 58;
const TAB_SIZE = 44;
const ACTIVE_W = 104;
/** Finger travel that moves the pill one group. */
const SWIPE_STEP = 56;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

// The bar shows four groups. HomeTab (legacy day log) stays routable but
// is not a group of its own any more: the coach hub is "Hoy".
const GROUPS: { route: string; icon: KIconName; label: string }[] = [
  { route: 'CoachTab', icon: 'unlock', label: 'Hoy' },
  { route: 'WorkoutTab', icon: 'grid', label: 'Bloques' },
  { route: 'ProgressTab', icon: 'chart', label: 'Progreso' },
  { route: 'ProfileTab', icon: 'settings', label: 'Tú' },
];

interface TabProps {
  icon: KIconName;
  label: string;
  focused: boolean;
  onPress: () => void;
}

const Tab = React.memo(function Tab({ icon, label, focused, onPress }: TabProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    const to = focused ? 1 : 0;
    t.value = reduce ? to : withTiming(to, { duration: Brut.motion.tab, easing: EASE });
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
    maxWidth: interpolate(t.value, [0, 1], [0, ACTIVE_W - 38]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      hitSlop={4}
    >
      <Animated.View style={[styles.tab, pill]}>
        <KIcon name={icon} size={20} color={Brut.ink} strokeWidth={focused ? 2.1 : 1.7} />
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
  const plan = useCoachStore((s) => s.plan);
  const sessions = useCoachStore((s) => s.sessions);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, route: state.routes.find((r) => r.name === g.route) })).filter(
        (g): g is typeof g & { route: NonNullable<typeof g.route> } => !!g.route,
      ),
    [state.routes],
  );
  const activeKey = state.routes[state.index]?.key;
  const activeIdx = groups.findIndex((g) => g.route.key === activeKey);

  const goTo = useCallback(
    (i: number) => {
      const g = groups[i];
      if (!g) return;
      const focused = g.route.key === activeKey;
      const event = navigation.emit({
        type: 'tabPress',
        target: g.route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => {});
        navigation.navigate(g.route.name as never);
      }
    },
    [activeKey, groups, navigation],
  );

  const swipeBy = useCallback(
    (steps: number) => {
      const from = activeIdx < 0 ? 0 : activeIdx;
      const to = Math.max(0, Math.min(groups.length - 1, from + steps));
      if (to !== from || activeIdx < 0) goTo(to);
    },
    [activeIdx, goTo, groups.length],
  );

  // Horizontal drag on the capsule: the pill follows the finger direction.
  // The responder is only claimed once the finger clearly moves sideways,
  // so taps still land on the tabs. A ref keeps the latest swipeBy without
  // rebuilding the responder each render.
  const swipeRef = useRef(swipeBy);
  useEffect(() => {
    swipeRef.current = swipeBy;
  }, [swipeBy]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          const steps = Math.round(g.dx / SWIPE_STEP);
          if (steps !== 0) swipeRef.current(steps);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [],
  );

  // The next session to do: the accepted one done fewest times, earliest
  // slot first. No plan → define a goal; no kept sessions → pick some.
  const startTraining = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    // Coach screens live on the root stack, one level above the tabs.
    const stack = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (!stack) return;
    if (!plan) {
      stack.navigate('CoachGoal');
      return;
    }
    const kept = plan.sessions.filter((s) => s.status === 'accepted');
    if (!kept.length) {
      stack.navigate('CoachPlan');
      return;
    }
    const done = (id: string) => sessions.filter((s) => s.draftSessionId === id).length;
    const next = [...kept].sort((a, b) => done(a.id) - done(b.id) || a.slot - b.slot)[0];
    stack.navigate('LiveSession', { draftSessionId: next.id });
  }, [navigation, plan, sessions]);

  return (
    <View
      style={[styles.container, { bottom: insets.bottom + Spacing.md }]}
      pointerEvents="box-none"
    >
      <View style={styles.capsuleWrap} {...pan.panHandlers}>
        <View style={styles.capsuleShadow} pointerEvents="none" />
        <View style={styles.capsule} accessibilityRole="tablist">
          {groups.map((g, i) => (
            <Tab
              key={g.route.key}
              icon={g.icon}
              label={g.label}
              focused={i === activeIdx}
              onPress={() => goTo(i)}
            />
          ))}
        </View>
      </View>

      <BPress
        onPress={startTraining}
        bg={Brut.accent}
        radius={BAR_HEIGHT / 2}
        shadow={Brut.shadow.sm}
        contentStyle={styles.start}
        accessibilityRole="button"
        accessibilityLabel="Empezar entreno"
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" style={{ marginLeft: 3 }}>
          <Path d="M7 4.5v15l13-7.5z" fill={Brut.ink} />
        </Svg>
      </BPress>
    </View>
  );
}

const SH = Brut.shadow.sm;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  capsuleWrap: { flex: 1, marginRight: SH, marginBottom: SH },
  capsuleShadow: {
    position: 'absolute',
    top: SH,
    left: SH,
    right: -SH,
    bottom: -SH,
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
  start: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
