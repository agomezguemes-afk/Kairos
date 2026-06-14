// KAIROS — KaiFace: Kai as a character, not an abstract orb.
//
// Álvaro's call: Kai should be a humanised "monigote" with a face and emotions
// you bond with (the relatedness lever of SDT). The bar (anti-slop): crafted,
// minimal and warm — charming, never childish, and living inside the gold
// identity. Eyes carry the emotion (a soft mouth only when it helps). Blinks +
// breathes so it feels alive; reduce-motion holds a calm neutral.
//
// First take — iterate. emotion: 'idle' | 'happy' | 'thinking' | 'proud' | 'rest'.

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
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

export type KaiEmotion = 'idle' | 'happy' | 'thinking' | 'proud' | 'rest';

interface KaiFaceProps {
  size?: number;
  emotion?: KaiEmotion;
}

// Eye geometry on a 100×100 face.
const EYE_Y = 54;
const EYE_DX = 17; // distance from centre
const EYE_RX = 6.5;
const EYE_RY = 9;

function KaiFace({ size = 96, emotion = 'idle' }: KaiFaceProps) {
  const reduce = useReducedMotion();
  const blink = useSharedValue(1); // 1 open, 0 closed
  const breathe = useSharedValue(0);
  const look = useSharedValue(0); // subtle gaze drift

  useEffect(() => {
    if (reduce) return;
    // Blink: open most of the time, a quick double-ish blink every few seconds.
    blink.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(0, { duration: 90, easing: Easing.in(Easing.quad) })),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    look.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, blink, breathe, look]);

  // Happy/proud "rest" their eyes into arcs; thinking looks up; idle is open.
  const eyesAsArcs = emotion === 'happy' || emotion === 'proud' || emotion === 'rest';
  const lookUp = emotion === 'thinking';

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (breathe.value - 0.5) * 4 },
      { scale: reduce ? 1 : 0.99 + breathe.value * 0.02 },
    ],
  }));

  const gaze = useAnimatedProps(() => {
    const dx = reduce ? 0 : (look.value - 0.5) * 3;
    const dy = (lookUp ? -3.5 : 0) + (reduce ? 0 : (look.value - 0.5) * 1.2);
    // Blink squashes the eye vertically (ry → ~0).
    const ry = EYE_RY * (reduce ? 1 : 0.12 + blink.value * 0.88);
    return { ry, cy: EYE_Y + dy, cx: 50 - EYE_DX + dx } as never;
  });
  const gazeRight = useAnimatedProps(() => {
    const dx = reduce ? 0 : (look.value - 0.5) * 3;
    const dy = (lookUp ? -3.5 : 0) + (reduce ? 0 : (look.value - 0.5) * 1.2);
    const ry = EYE_RY * (reduce ? 1 : 0.12 + blink.value * 0.88);
    return { ry, cy: EYE_Y + dy, cx: 50 + EYE_DX + dx } as never;
  });

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, wrapStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="kaiHead" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#DCC089" />
            <Stop offset="1" stopColor="#BE9B57" />
          </LinearGradient>
        </Defs>

        {/* Head — a soft, slightly organic gold form (hand-made warmth). */}
        <Path
          d="M50 4 C74 4 92 20 92 47 C92 76 74 96 50 96 C26 96 8 76 8 47 C8 20 26 4 50 4 Z"
          fill="url(#kaiHead)"
          stroke="rgba(255,250,238,0.5)"
          strokeWidth={1.4}
        />

        {eyesAsArcs ? (
          // Content eyes — gentle upward arcs (^ ^).
          <>
            <Path
              d={`M${50 - EYE_DX - 7} ${EYE_Y + 2} Q ${50 - EYE_DX} ${EYE_Y - 7} ${50 - EYE_DX + 7} ${EYE_Y + 2}`}
              stroke={Colors.ink.primary}
              strokeWidth={3.4}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={`M${50 + EYE_DX - 7} ${EYE_Y + 2} Q ${50 + EYE_DX} ${EYE_Y - 7} ${50 + EYE_DX + 7} ${EYE_Y + 2}`}
              stroke={Colors.ink.primary}
              strokeWidth={3.4}
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          // Open eyes — soft tall ovals that blink + drift their gaze.
          <>
            <AnimatedEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={gaze} />
            <AnimatedEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={gazeRight} />
          </>
        )}

        {/* A small mouth only for the warmest states. */}
        {emotion === 'happy' || emotion === 'proud' ? (
          <Path
            d="M42 70 Q50 77 58 70"
            stroke={Colors.ink.primary}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      {/* Soft warm presence behind the face. */}
      <View
        style={[styles.glow, { width: size * 1.35, height: size * 1.35 }]}
        pointerEvents="none"
      />
    </Animated.View>
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

export default React.memo(KaiFace);
