// KAIROS — KaiFace: Kai's character. Flat & clean, with deeply animated emotions.
//
// Álvaro: drop the 3D (cheap); what matters is fluid, finely-crafted emotion
// animation. So Kai is a flat gold block (the brand atom, 2D and clean) whose
// LIFE is in the motion: eyes and mouth morph between feelings on springs, it
// blinks, breathes, glances around, and squash-&-stretch-bounces when it's
// pleased. Emotions don't snap — they ease. Reduce-motion holds a calm neutral.
//
// emotion: 'idle' | 'happy' | 'thinking' | 'proud' | 'rest'

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
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export type KaiEmotion = 'idle' | 'happy' | 'thinking' | 'proud' | 'rest';

interface KaiFaceProps {
  size?: number;
  emotion?: KaiEmotion;
}

// Flat block on a 100×100 stage. Face features live on it.
const BODY = { x: 18, y: 20, w: 64, h: 64, rx: 17 };
const FX = 50; // face centre x
const EYE_Y = 49;
const EYE_DX = 13;
const EYE_RX = 6;
const EYE_RY = 7.6;
const MOUTH_Y = 67;

// Emotions ease, never snap.
const EASE: WithSpringConfig = { damping: 15, stiffness: 170, mass: 0.9 };

export default function KaiFace({ size = 96, emotion = 'idle' }: KaiFaceProps) {
  const reduce = useReducedMotion();

  // Emotion targets (spring-interpolated → fluid morphs).
  const joy = useSharedValue(0); // squints eyes + reveals happy arcs
  const smile = useSharedValue(0.4); // mouth curve
  const up = useSharedValue(0); // gaze up (thinking)
  const pop = useSharedValue(0); // one-shot bounce on a pleased emotion

  // Continuous life.
  const blink = useSharedValue(1);
  const breathe = useSharedValue(0);
  const look = useSharedValue(0);

  useEffect(() => {
    const pleased = emotion === 'happy' || emotion === 'proud' || emotion === 'rest';
    joy.value = withSpring(pleased ? 1 : 0, EASE);
    smile.value = withSpring(emotion === 'thinking' ? 0 : pleased ? 1 : 0.4, EASE);
    up.value = withSpring(emotion === 'thinking' ? 1 : 0, EASE);
    if ((emotion === 'happy' || emotion === 'proud') && !reduce) {
      pop.value = withSequence(
        withSpring(1, { damping: 7, stiffness: 260, mass: 0.7 }),
        withSpring(0, { damping: 12, stiffness: 180 }),
      );
    }
  }, [emotion, reduce, joy, smile, up, pop]);

  useEffect(() => {
    if (reduce) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(2300, withTiming(0, { duration: 75, easing: Easing.in(Easing.quad) })),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 2700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    look.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, blink, breathe, look]);

  const bodyStyle = useAnimatedStyle(() => {
    const br = reduce ? 0 : breathe.value - 0.5;
    const p = pop.value;
    return {
      transform: [
        { translateY: -br * 3.5 - p * 4 },
        { rotate: `${up.value * -2 + br * 1.4}deg` },
        { scaleX: (1 - br * 0.022) * (1 - p * 0.05) },
        { scaleY: (1 + br * 0.022) * (1 + p * 0.07) },
      ],
    };
  });

  const eyeL = useAnimatedProps(() => eyeProps(-1, joy, blink, up, look, reduce));
  const eyeR = useAnimatedProps(() => eyeProps(1, joy, blink, up, look, reduce));

  // Happy arcs over the eyes — fade in as joy rises (the squint→smile-eyes morph).
  const arcs = useAnimatedProps(() => ({ opacity: joy.value }));

  const mouthProps = useAnimatedProps(() => {
    const c = smile.value; // 0 flat … 1 big smile
    const curve = c * 9; // control dips down = upturned mouth
    return { d: `M${FX - 9} ${MOUTH_Y} Q ${FX} ${MOUTH_Y + curve} ${FX + 9} ${MOUTH_Y}` };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[styles.glow, { width: size * 1.28, height: size * 1.28 }]}
        pointerEvents="none"
      />
      <Animated.View style={bodyStyle}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="kaiBody" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#D9BC83" />
              <Stop offset="1" stopColor="#C29E5C" />
            </LinearGradient>
          </Defs>

          <Path
            d={roundedRect(BODY.x, BODY.y, BODY.w, BODY.h, BODY.rx)}
            fill="url(#kaiBody)"
            stroke="rgba(255,250,238,0.4)"
            strokeWidth={1.2}
          />

          <AnimatedEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={eyeL} />
          <AnimatedEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={eyeR} />

          {/* Happy eye-arcs, revealed by joy (over the squinting eyes). */}
          <AnimatedPath
            animatedProps={arcs}
            d={`M${FX - EYE_DX - 6} ${EYE_Y + 1} Q ${FX - EYE_DX} ${EYE_Y - 6} ${FX - EYE_DX + 6} ${EYE_Y + 1}`}
            stroke={Colors.ink.primary}
            strokeWidth={3.1}
            strokeLinecap="round"
            fill="none"
          />
          <AnimatedPath
            animatedProps={arcs}
            d={`M${FX + EYE_DX - 6} ${EYE_Y + 1} Q ${FX + EYE_DX} ${EYE_Y - 6} ${FX + EYE_DX + 6} ${EYE_Y + 1}`}
            stroke={Colors.ink.primary}
            strokeWidth={3.1}
            strokeLinecap="round"
            fill="none"
          />

          <AnimatedPath
            animatedProps={mouthProps}
            stroke={Colors.ink.primary}
            strokeWidth={2.7}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Eye geometry per side (-1 left, +1 right). Squints with joy, lifts with `up`,
// drifts with idle `look`, and squashes shut on blink.
function eyeProps(
  side: -1 | 1,
  joy: { value: number },
  blink: { value: number },
  up: { value: number },
  look: { value: number },
  reduce: boolean,
) {
  'worklet';
  const drift = reduce ? 0 : (look.value - 0.5) * 2.2;
  const ry = EYE_RY * blink.value * (1 - joy.value * 0.82);
  const cy = EYE_Y - up.value * 3 + (reduce ? 0 : (look.value - 0.5) * 0.9);
  const cx = FX + side * EYE_DX + drift;
  return { ry, cy, cx } as never;
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
