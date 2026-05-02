// src/animations/splash/primitives/GoldBlock.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { G, Rect, Text } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedText = Animated.createAnimatedComponent(Text);

export interface GoldBlockProps {
  /** Position of the block's CENTER. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  rotation: SharedValue<number>;     // radians
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
  /** When provided, this letter is rendered overlaid; controlled by reveal. */
  letter?: string;
  /** 0 = block visible, letter hidden. 1 = block hidden, letter visible. */
  letterReveal?: SharedValue<number>;
  size?: number;                     // default VISUAL.blockSize
  color?: string;                    // default gold[500]
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
  const half = size / 2;

  const groupProps = useAnimatedProps(() => {
    const cx = x.value;
    const cy = y.value;
    const deg = (rotation.value * 180) / Math.PI;
    return {
      opacity: opacity.value,
      transform: `translate(${cx}, ${cy}) rotate(${deg}) scale(${scale.value}) translate(${-cx}, ${-cy})`,
    };
  });

  const blockProps = useAnimatedProps(() => ({
    opacity: letterReveal ? 1 - letterReveal.value : 1,
  }));

  const textProps = useAnimatedProps(() => {
    if (!letterReveal) return { opacity: 0 };
    const r = letterReveal.value;
    return { opacity: r };
  });

  // Letter scale animates 0.7 → 1.0 as reveal goes 0 → 1
  const textGroupProps = useAnimatedProps(() => {
    const r = letterReveal ? letterReveal.value : 0;
    const s = 0.7 + r * 0.3;
    const cx = x.value;
    const cy = y.value;
    return {
      transform: `translate(${cx}, ${cy}) scale(${s}) translate(${-cx}, ${-cy})`,
    };
  });

  return (
    <AnimatedG animatedProps={groupProps}>
      <AnimatedRect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={2}
        fill={color}
        animatedProps={blockProps}
        transform={`translate(0, 0)`}
      />
      {letter && (
        <AnimatedG animatedProps={textGroupProps}>
          <AnimatedText
            x={0}
            y={0}
            fontSize={VISUAL.letterFontSize}
            fontWeight="300"
            fill={color}
            textAnchor="middle"
            alignmentBaseline="central"
            animatedProps={textProps}
          >
            {letter}
          </AnimatedText>
        </AnimatedG>
      )}
    </AnimatedG>
  );
}
