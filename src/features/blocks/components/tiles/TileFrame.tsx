// Shared visual frame for Spine-Bento tiles.
//
// Three variants define the surface contract:
//   • hero      — warm background, generous padding, soft depth.
//                 Used for the anchor lift / compound exercise.
//   • standard  — white surface, hairline border, subtle shadow.
//                 Used for accessory lifts, dashboards, supersets.
//   • minimal   — no surface chrome; the tile renders its own frame
//                 (NoteTile, SectionHeaderTile).
//
// Press feedback animates via Reanimated: subtle scale-down and shadow
// lift on touch. Respects useReducedMotion. Active state draws an ink
// outline for drag/selection moments (gold is reserved for Kai — Ola-2).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Shadows } from '../../../../theme/tokens';
import { springs } from '../../../../theme/animations';

export type TileVariant = 'hero' | 'standard' | 'minimal';

interface Props {
  variant?: TileVariant;
  isActive?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TileFrameImpl({ variant = 'standard', isActive, onPress, onLongPress, children }: Props) {
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (variant === 'minimal') return {};
    const scale = reduceMotion ? 1 : 1 - press.value * 0.012;
    const baseShadowOp = variant === 'hero' ? 0.07 : 0.05;
    return {
      transform: [{ scale }],
      shadowOpacity: baseShadowOp + press.value * 0.05,
    };
  });

  const handlePressIn = () => {
    if (reduceMotion) {
      press.value = 1;
      return;
    }
    press.value = withSpring(1, springs.press);
  };

  const handlePressOut = () => {
    if (reduceMotion) {
      press.value = withTiming(0, { duration: 120 });
      return;
    }
    press.value = withSpring(0, springs.press);
  };

  const handleLongPress = () => {
    if (!onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress();
  };

  if (variant === 'minimal') {
    return <View>{children}</View>;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPress || onLongPress ? handlePressIn : undefined}
      onPressOut={onPress || onLongPress ? handlePressOut : undefined}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
      style={[
        styles.frame,
        variant === 'hero' ? styles.frameHero : styles.frameStandard,
        isActive && styles.frameActive,
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const TileFrame = React.memo(TileFrameImpl);
export default TileFrame;

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  // No border: white on warm paper already reads as a raised card (v3 §3a).
  frameStandard: {
    backgroundColor: Colors.paper.raised,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Shadows.subtle,
  },
  // The shadow comes from Shadows.card — which is now warm (#4A3B28). The old
  // local override (#1C1C1E, blue-black) is exactly the "digital" tell (§3f).
  frameHero: {
    backgroundColor: Colors.paper.warm,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    ...Shadows.card,
  },
  frameActive: {
    borderWidth: 1,
    borderColor: Colors.ink.primary,
  },
});
