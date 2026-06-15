// KAIROS — KaiFace: Kai as "El Glifo", a single living gold stroke.
//
// Álvaro: not a natural eye — an elemental, minimalist figure that emotes through
// movement, with richly polished animation. So Kai is **one continuous gold
// stroke** — a living signature — that draws and reshapes itself with its mood.
// No face, no eye, no anatomy. All character is in the line and how it moves:
//   · rest/idle — a calm, near-flat stroke with a slow travelling wave (it breathes)
//   · happy     — the line buoys into a warm upward smile-curve
//   · thinking  — it compresses, tenses, and a bright bead scans along it
//   · proud     — it rises to the right and flicks up into a confident flourish
//   · rest(mood)— settles low and calm
// A soft tip-spark catches light; a poke sends a ripple + flourish through it.
// The silhouette never deforms by squash/rotate — it *redraws*. 2D, spring-eased.
// Reduce-motion → a calm, still stroke.
//
// emotion: 'idle' | 'happy' | 'thinking' | 'proud' | 'rest'

import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);

export type KaiEmotion = 'idle' | 'happy' | 'thinking' | 'proud' | 'rest';

interface KaiFaceProps {
  size?: number;
  emotion?: KaiEmotion;
  interactive?: boolean;
}

const CX = 50;
const CY = 50;
const TWO_PI = Math.PI * 2;

const EASE: WithSpringConfig = { damping: 16, stiffness: 150, mass: 1 };
const MOOD: WithSpringConfig = { damping: 18, stiffness: 110, mass: 1 };

interface Pose {
  mood: number; // + smile (ends up / middle down), − arch
  tilt: number; // overall slope (right rises)
  tighten: number; // horizontal compression of the stroke
  flourish: number; // proud's rising end-hook
  waveAmp: number; // amplitude of the idle travelling wave (life)
  spark: number; // tip-spark brightness
}
const POSES: Record<KaiEmotion, Pose> = {
  idle: { mood: 0.25, tilt: 0, tighten: 1.0, flourish: 0, waveAmp: 1.4, spark: 0.4 },
  happy: { mood: 1.55, tilt: 0, tighten: 0.94, flourish: 0, waveAmp: 0.6, spark: 0.7 },
  proud: { mood: 0.4, tilt: 4.6, tighten: 1.0, flourish: 1.45, waveAmp: 0.5, spark: 0.85 },
  thinking: { mood: -0.4, tilt: 0, tighten: 0.66, flourish: 0, waveAmp: 2.4, spark: 0.5 },
  rest: { mood: -0.5, tilt: -1.6, tighten: 0.88, flourish: 0, waveAmp: 0.7, spark: 0.2 },
};

// Cubic Bézier scalar — used to ride the scanning bead along the live stroke.
function bez(t: number, a: number, b: number, c: number, d: number): number {
  'worklet';
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
}

