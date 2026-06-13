// KAIROS — useTactile: one tactile language for every selectable surface.
//
// Composes two physical responses into a single scale so selecting things never
// feels like a flat, instant colour swap:
//   • press  — compresses with give while held, springs back on release
//   • select — a soft organic "pop" the moment it becomes selected
// Reduce-motion: no travel. Returns the animated style + press handlers; the
// caller keeps its own colour/border state for the selected look.

import { useCallback, useEffect } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

const PRESS_IN: WithSpringConfig = { damping: 20, stiffness: 360, mass: 0.85 };
const PRESS_OUT: WithSpringConfig = { damping: 15, stiffness: 260, mass: 0.95 };
const POP_UP: WithSpringConfig = { damping: 11, stiffness: 300, mass: 0.7 };
const POP_DOWN: WithSpringConfig = { damping: 16, stiffness: 230 };

interface TactileOptions {
  selected?: boolean;
  /** Scale at full press (bigger surfaces compress less). Default 0.96. */
  pressTo?: number;
  /** Peak of the selection pop. Default 1.05. */
  popTo?: number;
}

export function useTactile({
  selected = false,
  pressTo = 0.96,
  popTo = 1.05,
}: TactileOptions = {}) {
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (selected && !reduce) {
      pop.value = withSequence(withSpring(popTo, POP_UP), withSpring(1, POP_DOWN));
    }
  }, [selected, reduce, popTo, pop]);

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, PRESS_IN);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, PRESS_OUT);
  }, [pressed]);

  const target = reduce ? Math.max(0.99, pressTo) : pressTo;
  const animatedStyle = useAnimatedStyle(() => {
    const press = 1 - pressed.value * (1 - target);
    return { transform: [{ scale: press * pop.value }] };
  });

  return { animatedStyle, onPressIn, onPressOut };
}
