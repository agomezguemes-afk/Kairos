// KAIROS — KaiFace: a flat 2D character with real, shifting emotions.
//
// Bar (Álvaro): fluid animation, *real changing emotions*, fine polished UI. The
// form never deforms or rotates (that read cheap) — it's a rock-solid flat gold
// block. Emotion lives entirely in an expressive 2D face: eyes (with a highlight)
// that blink, gaze and squint into smiles; a mouth that morphs; and EYEBROWS —
// the feature that actually carries feeling (raise = open/curious, furrow =
// focus). Every value eases on a spring, so feelings transition, never snap. In
// idle Kai's mood gently shifts on its own (a curious look, a content moment),
// so it reads as alive and changing rather than a fixed expression. Poke it for a
// little burst of delight. Reduce-motion → a calm still neutral.
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
const EYE_Y = 51;
const EYE_DX = 12.5;
const EYE_RX = 5.6;
const EYE_RY = 7.4;
const BROW_Y = 40;
const MOUTH_Y = 68;

const EASE: WithSpringConfig = { damping: 16, stiffness: 150, mass: 1 };
const GAZE: WithSpringConfig = { damping: 18, stiffness: 110, mass: 1 };
const MOOD: WithSpringConfig = { damping: 17, stiffness: 95, mass: 1 };

// Per-emotion facial targets — the "pose" each feeling settles into.
interface Pose {
  smile: number;
  joy: number;
  browY: number;
  browTilt: number;
  up: number;
}
const POSES: Record<KaiEmotion, Pose> = {
  idle: { smile: 0.4, joy: 0, browY: 0, browTilt: 0.12, up: 0 },
  happy: { smile: 1, joy: 1, browY: 0.35, browTilt: 0.25, up: 0 },
  proud: { smile: 1, joy: 0.9, browY: 0.2, browTilt: -0.08, up: 0 },
  thinking: { smile: 0.08, joy: 0, browY: 0.12, browTilt: -0.5, up: 1 },
  rest: { smile: 0.9, joy: 0.8, browY: 0.25, browTilt: 0.2, up: 0 },
};

