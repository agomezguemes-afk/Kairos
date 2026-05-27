// src/animations/splash/primitives/MorphCube.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const LOCAL_PAD = 60;

export interface MorphCubeProps {
  /** Stage X of the shape's center. */
  x: SharedValue<number>;
  /** Stage Y of the shape's center. */
  y: SharedValue<number>;
  /** Outer (entity-level) opacity. */
  opacity: SharedValue<number>;
  /** Outer scale, applied on the View transform. */
  scale: SharedValue<number>;
  /** Rotation in radians, applied on the View transform. */
  rotation: SharedValue<number>;
  /**
   * Animated visual size. Goes inside the SVG so width/height interpolate
   * smoothly. Useful for the sphere→cube morph (sphereSize → cubeSize).
   */
  visualSize: SharedValue<number>;
  /**
   * Corner radius. Setting roundness === visualSize/2 yields a perfect
   * circle; small values (~2) yield a barely-rounded square.
   * Animating this is what makes the sphere→cube morph feel like a single
   * continuous shape transformation.
   */
  roundness: SharedValue<number>;
  /** Local box reserves enough room for the maximum visualSize you'll use. */
  maxSize: number;
  color?: string;
}

/**
 * Single-element shape that interpolates seamlessly between a perfect
 * circle and a rounded square. There is no crossfade — it's the same
 * Rect throughout, so the morph reads as continuous transformation.
 */
export default function MorphCube({
  x,
  y,
  opacity,
  scale,
  rotation,
  visualSize,
  roundness,
  maxSize,
  color = '#D4AF37',
}: MorphCubeProps) {
  const local = maxSize + LOCAL_PAD;
  const localCenter = local / 2;

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value - localCenter },
      { translateY: y.value - localCenter },
      { rotate: `${(rotation.value * 180) / Math.PI}deg` },
      { scale: scale.value },
    ],
  }));

  const rectProps = useAnimatedProps(() => {
    const s = visualSize.value;
    return {
      x: localCenter - s / 2,
      y: localCenter - s / 2,
      width: s,
      height: s,
      rx: roundness.value,
      ry: roundness.value,
    };
  });

  return (
    <Animated.View style={[styles.box(local), animStyle]} pointerEvents="none">
      <Svg width={local} height={local}>
        <AnimatedRect fill={color} animatedProps={rectProps} />
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
