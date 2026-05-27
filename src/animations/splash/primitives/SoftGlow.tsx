// src/animations/splash/primitives/SoftGlow.tsx
import React, { useRef } from 'react';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface SoftGlowProps {
  cx: number;
  cy: number;
  baseRadius: number;
  intensity: SharedValue<number>; // 0..1
  color?: string;
}

/**
 * Halo with a true radial-gradient falloff — dense at the center,
 * fading to fully transparent at the edge. No hard circle outline,
 * which is what makes a halo feel real instead of a flat colored disc.
 *
 * NOTE: returns SVG fragments (Defs + Circle) and must be placed as a
 * direct child of an <Svg>. For a standalone glow that lives in screen
 * coordinates, see the Halo primitive.
 */
export default function SoftGlow({
  cx,
  cy,
  baseRadius,
  intensity,
  color = '#D4AF37',
}: SoftGlowProps) {
  const id = useRef(`sg${Math.random().toString(36).slice(2, 9)}`).current;

  const animatedProps = useAnimatedProps(() => {
    const i = Math.min(intensity.value, 1);
    return {
      r: baseRadius * (1 + i * 0.25),
      opacity: i,
    };
  });

  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <Stop offset="55%" stopColor={color} stopOpacity="0.15" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <AnimatedCircle cx={cx} cy={cy} fill={`url(#${id})`} animatedProps={animatedProps} />
    </>
  );
}
