// KAIROS — StepEnter: a cohesive, one-shot step entrance.
//
// Replaces the per-item "ghost cascade" (blocks fading up one-by-one in order —
// the tell-tale AI-made pattern). The whole step arrives as a single intentional
// gesture: a soft rise + settle with spring physics, so it reads as "the screen
// is here", not "a machine is listing widgets". Mount it once around a step's
// content (the parent remounts it via key={step} so it replays per step).
// Reduce-motion: a near-instant fade, no travel.

import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';

// A calm arrival: settles with a touch of weight, no bounce.
const ARRIVE: WithSpringConfig = { damping: 26, stiffness: 180, mass: 1 };

interface StepEnterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function StepEnter({ children, style }: StepEnterProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0); // 0 = pre-enter, 1 = settled

  useEffect(() => {
    if (reduce) {
      t.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
    } else {
      t.value = withSpring(1, ARRIVE);
    }
  }, [reduce, t]);

  const animatedStyle = useAnimatedStyle(() => {
    // Natural, not rigid: the step settles into focus — a soft fade with a hair
    // of scale, like it comes into being. NO slide (objects don't fly in); the
    // life comes from physics + interaction, not directional movement.
    const scale = 0.985 + t.value * 0.015;
    return {
      opacity: t.value,
      transform: reduce ? [] : [{ scale }],
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default React.memo(StepEnter);
