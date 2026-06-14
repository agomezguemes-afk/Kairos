// KAIROS — KaiFace: Kai is the brand's block, alive.
//
// Álvaro's call: Kai should BE the logo's cube — a gold block (the brand atom;
// the app is literally built from training "blocks") with eyes + a mouth, and
// VERY fluid motion. So Kai is a 3D isometric gold cube (top + front + side
// faces) with a soft face on the front. It bobs, tilts and breathes on smooth
// sine loops, blinks, and squashes-&-stretches with the bob (classic fluid
// animation). Emotion is carried by the eyes + mouth. Reduce-motion → calm hold.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path, Polygon } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export type KaiEmotion = 'idle' | 'happy' | 'thinking' | 'proud' | 'rest';

interface KaiFaceProps {
  size?: number;
  emotion?: KaiEmotion;
}

// Isometric cube faces on a 100×100 stage. Front face is the character's face.
const FRONT = { x: 22, y: 34, w: 52, h: 56, rx: 7 };
const FX = FRONT.x + FRONT.w / 2; // 48 — face centre x
const EYE_Y = 58;
const EYE_DX = 11;
const EYE_RX = 5.2;
const EYE_RY = 7.2;

export default function KaiFace({ size = 96, emotion = 'idle' }: KaiFaceProps) {
  const reduce = useReducedMotion();
  const blink = useSharedValue(1);
  const bob = useSharedValue(0); // 0..1 sine
  const look = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(0, { duration: 80, easing: Easing.in(Easing.quad) })),
        withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withDelay(140, withTiming(1, { duration: 1 })),
      ),
      -1,
    );
    // One slow master sine drives bob + tilt + breathe so they stay in phase and
    // read as a single, buttery motion (very fluid, no competing rhythms).
    bob.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    look.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, blink, bob, look]);

  const lookUp = emotion === 'thinking';
  const eyesAsArcs = emotion === 'happy' || emotion === 'proud' || emotion === 'rest';

  // Whole-cube fluid motion: float up/down, a hair of tilt, and squash-&-stretch
  // (wider+shorter at the bottom of the bob, taller+narrower at the top).
  const cubeStyle = useAnimatedStyle(() => {
    const s = bob.value - 0.5; // -0.5..0.5
    return {
      transform: [
        { translateY: -s * 6 },
        { rotate: `${s * 3}deg` },
        { scaleX: reduce ? 1 : 1 - s * 0.03 },
        { scaleY: reduce ? 1 : 1 + s * 0.03 },
      ],
    };
  });

  const eyeL = useAnimatedProps(() => {
    const dx = reduce ? 0 : (look.value - 0.5) * 2.4;
    const dy = (lookUp ? -3 : 0) + (reduce ? 0 : (look.value - 0.5) * 1);
    const ry = EYE_RY * (reduce ? 1 : 0.1 + blink.value * 0.9);
    return { ry, cx: FX - EYE_DX + dx, cy: EYE_Y + dy } as never;
  });
  const eyeR = useAnimatedProps(() => {
    const dx = reduce ? 0 : (look.value - 0.5) * 2.4;
    const dy = (lookUp ? -3 : 0) + (reduce ? 0 : (look.value - 0.5) * 1);
    const ry = EYE_RY * (reduce ? 1 : 0.1 + blink.value * 0.9);
    return { ry, cx: FX + EYE_DX + dx, cy: EYE_Y + dy } as never;
  });

  const mouth =
    emotion === 'happy' || emotion === 'proud'
      ? `M${FX - 9} 73 Q${FX} ${emotion === 'proud' ? 82 : 80} ${FX + 9} 73` // smile
      : emotion === 'thinking'
        ? `M${FX - 6} 75 L${FX + 6} 75` // flat, focused
        : `M${FX - 7} 74 Q${FX} 77.5 ${FX + 7} 74`; // gentle idle smile

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={[styles.glow, { width: size * 1.3, height: size * 1.3 }]} pointerEvents="none" />
      <Animated.View style={cubeStyle}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Right side face (darkest). */}
          <Polygon points="74,34 88,22 88,78 74,90" fill="#B5904C" />
          {/* Top face (lightest). */}
          <Polygon points="22,34 74,34 88,22 36,22" fill="#E4CB8F" />
          {/* Front face — Kai's face. */}
          <Path
            d={roundedRect(FRONT.x, FRONT.y, FRONT.w, FRONT.h, FRONT.rx)}
            fill="#CDA869"
            stroke="rgba(255,250,238,0.45)"
            strokeWidth={1.2}
          />

          {eyesAsArcs ? (
            <>
              <Path
                d={`M${FX - EYE_DX - 6} ${EYE_Y + 2} Q ${FX - EYE_DX} ${EYE_Y - 6} ${FX - EYE_DX + 6} ${EYE_Y + 2}`}
                stroke={Colors.ink.primary}
                strokeWidth={3.2}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={`M${FX + EYE_DX - 6} ${EYE_Y + 2} Q ${FX + EYE_DX} ${EYE_Y - 6} ${FX + EYE_DX + 6} ${EYE_Y + 2}`}
                stroke={Colors.ink.primary}
                strokeWidth={3.2}
                strokeLinecap="round"
                fill="none"
              />
            </>
          ) : (
            <>
              <AnimatedEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={eyeL} />
              <AnimatedEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={eyeR} />
            </>
          )}

          <Path
            d={mouth}
            stroke={Colors.ink.primary}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** SVG path for a rounded rectangle. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y} h${w - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - 2 * r} ` +
    `a${r} ${r} 0 0 1 ${-r} ${r} h${-(w - 2 * r)} a${r} ${r} 0 0 1 ${-r} ${-r} ` +
    `v${-(h - 2 * r)} a${r} ${r} 0 0 1 ${r} ${-r} Z`
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: Colors.gold.glow,
    zIndex: -1,
  },
});
