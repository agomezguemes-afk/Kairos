// KAIROS — KaiFace: a flat 2D character whose life is purely in its face.
//
// Álvaro's bar: NO 3D feel — the form must not change dimensions (squash/stretch)
// or angle (rotation); that reads cheap. The shape stays rock-solid and flat, and
// every change happens *exquisitely on the 2D plane*: the eyes and mouth. So Kai
// is a stable gold block, and the craft is in beautifully-eased facial motion —
// smooth blinks, a calm wandering gaze, emotion morphs, and a 2D delight when you
// poke it. Reduce-motion → a still, calm neutral.
//
// emotion: 'idle' | 'happy' | 'thinking' | 'proud' | 'rest'

import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  type WithSpringConfig,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

const AEllipse = Animated.createAnimatedComponent(Ellipse);
const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);

export type KaiEmotion = 'idle' | 'happy' | 'thinking' | 'proud' | 'rest';

interface KaiFaceProps {
  size?: number;
  emotion?: KaiEmotion;
  interactive?: boolean;
}

const BODY = { x: 17, y: 19, w: 66, h: 66, rx: 19 };
const FX = 50;
const EYE_Y = 50;
const EYE_DX = 12.5;
const EYE_RX = 5.6;
const EYE_RY = 7.4;
const MOUTH_Y = 67;

// Everything eases — the "exquisite" quality is in the timing, not in motion size.
const EASE: WithSpringConfig = { damping: 16, stiffness: 150, mass: 1 };
const GAZE: WithSpringConfig = { damping: 18, stiffness: 110, mass: 1 };

