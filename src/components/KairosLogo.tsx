import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Colors } from '../theme/tokens';

export interface KairosLogoProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const VIEWBOX = 100;

/**
 * Kairos isotype.
 *
 * A precision K inscribed in a perfect circle, with a single filled dot at
 * the upper apex — "the moment". Asymmetric weight; reads as both a stylised
 * K and an arrow trajectory. Single-colour, stroke-driven, atemporal.
 *
 * Geometry on a 100×100 viewBox:
 *   – Outer circle    : cx=50  cy=50  r=42      stroke 1.5
 *   – K spine         : (36,22) → (36,78)        stroke 2
 *   – Upper diagonal  : (36,50) → (66,22)        stroke 2
 *   – Lower diagonal  : (36,50) → (66,78)        stroke 2
 *   – Apex dot        : (66,22) r=3.5            filled
 */
export default function KairosLogo({ size = 80, color, strokeWidth = 2 }: KairosLogoProps) {
  const stroke = color ?? Colors.gold.base;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      <G>
        <Circle cx={50} cy={50} r={42} stroke={stroke} strokeWidth={1.5} fill="none" />
        <Path
          d="M36 22 L36 78"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M36 50 L66 22"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M36 50 L66 78"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={66} cy={22} r={3.5} fill={stroke} />
      </G>
    </Svg>
  );
}
