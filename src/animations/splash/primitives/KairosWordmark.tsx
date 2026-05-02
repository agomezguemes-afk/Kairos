// src/animations/splash/primitives/KairosWordmark.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { G, Text } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedText = Animated.createAnimatedComponent(Text);

const LETTERS = ['K', 'A', 'I', 'R', 'O', 'S'] as const;

export interface KairosWordmarkProps {
  cx: number;
  cy: number;
  /** One per letter, length must equal 6. Each value 0..1 controls reveal of that letter. */
  letterReveals: SharedValue<number>[];
  /** Group-level scale and opacity (used for final-state breathing + exit). */
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
  color?: string;
  fontSize?: number;
}

/**
 * Six letters as <Text> elements positioned along a horizontal baseline.
 * Per-letter reveal controlled externally so the parent composer can stagger.
 */
export default function KairosWordmark({
  cx,
  cy,
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
  const startX = cx - totalWidth / 2;

  const groupProps = useAnimatedProps(() => ({
    opacity: opacity.value,
    transform: `translate(${cx}, ${cy}) scale(${scale.value}) translate(${-cx}, ${-cy})`,
  }));

  return (
    <AnimatedG animatedProps={groupProps}>
      {LETTERS.map((letter, i) => (
        <LetterAt
          key={letter}
          letter={letter}
          x={startX + i * VISUAL.wordmarkSpacing}
          y={cy}
          reveal={letterReveals[i]}
          color={color}
          fontSize={fontSize}
        />
      ))}
    </AnimatedG>
  );
}

interface LetterAtProps {
  letter: string;
  x: number;
  y: number;
  reveal: SharedValue<number>;
  color: string;
  fontSize: number;
}

function LetterAt({ letter, x, y, reveal, color, fontSize }: LetterAtProps) {
  const textProps = useAnimatedProps(() => ({
    opacity: reveal.value,
  }));

  const groupProps = useAnimatedProps(() => {
    const s = 0.7 + reveal.value * 0.3;
    return {
      transform: `translate(${x}, ${y}) scale(${s}) translate(${-x}, ${-y})`,
    };
  });

  return (
    <AnimatedG animatedProps={groupProps}>
      <AnimatedText
        x={x}
        y={y}
        fontSize={fontSize}
        fontWeight="300"
        fill={color}
        textAnchor="middle"
        alignmentBaseline="central"
        animatedProps={textProps}
      >
        {letter}
      </AnimatedText>
    </AnimatedG>
  );
}
