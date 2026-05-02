// src/animations/splash/primitives/GoldSphere.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { VISUAL } from '../choreography';
import SoftGlow from './SoftGlow';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export interface GoldSphereProps {
  cx: number;
  cy: number;
  scale: SharedValue<number>;       // overall scale 0..1.5
  opacity: SharedValue<number>;     // 0..1
  glow: SharedValue<number>;        // 0..1
  color?: string;                   // defaults to gold[500]
  size?: number;                    // base diameter, default VISUAL.sphereSize
}

export default function GoldSphere({
  cx,
  cy,
  scale,
  opacity,
  glow,
  color = '#D4AF37',
  size = VISUAL.sphereSize,
}: GoldSphereProps) {
  const r = size / 2;

  const groupProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    transform: `translate(${cx}, ${cy}) scale(${scale.value}) translate(${-cx}, ${-cy})`,
  }));

  return (
    <AnimatedG animatedProps={groupProps}>
      <SoftGlow cx={cx} cy={cy} baseRadius={r * 1.4} intensity={glow} />
      <Circle cx={cx} cy={cy} r={r} fill={color} />
    </AnimatedG>
  );
}
