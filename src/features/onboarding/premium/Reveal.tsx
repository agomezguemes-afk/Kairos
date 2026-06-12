// KAIROS — Reveal: staggered entrance wrapper.
//
// Fades + lifts children into place with an optional stagger index, so a screen
// composes itself in a calm sequence. Honors reduce-motion (no translate, near-
// instant) via useMotionPlan. Motion serves comprehension, never decoration.

import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useMotionPlan } from '../flow/useReducedMotion';

interface RevealProps {
  children: React.ReactNode;
  /** Stagger order; later items enter slightly after earlier ones. */
  index?: number;
  /** ms between staggered items (collapsed under reduce-motion). */
  delayStep?: number;
  style?: StyleProp<ViewStyle>;
}

function Reveal({ children, index = 0, delayStep = 70, style }: RevealProps) {
  const plan = useMotionPlan();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(plan.expressive ? 16 : 0);

  useEffect(() => {
    const step = plan.expressive ? delayStep : Math.min(delayStep, 24);
    const delay = index * step;
    const duration = plan.durations.standard;
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, delayStep, plan, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

export default React.memo(Reveal);
