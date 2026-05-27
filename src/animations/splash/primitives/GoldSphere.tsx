// src/animations/splash/primitives/GoldSphere.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { VISUAL } from '../choreography';
import SoftGlow from './SoftGlow';

const LOCAL_PAD = 80; // extra room for glow halo

export interface GoldSphereProps {
  /** Logical X in stage coordinates (px). */
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  glow: SharedValue<number>;
  color?: string;
  size?: number;
}

export default function GoldSphere({
  x,
  y,
  scale,
  opacity,
  glow,
  color = '#D4AF37',
  size = VISUAL.sphereSize,
}: GoldSphereProps) {
  const r = size / 2;
  const local = size + LOCAL_PAD;
  const localCenter = local / 2;

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value - localCenter },
      { translateY: y.value - localCenter },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.box(local), animStyle]} pointerEvents="none">
      <Svg width={local} height={local}>
        <SoftGlow cx={localCenter} cy={localCenter} baseRadius={r * 1.4} intensity={glow} />
        <Circle cx={localCenter} cy={localCenter} r={r} fill={color} />
      </Svg>
    </Animated.View>
  );
}

const styles = {
  box: (s: number) =>
    StyleSheet.flatten({
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: s,
      height: s,
    }),
};
