// KAIROS — StepEnter: a natural, one-shot step arrival.
//
// Not a slide (objects don't fly in) and not the old ghost cascade. The whole
// step settles into focus together: a soft fade with a hair of scale, eased by a
// gentle spring so it feels like it comes into being rather than snapping. The
// parent remounts it via key={step} so it replays per step. Reduce-motion: a
// near-instant fade, no scale.

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

// A calm arrival: settles softly, no bounce.
const ARRIVE: WithSpringConfig = { damping: 24, stiffness: 150, mass: 1 };

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
    // Soft fade + a whisper of scale (comes into focus). No translation = no slide.
    const scale = 0.978 + t.value * 0.022;
    return {
      opacity: t.value,
      transform: reduce ? [] : [{ scale }],
    };
  });

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default React.memo(StepEnter);
