// src/animations/splash/primitives/IsoCube.tsx
import React from 'react';
import Animated, {
  SharedValue,
  useAnimatedProps,
} from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';

import { VISUAL } from '../choreography';

const AnimatedG = Animated.createAnimatedComponent(G);

export interface IsoCubeProps {
  cx: number;
  cy: number;
  scale: SharedValue<number>;
  rotation: SharedValue<number>;   // radians (2D rotation of the group)
  opacity: SharedValue<number>;
  size?: number;                   // default VISUAL.cubeSize
}

/**
 * Volumetric isometric cube built from 3 SVG <Path> faces, each in a different
 * gold tone for depth. NOT a real 3D rotation — group rotates as 2D, which reads
 * identical at this scale on a static-camera splash.
 */
export default function IsoCube({
  cx,
  cy,
  scale,
  rotation,
  opacity,
  size = VISUAL.cubeSize,
}: IsoCubeProps) {
  // Build the three face paths centered at (0,0); we transform via the group.
  // Iso projection: x' = (x - z) * cos(30°), y' = y + (x + z) * sin(30°)
  const s = size / 2;
  const cos30 = Math.cos(Math.PI / 6); // ≈ 0.866
  const sin30 = 0.5;

  // Top face (rhombus): four points {top, right, bottom, left} in iso
  const topPath = `
    M ${0},${-s}
    L ${s * cos30},${-s + s * sin30}
    L ${0},${0}
    L ${-s * cos30},${-s + s * sin30}
    Z
  `.trim();

  // Left face: top-left, bottom-left, bottom-mid, mid
  const leftPath = `
    M ${-s * cos30},${-s + s * sin30}
    L ${-s * cos30},${s * sin30}
    L ${0},${s}
    L ${0},${0}
    Z
  `.trim();

  // Right face: top-right, mid, bottom-mid, bottom-right
  const rightPath = `
    M ${s * cos30},${-s + s * sin30}
    L ${0},${0}
    L ${0},${s}
    L ${s * cos30},${s * sin30}
    Z
  `.trim();

  const groupProps = useAnimatedProps(() => {
    const deg = (rotation.value * 180) / Math.PI;
    return {
      opacity: opacity.value,
      transform: `translate(${cx}, ${cy}) rotate(${deg}) scale(${scale.value})`,
    };
  });

  return (
    <AnimatedG animatedProps={groupProps}>
      <Path d={topPath}   fill="#E8D48B" />
      <Path d={leftPath}  fill="#D4AF37" />
      <Path d={rightPath} fill="#B8960F" />
    </AnimatedG>
  );
}