export default function KaiFace({ size = 96, emotion = 'idle', interactive = true }: KaiFaceProps) {
  const reduce = useReducedMotion();

  const mood = useSharedValue(POSES.idle.mood);
  const tilt = useSharedValue(POSES.idle.tilt);
  const tighten = useSharedValue(POSES.idle.tighten);
  const flourish = useSharedValue(0);
  const waveAmp = useSharedValue(POSES.idle.waveAmp);
  const spark = useSharedValue(POSES.idle.spark);
  const wavePhase = useSharedValue(0);
  const scan = useSharedValue(0); // 0..1 position of the thinking bead
  const scanO = useSharedValue(0); // bead opacity
  const pulse = useSharedValue(0); // poke ripple

  // The 8 numbers that define the live stroke, from the current mood + the
  // travelling wave. One source of truth so the path, the tip-spark and the
  // scanning bead all ride the exact same curve.
  const pts = useCallback(() => {
    'worklet';
    const half = 27 * tighten.value;
    const x0 = CX - half;
    const x3 = CX + half;
    const w = reduce ? 0 : waveAmp.value;
    const ph = wavePhase.value;
    const m = mood.value;
    const tl = tilt.value;
    const fl = flourish.value;
    const y0 = CY - m * 7 + tl + Math.sin(ph) * w;
    const y3 = CY - m * 7 - tl - fl * 12 + Math.sin(ph + Math.PI) * w;
    const c1x = CX - half * 0.42;
    const c2x = CX + half * 0.42;
    const c1y = CY + m * 9 + tl * 0.5 + Math.sin(ph + 1) * w * 1.5;
    const c2y = CY + m * 9 - tl * 0.5 - fl * 8 + Math.sin(ph + 2) * w * 1.5;
    return { x0, y0, c1x, c1y, c2x, c2y, x3, y3 };
  }, [reduce, tighten, waveAmp, wavePhase, mood, tilt, flourish]);

  const settle = useCallback(
    (p: Pose, cfg: WithSpringConfig) => {
      'worklet';
      mood.value = withSpring(p.mood, cfg);
      tilt.value = withSpring(p.tilt, cfg);
      tighten.value = withSpring(p.tighten, cfg);
      flourish.value = withSpring(p.flourish, cfg);
      waveAmp.value = withSpring(p.waveAmp, cfg);
      spark.value = withSpring(p.spark, cfg);
    },
    [mood, tilt, tighten, flourish, waveAmp, spark],
  );

  useEffect(() => {
    settle(POSES[emotion], EASE);
  }, [emotion, settle]);

  // The breath: a slow, endless travelling wave that keeps the line alive.
  useEffect(() => {
    if (reduce) return;
    wavePhase.value = withRepeat(
      withTiming(TWO_PI, { duration: 4200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(wavePhase);
  }, [reduce, wavePhase]);

  // Thinking: a bright bead runs along the signature, over and over.
  useEffect(() => {
    if (reduce || emotion !== 'thinking') {
      scanO.value = withSpring(0, MOOD);
      cancelAnimation(scan);
      return;
    }
    scanO.value = withSpring(1, MOOD);
    scan.value = 0;
    scan.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(scan);
  }, [reduce, emotion, scan, scanO]);

  // A small, well-mannered idle delight: every so often the line lifts a touch,
  // as if catching a thought, then settles. Only at idle, on the 2D plane.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (reduce || emotion !== 'idle') return () => {};
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive.current) return;
      mood.value = withSpring(0.45, MOOD);
      spark.value = withSpring(0.55, MOOD);
      t = setTimeout(
        () => {
          if (!alive.current) return;
          mood.value = withSpring(POSES.idle.mood, MOOD);
          spark.value = withSpring(POSES.idle.spark, MOOD);
          t = setTimeout(tick, 3200 + Math.random() * 3200);
        },
        900 + Math.random() * 700,
      );
    };
    t = setTimeout(tick, 2600 + Math.random() * 1800);
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, [reduce, emotion, mood, spark]);

  const poke = useCallback(() => {
    if (reduce) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const p = POSES[emotion];
    // A flourish runs through the line + a spark flash + an outward ripple.
    mood.value = withSequence(
      withSpring(p.mood + 0.5, EASE),
      withDelay(420, withSpring(p.mood, EASE)),
    );
    spark.value = withSequence(withSpring(1, EASE), withDelay(520, withSpring(p.spark, EASE)));
    pulse.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
  }, [reduce, emotion, mood, spark, pulse]);

  const strokeProps = useAnimatedProps(() => {
    const p = pts();
    return {
      d: `M${p.x0} ${p.y0} C ${p.c1x} ${p.c1y} ${p.c2x} ${p.c2y} ${p.x3} ${p.y3}`,
    } as never;
  });
  const tipProps = useAnimatedProps(() => {
    const p = pts();
    return {
      cx: p.x3,
      cy: p.y3,
      r: 2.7 + spark.value * 1.1,
      opacity: 0.55 + spark.value * 0.45,
    } as never;
  });
  const beadProps = useAnimatedProps(() => {
    const p = pts();
    const t = scan.value;
    return {
      cx: bez(t, p.x0, p.c1x, p.c2x, p.x3),
      cy: bez(t, p.y0, p.c1y, p.c2y, p.y3),
      opacity: scanO.value,
    } as never;
  });
  const rippleProps = useAnimatedProps(() => {
    return { r: 14 + pulse.value * 32, opacity: pulse.value * 0.26 } as never;
  });

  const glyph = (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="kaiInk" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#E7C57C" />
          <Stop offset="0.5" stopColor="#D8AC55" />
          <Stop offset="1" stopColor="#BF8F3B" />
        </LinearGradient>
      </Defs>

      {/* Poke ripple — a quiet outward ring. */}
      <ACircle
        cx={CX}
        cy={CY}
        fill="none"
        stroke="#D8AC55"
        strokeWidth={1.4}
        animatedProps={rippleProps}
      />

      {/* Soft echo beneath the stroke — a hair of lift, not a drop shadow. */}
      <G opacity={0.22}>
        <APath
          fill="none"
          stroke="#6E5220"
          strokeWidth={7.4}
          strokeLinecap="round"
          transform="translate(0 2)"
          animatedProps={strokeProps}
        />
      </G>

      {/* The living signature. */}
      <APath
        fill="none"
        stroke="url(#kaiInk)"
        strokeWidth={7}
        strokeLinecap="round"
        animatedProps={strokeProps}
      />

      {/* The scanning bead (thinking) + the tip-spark. */}
      <ACircle r={2.4} fill="#FFF4D6" animatedProps={beadProps} />
      <ACircle fill="#FFF4D6" animatedProps={tipProps} />
    </Svg>
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[styles.glow, { width: size * 0.92, height: size * 0.92 }]}
        pointerEvents="none"
      />
      {interactive ? (
        <Pressable onPress={poke} accessibilityRole="button" accessibilityLabel="Kai">
          {glyph}
        </Pressable>
      ) : (
        glyph
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: Colors.gold.glow,
    opacity: 0.4,
    zIndex: -1,
  },
});
