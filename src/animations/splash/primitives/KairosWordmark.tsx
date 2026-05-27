// src/animations/splash/primitives/KairosWordmark.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Text } from 'react-native-svg';

import { VISUAL } from '../choreography';

const LETTERS = ['K', 'A', 'I', 'R', 'O', 'S'] as const;
const LETTER_LOCAL = 80; // local SVG box per letter

export interface KairosWordmarkProps {
  /** Center X of the entire wordmark in stage coordinates. */
  centerX: number;
  /** Baseline Y in stage coordinates. */
  centerY: number;
  /** One per letter (length must be 6). 0 = invisible, 1 = full opacity. */
  letterReveals: SharedValue<number>[];
  /** Group-level scale (used for final-state breathing). */
  scale: SharedValue<number>;
  /** Group-level opacity (used for exit). */
  opacity: SharedValue<number>;
  color?: string;
  fontSize?: number;
}

/**
 * Six-letter wordmark.
 * Each letter is its OWN <Animated.View> so that transforms apply correctly
 * via the proven pattern, not via animated <G> transforms inside SVG.
 */
export default function KairosWordmark({
  centerX,
  centerY,
  letterReveals,
  scale,
  opacity,
  color = '#D4AF37',
  fontSize = VISUAL.letterFontSize,
}: KairosWordmarkProps) {
  if (letterReveals.length !== 6) {
    throw new Error('KairosWordmark requires exactly 6 letterReveals');
  }

  const totalWidth = (LETTERS.length - 1) * VISUAL.wordmarkSpacing;
  const startX = centerX - totalWidth / 2;

  const groupStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, groupStyle]} pointerEvents="none">
      {LETTERS.map((letter, i) => (
        <Letter
          key={letter}
          letter={letter}
          x={startX + i * VISUAL.wordmarkSpacing}
          y={centerY}
          reveal={letterReveals[i]}
          color={color}
          fontSize={fontSize}
        />
      ))}
    </Animated.View>
  );
}

interface LetterProps {
  letter: string;
  x: number;
  y: number;
  reveal: SharedValue<number>;
  color: string;
  fontSize: number;
}

function Letter({ letter, x, y, reveal, color, fontSize }: LetterProps) {
  const localCenter = LETTER_LOCAL / 2;

  const animStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateX: x - localCenter },
      { translateY: y - localCenter },
      { scale: 0.7 + reveal.value * 0.3 },
    ],
  }));

  return (
    <Animated.View style={[letterStyles.box, animStyle]} pointerEvents="none">
      <Svg width={LETTER_LOCAL} height={LETTER_LOCAL}>
        <Text
          x={localCenter}
          y={localCenter}
          fontSize={fontSize}
          fontWeight="300"
          fill={color}
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {letter}
        </Text>
      </Svg>
    </Animated.View>
  );
}

const letterStyles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LETTER_LOCAL,
    height: LETTER_LOCAL,
  },
});
