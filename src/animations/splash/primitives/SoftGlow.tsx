// src/animations/splash/primitives/SoftGlow.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { Circle } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface SoftGlowProps {
  cx: number;
  cy: number;
  baseRadius: number;
  intensity: SharedValue<number>;  // 0..1; capped at VISUAL.glowMaxOpacity
  color?: string;                  // default: warm gold rgba
}

/**
 * Warm chromatic spread for the white-bg splash.
 * NOT a luminous halo — a soft, blurred-feeling stain that capped at 35% opacity
 * to avoid the "dirty / blurry" look on white.
 */
export default function SoftGlow({
  cx,
  cy,
  baseRadius,
  intensity,
  color = 'rgba(212,175,55,0.35)',
}: SoftGlowProps) {
  const animatedProps = useAnimatedProps(() => {
    const i = Math.min(intensity.value, 1);
    return {
      r: baseRadius * (1 + i * 0.4),
      opacity: i * VISUAL.glowMaxOpacity,
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={color}
      animatedProps={animatedProps}
    />
  );
}
