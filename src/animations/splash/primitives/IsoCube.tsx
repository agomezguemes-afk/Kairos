// src/animations/splash/primitives/IsoCube.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { VISUAL } from '../choreography';

const LOCAL_PAD = 40;

export interface IsoCubeProps {
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  /** Radians. */
  rotation: SharedValue<number>;
  opacity: SharedValue<number>;
  size?: number;
}

export default function IsoCube({
  x,
  y,
  scale,
  rotation,
  opacity,
  size = VISUAL.cubeSize,
}: IsoCubeProps) {
  const local = size + LOCAL_PAD;
  const localCenter = local / 2;

  const s = size / 2;
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = 0.5;

  // Build paths centered at (localCenter, localCenter)
  const cx = localCenter;
  const cy = localCenter;

  const topPath =
    `M ${cx},${cy - s} ` +
    `L ${cx + s * cos30},${cy - s + s * sin30} ` +
    `L ${cx},${cy} ` +
    `L ${cx - s * cos30},${cy - s + s * sin30} Z`;

  const leftPath =
    `M ${cx - s * cos30},${cy - s + s * sin30} ` +
    `L ${cx - s * cos30},${cy + s * sin30} ` +
    `L ${cx},${cy + s} ` +
    `L ${cx},${cy} Z`;

  const rightPath =
    `M ${cx + s * cos30},${cy - s + s * sin30} ` +
    `L ${cx},${cy} ` +
    `L ${cx},${cy + s} ` +
    `L ${cx + s * cos30},${cy + s * sin30} Z`;

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value - localCenter },
      { translateY: y.value - localCenter },
      { rotate: `${(rotation.value * 180) / Math.PI}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.box(local), animStyle]} pointerEvents="none">
      <Svg width={local} height={local}>
        <Path d={topPath} fill="#E8D48B" />
        <Path d={leftPath} fill="#D4AF37" />
        <Path d={rightPath} fill="#B8960F" />
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
