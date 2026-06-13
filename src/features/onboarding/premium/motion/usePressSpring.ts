// KAIROS — usePressSpring: physical press feedback.
//
// The difference between "alive" and "AI-made" is mostly here: instead of a flat
// opacity dip on press, surfaces compress and spring back with real physics, so
// every touch feels like pressing a physical object. Reduce-motion shrinks the
// travel to near-nothing (still legible, never jarring).

import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

// Snappy but soft — compresses fast, settles with a hair of overshoot so it
// feels elastic, not robotic.
const PRESS_IN: WithSpringConfig = { damping: 18, stiffness: 420, mass: 0.7 };
const PRESS_OUT: WithSpringConfig = { damping: 14, stiffness: 320, mass: 0.8 };

interface PressSpringOptions {
  /** Scale at full press. Larger surfaces compress less (default 0.96). */
  to?: number;
}

export function usePressSpring({ to = 0.96 }: PressSpringOptions = {}) {
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0); // 0 = rest, 1 = pressed
  const target = reduce ? Math.max(0.99, to) : to;

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, PRESS_IN);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, PRESS_OUT);
  }, [pressed]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = 1 - pressed.value * (1 - target);
    return { transform: [{ scale }] };
  });

  return { animatedStyle, onPressIn, onPressOut };
}