export default function KaiFace({ size = 96, emotion = 'idle', interactive = true }: KaiFaceProps) {
  const reduce = useReducedMotion();

  const smile = useSharedValue(POSES.idle.smile);
  const joy = useSharedValue(0);
  const browY = useSharedValue(0);
  const browTilt = useSharedValue(0.12);
  const up = useSharedValue(0);
  const blink = useSharedValue(1);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const eyeWide = useSharedValue(0);

  const settleTo = useCallback(
    (p: Pose, cfg: WithSpringConfig) => {
      'worklet';
      smile.value = withSpring(p.smile, cfg);
      joy.value = withSpring(p.joy, cfg);
      browY.value = withSpring(p.browY, cfg);
      browTilt.value = withSpring(p.browTilt, cfg);
      up.value = withSpring(p.up, cfg);
    },
    [smile, joy, browY, browTilt, up],
  );

  // Emotion → its pose (eased; feelings transition, never snap).
  useEffect(() => {
    settleTo(POSES[emotion], EASE);
    if (emotion === 'thinking' && !reduce) {
      lookX.value = withSpring(0.45, GAZE);
      lookY.value = withSpring(-0.6, GAZE);
    } else if (!reduce) {
      lookY.value = withSpring(0, GAZE);
    }
  }, [emotion, reduce, settleTo, lookX, lookY]);

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

  // Living mood — only in idle. Every few seconds Kai drifts into a small,
  // genuine micro-expression (a curious look, a content beat, a glance) and eases
  // back. This is what makes the emotion feel real and *changing*, not a fixed
  // face. All on-plane, all spring-eased.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (reduce || emotion !== 'idle') return () => {};
    let t: ReturnType<typeof setTimeout>;
    const base = POSES.idle;
    const tick = () => {
      if (!alive.current) return;
      const r = Math.random();
      if (r < 0.34) {
        // curious — brows up, look up-aside
        browY.value = withSpring(0.5, MOOD);
        smile.value = withSpring(0.55, MOOD);
        lookX.value = withSpring((Math.random() < 0.5 ? -1 : 1) * 0.7, GAZE);
        lookY.value = withSpring(-0.35, GAZE);
      } else if (r < 0.62) {
        // content — soft squint + a fuller smile
        joy.value = withSpring(0.32, MOOD);
        smile.value = withSpring(0.66, MOOD);
        browTilt.value = withSpring(0.28, MOOD);
      } else {
        // just a glance
        lookX.value = withSpring((Math.random() * 2 - 1) * 0.8, GAZE);
        lookY.value = withSpring((Math.random() * 2 - 1) * 0.4, GAZE);
      }
      t = setTimeout(
        () => {
          if (!alive.current) return;
          settleTo(base, MOOD);
          lookX.value = withSpring(0, GAZE);
          lookY.value = withSpring(0, GAZE);
          t = setTimeout(tick, 2800 + Math.random() * 2800);
        },
        1300 + Math.random() * 1000,
      );
    };
    t = setTimeout(tick, 2200 + Math.random() * 1600);
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, [reduce, emotion, browY, smile, joy, browTilt, lookX, lookY, settleTo]);

  const poke = useCallback(() => {
    if (reduce) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    lookX.value = withSpring(0, GAZE);
    lookY.value = withSpring(0, GAZE);
    eyeWide.value = withSequence(withTiming(1, { duration: 120 }), withSpring(0, EASE));
    browY.value = withSequence(
      withSpring(0.5, EASE),
      withDelay(700, withSpring(POSES.idle.browY, EASE)),
    );
    smile.value = withSequence(
      withSpring(1, EASE),
      withDelay(800, withSpring(POSES.idle.smile, EASE)),
    );
    blink.value = withSequence(
      withTiming(0, { duration: 55 }),
      withTiming(1, { duration: 90 }),
      withDelay(60, withTiming(0, { duration: 55 })),
      withTiming(1, { duration: 110 }),
    );
  }, [reduce, lookX, lookY, eyeWide, browY, smile, blink]);

  const eyeL = useAnimatedProps(() => eyeProps(-1, joy, blink, up, lookX, lookY, eyeWide, reduce));
  const eyeR = useAnimatedProps(() => eyeProps(1, joy, blink, up, lookX, lookY, eyeWide, reduce));
  const hlL = useAnimatedProps(() => hlProps(-1, blink, up, lookX, lookY, joy, reduce));
  const hlR = useAnimatedProps(() => hlProps(1, blink, up, lookX, lookY, joy, reduce));
  const browL = useAnimatedProps(() => browProps(-1, browY, browTilt, lookX, reduce));
  const browR = useAnimatedProps(() => browProps(1, browY, browTilt, lookX, reduce));
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
      <APath
        animatedProps={browL}
        stroke={Colors.ink.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <APath
        animatedProps={browR}
        stroke={Colors.ink.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
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

function browProps(
  side: -1 | 1,
  browY: SharedValue<number>,
  browTilt: SharedValue<number>,
  lookX: SharedValue<number>,
  reduce: boolean,
) {
  'worklet';
  const dx = reduce ? 0 : lookX.value * 2.6;
  const xo = FX + side * (EYE_DX + 5.5) + dx; // outer end
  const xi = FX + side * (EYE_DX - 5.5) + dx; // inner end (toward centre)
  const base = BROW_Y - browY.value * 4;
  const yi = base - browTilt.value * 3; // inner up when tilt > 0
  const yo = base + browTilt.value * 1.5;
  const mx = (xo + xi) / 2;
  const my = (yi + yo) / 2 - 1.6; // gentle arch
  return { d: `M${xo} ${yo} Q ${mx} ${my} ${xi} ${yi}` } as never;
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
