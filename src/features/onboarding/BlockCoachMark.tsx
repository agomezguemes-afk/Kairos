// KAIROS — BlockCoachMark: the contextual first-block hint.
//
// Replaces the retired 3-page PlannerTour. A single, non-modal callout that
// NAMES the user's real first block ("Fuerza · Día A") and points at the space
// where it lives, dismissable, first-time-only. Anchored low (above the tab
// bar) with an up-caret so it reads as "your block is up there" without a
// full-screen takeover. Reduce-motion drops the entrance/exit slide.

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import PressableScale from './premium/motion/PressableScale';

interface Props {
  /** The real block the coach-mark names (e.g. "Fuerza · Día A"). */
  blockName: string;
  onDismiss: () => void;
}

function BlockCoachMark({ blockName, onDismiss }: Props) {
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const dismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDismiss();
  }, [onDismiss]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + Spacing['3xl'] * 2.6 }]}
      entering={reduce ? undefined : FadeInDown.duration(320)}
      exiting={reduce ? undefined : FadeOutDown.duration(180)}
    >
      <View style={styles.caret} />
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityLabel={`Tu primer bloque: ${blockName}. Tócalo arriba para empezar tu primera sesión.`}
      >
        <View style={styles.dot} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            Tu primer bloque · {blockName}
          </Text>
          <Text style={styles.sub}>
            Tócalo arriba para empezar. Kai ajusta el resto a medida que entrenas.
          </Text>
        </View>
        <PressableScale
          haptic="none"
          pressScale={0.94}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Entendido"
          hitSlop={8}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Entendido</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const CARET = 12;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.screen.horizontal,
    right: Spacing.screen.horizontal,
    alignItems: 'center',
  },
  // Up-caret: the block lives above in the scroll.
  caret: {
    width: 0,
    height: 0,
    borderLeftWidth: CARET,
    borderRightWidth: CARET,
    borderBottomWidth: CARET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.bg.surface,
    marginBottom: -1,
    marginLeft: Spacing['3xl'],
    alignSelf: 'flex-start',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.elevated,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold.base,
  },
  body: { flex: 1, gap: 2 },
  title: { ...Type.bodyEmph, color: Colors.ink.primary },
  sub: { ...Type.caption, color: Colors.ink.tertiary, lineHeight: 17 },
  cta: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  ctaText: { ...Type.bodyEmph, color: Colors.gold.deep },
});

export default React.memo(BlockCoachMark);
