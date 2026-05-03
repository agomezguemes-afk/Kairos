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

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedText = Animated.createAnimatedComponent(Text);

const LOCAL_PAD = 60;

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
  /** 0 = block visible, 1 = letter visible. Drives the crossfade inside the SVG. */
  letterReveal?: SharedValue<number>;
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
  size = VISUAL.blockSize,
  color = '#D4AF37',
}: GoldBlockProps) {
  const local = size + LOCAL_PAD;
  const localCenter = local / 2;
  const half = size / 2;

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value - localCenter },
      { translateY: y.value - localCenter },
      { rotate: `${(rotation.value * 180) / Math.PI}deg` },
      { scale: scale.value },
    ],
  }));

  const blockProps = useAnimatedProps(() => ({
    opacity: letterReveal ? 1 - letterReveal.value : 1,
  }));

  const textProps = useAnimatedProps(() => ({
    opacity: letterReveal ? letterReveal.value : 0,
  }));

  return (
    <Animated.View style={[styles.box(local), animStyle]} pointerEvents="none">
      <Svg width={local} height={local}>
        <AnimatedRect
          x={localCenter - half}
          y={localCenter - half}
          width={size}
          height={size}
          rx={2}
          fill={color}
          animatedProps={blockProps}
        />
        {letter && (
          <AnimatedText
            x={localCenter}
            y={localCenter}
            fontSize={VISUAL.letterFontSize}
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
