// src/animations/splash/primitives/GoldBlock.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Rect, Text } from 'react-native-svg';

import { VISUAL } from '../choreography';
import SoftGlow from './SoftGlow';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedText = Animated.createAnimatedComponent(Text);

const LOCAL_PAD = 80;

export interface GoldBlockProps {
  /** Block CENTER in stage coordinates. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** Radians. Applied as transform on outer View. */
  rotation: SharedValue<number>;
  /** Outer (entity-level) opacity 0..1. */
  opacity: SharedValue<number>;
  /** Outer (entity-level) scale. */
  scale: SharedValue<number>;
  /** Optional letter overlay for block-stamp morph. */
  letter?: string;
  /**
   * 0 = block visible at full size, 1 = letter at full size.
   * Drives a true metamorphosis: rect shrinks toward a point while letter
   * grows from a point, both centered. No more lazy crossfade overlap.
   */
  letterReveal?: SharedValue<number>;
  /** Optional warm halo behind the block (0..1 intensity). */
  glow?: SharedValue<number>;
  size?: number;
  color?: string;
}

export default function GoldBlock({
  x,
  y,
  rotation,
  opacity,
  scale,
  letter,
  letterReveal,
  glow,
  size = VISUAL.blockSize,
  color = '#D4AF37',
}: GoldBlockProps) {
  const local = size + LOCAL_PAD;
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

  // Rect shrinks toward center as letterReveal grows: width/height ride
  // size * (1 - reveal), and x/y are recomputed so the rect stays centered.
  const rectProps = useAnimatedProps(() => {
    const r = letterReveal ? letterReveal.value : 0;
    const s = size * (1 - r);
    return {
      x: localCenter - s / 2,
      y: localCenter - s / 2,
      width: s,
      height: s,
      opacity: 1 - r,
    };
  });

  // Letter grows from a point: scale-equivalent comes from animating fontSize.
  // Opacity rises with reveal so the swap reads as a single morph.
  const letterFontSize = VISUAL.letterFontSize;
  const textProps = useAnimatedProps(() => {
    const r = letterReveal ? letterReveal.value : 0;
    return {
      fontSize: letterFontSize * r,
      opacity: r,
    };
  });

  return (
    <Animated.View style={[styles.box(local), animStyle]} pointerEvents="none">
      <Svg width={local} height={local}>
        {glow && (
          <SoftGlow cx={localCenter} cy={localCenter} baseRadius={size * 1.0} intensity={glow} />
        )}
        <AnimatedRect rx={2} fill={color} animatedProps={rectProps} />
        {letter && (
          <AnimatedText
            x={localCenter}
            y={localCenter}
            fontWeight="300"
            fill={color}
            textAnchor="middle"
            alignmentBaseline="central"
            animatedProps={textProps}
          >
            {letter}
          </AnimatedText>
        )}
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