export default function KaiFace({ size = 96, emotion = 'idle', interactive = true }: KaiFaceProps) {
  const reduce = useReducedMotion();

  const joy = useSharedValue(0); // open eyes → happy arcs
  const smile = useSharedValue(0.42); // mouth curve
  const up = useSharedValue(0); // gaze up (thinking)
  const blink = useSharedValue(1);
  const lookX = useSharedValue(0); // −1..1 (2D wandering gaze)
  const lookY = useSharedValue(0); // −1..1
  const eyeWide = useSharedValue(0); // poke delight

  // Emotion → eased facial targets (no body transform — strictly 2D face).
  useEffect(() => {
    const pleased = emotion === 'happy' || emotion === 'proud' || emotion === 'rest';
    joy.value = withSpring(pleased ? 1 : 0, EASE);
    smile.value = withSpring(emotion === 'thinking' ? 0.05 : pleased ? 1 : 0.42, EASE);
    up.value = withSpring(emotion === 'thinking' ? 1 : 0, EASE);
    if (emotion === 'thinking' && !reduce) {
      // looks up-and-aside, pondering — all in plane
      lookX.value = withSpring(0.5, GAZE);
      lookY.value = withSpring(-0.6, GAZE);
    } else if (!reduce) {
      lookY.value = withSpring(0, GAZE);
    }
  }, [emotion, reduce, joy, smile, up, lookX, lookY]);

  // Smooth, natural blink loop.
  useEffect(() => {
    if (reduce) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(2700, withTiming(0, { duration: 65, easing: Easing.in(Easing.quad) })),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
    );
  }, [reduce, blink]);

  // A calm wandering gaze — Kai glances around the 2D plane on its own. The only
  // idle motion, and it's strictly on-plane (eyes move, the form never does).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (reduce || emotion === 'thinking') return () => {};
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive.current) return;
      lookX.value = withSpring((Math.random() * 2 - 1) * 0.8, GAZE);
      lookY.value = withSpring((Math.random() * 2 - 1) * 0.45, GAZE);
      // settle back to centre after a beat
      t = setTimeout(
        () => {
          if (!alive.current) return;
          lookX.value = withSpring(0, GAZE);
          lookY.value = withSpring(0, GAZE);
          t = setTimeout(tick, 2600 + Math.random() * 2600);
        },
        1100 + Math.random() * 900,
      );
    };
    t = setTimeout(tick, 2200 + Math.random() * 1600);
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, [reduce, emotion, lookX, lookY]);

  // Poke → a 2D delight: eyes widen, a warm smile, a quick double-blink, gaze
  // snaps to you. No body motion — the joy is all in the face.
  const poke = useCallback(() => {
    if (reduce) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    lookX.value = withSpring(0, GAZE);
    lookY.value = withSpring(0, GAZE);
    eyeWide.value = withSequence(withTiming(1, { duration: 120 }), withSpring(0, EASE));
    smile.value = withSequence(withSpring(1, EASE), withDelay(800, withSpring(0.42, EASE)));
    blink.value = withSequence(
      withTiming(0, { duration: 55 }),
      withTiming(1, { duration: 90 }),
      withDelay(60, withTiming(0, { duration: 55 })),
      withTiming(1, { duration: 110 }),
    );
  }, [reduce, lookX, lookY, eyeWide, smile, blink]);

  const eyeL = useAnimatedProps(() => eyeProps(-1, joy, blink, up, lookX, lookY, eyeWide, reduce));
  const eyeR = useAnimatedProps(() => eyeProps(1, joy, blink, up, lookX, lookY, eyeWide, reduce));
  const hlL = useAnimatedProps(() => hlProps(-1, blink, up, lookX, lookY, joy, reduce));
  const hlR = useAnimatedProps(() => hlProps(1, blink, up, lookX, lookY, joy, reduce));
  const arcs = useAnimatedProps(() => ({ opacity: joy.value }));
  const mouthProps = useAnimatedProps(() => {
    const curve = smile.value * 9;
    return { d: `M${FX - 9} ${MOUTH_Y} Q ${FX} ${MOUTH_Y + curve} ${FX + 9} ${MOUTH_Y}` };
  });

  const face = (
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
      <AEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={eyeL} />
      <AEllipse rx={EYE_RX} fill={Colors.ink.primary} animatedProps={eyeR} />
      <ACircle r={1.7} fill="#FFFFFF" animatedProps={hlL} />
      <ACircle r={1.7} fill="#FFFFFF" animatedProps={hlR} />
      <APath
        animatedProps={arcs}
        d={`M${FX - EYE_DX - 5.5} ${EYE_Y + 1} Q ${FX - EYE_DX} ${EYE_Y - 5.5} ${FX - EYE_DX + 5.5} ${EYE_Y + 1}`}
        stroke={Colors.ink.primary}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <APath
        animatedProps={arcs}
        d={`M${FX + EYE_DX - 5.5} ${EYE_Y + 1} Q ${FX + EYE_DX} ${EYE_Y - 5.5} ${FX + EYE_DX + 5.5} ${EYE_Y + 1}`}
        stroke={Colors.ink.primary}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <APath
        animatedProps={mouthProps}
        stroke={Colors.ink.primary}
        strokeWidth={2.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[styles.glow, { width: size * 1.26, height: size * 1.26 }]}
        pointerEvents="none"
      />
      {interactive ? (
        <Pressable onPress={poke} accessibilityRole="button" accessibilityLabel="Kai">
          {face}
        </Pressable>
      ) : (
        face
      )}
    </View>
  );
}

function eyeProps(
  side: -1 | 1,
  joy: SharedValue<number>,
  blink: SharedValue<number>,
  up: SharedValue<number>,
  lookX: SharedValue<number>,
  lookY: SharedValue<number>,
  eyeWide: SharedValue<number>,
  reduce: boolean,
) {
  'worklet';
  const dx = reduce ? 0 : lookX.value * 2.6;
  const dy = reduce ? 0 : lookY.value * 2.2;
  const ry = EYE_RY * (1 + eyeWide.value * 0.4) * blink.value * (1 - joy.value * 0.82);
  return { ry, cx: FX + side * EYE_DX + dx, cy: EYE_Y - up.value * 3 + dy } as never;
}

function hlProps(
  side: -1 | 1,
  blink: SharedValue<number>,
  up: SharedValue<number>,
  lookX: SharedValue<number>,
  lookY: SharedValue<number>,
  joy: SharedValue<number>,
  reduce: boolean,
) {
  'worklet';
  const dx = reduce ? 0 : lookX.value * 2.6;
  const dy = reduce ? 0 : lookY.value * 2.2;
  return {
    cx: FX + side * EYE_DX + dx + 2,
    cy: EYE_Y - up.value * 3 + dy - 2.5,
    opacity: blink.value * (1 - joy.value),
  } as never;
}

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
