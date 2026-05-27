// src/animations/splash/primitives/Halo.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import SoftGlow from './SoftGlow';

/**
 * Standalone radial halo. Lives at a stage-coordinate position and is
 * controlled by an intensity SharedValue. Used for area glows that don't
 * belong to any single shape — e.g. the wordmark glow during the boot
 * sequence's final-state phase.
 */
export interface HaloProps {
  cx: number; // stage X
  cy: number; // stage Y
  size: number; // base diameter
  intensity: SharedValue<number>; // 0..1
  color?: string;
}

export default function Halo({ cx, cy, size, intensity, color }: HaloProps) {
  // Local SVG box has ~30% headroom over the halo's max radius so the
  // gradient fades cleanly without being clipped at the edge.
  const local = Math.ceil(size * 1.3);
  const localCenter = local / 2;
  const baseRadius = size / 2;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cx - localCenter }, { translateY: cy - localCenter }],
  }));

  return (
    <Animated.View style={[styles.box(local), animStyle]} pointerEvents="none">
      <Svg width={local} height={local}>
        <SoftGlow
          cx={localCenter}
          cy={localCenter}
          baseRadius={baseRadius}
          intensity={intensity}
          color={color}
        />
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
