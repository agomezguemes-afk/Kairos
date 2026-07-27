// src/features/planner/components/HomeFolder.tsx
// The "carpeta" for everything that isn't today: calendar, readiness, weekly
// stats, Kai's signal. Collapsed by default so HomeHero + DayCard own the
// fold (STORY-01). Closed it reads as a quiet handle, not a CTA — gold stays
// reserved for Kai.
//
// children are ALWAYS mounted (collapsed just clips them to height 0) so
// VoiceOver can discover them once expanded and so the natural height can be
// measured without a mount/unmount round-trip.

import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';

interface HomeFolderProps {
  /** foldSummary().eyebrow — e.g. "Esta semana" */
  eyebrow: string;
  /** foldSummary().summary — e.g. "4 sesiones" */
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const OPEN_DURATION = 240; // WHY: brief §3.4 — inside the 180-280 standard band

export default function HomeFolder({
  eyebrow,
  summary,
  children,
  defaultOpen = false,
}: HomeFolderProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();

  // Natural height of the collapsible content, from the inner (un-clipped)
  // view's own layout. Always kept fresh — content can legitimately grow
  // after the first pass (e.g. KaiSignalCard rendering null then a real card
  // once a signal fires later in the session) and a stale height would clip
  // it forever. Re-measuring is safe: while collapsed the animated height
  // stays 0 regardless of `measured.value` (interpolate at progress=0), and
  // while open a content-height change snaps the container to the new size
  // instead of silently hiding content — the correct tradeoff for a rare edge.
  const measured = useSharedValue(0);

  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: OPEN_DURATION, easing: Easing.out(Easing.cubic) });
  }, [open, reduceMotion, progress]);

  const handleInnerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) measured.value = h;
    },
    [measured],
  );

  const handleToggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setOpen((o) => !o);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, measured.value], Extrapolation.CLAMP),
  }));

  // The "rise" — folder content zooms into place rather than just appearing
  // as the height grows underneath it.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-8, 0], Extrapolation.CLAMP) },
    ],
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return (
    <View>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${eyebrow}. ${summary}`}
        accessibilityHint={open ? 'Toca para ocultar' : 'Toca para mostrar más'}
        style={({ pressed }) => [styles.handle, pressed && styles.handlePressed]}
      >
        <View style={styles.textCol}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Feather name="chevron-down" size={18} color={Colors.ink.tertiary} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.collapsible, containerStyle]}>
        <Animated.View style={contentStyle} onLayout={handleInnerLayout}>
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper.warm,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.gap.editorial,
  },
  handlePressed: {
    opacity: 0.7,
  },
  textCol: {
    flex: 1,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
  },
  summary: {
    ...Type.caption,
    color: Colors.ink.secondary,
    marginTop: 2,
  },
  collapsible: {
    overflow: 'hidden',
  },
});
