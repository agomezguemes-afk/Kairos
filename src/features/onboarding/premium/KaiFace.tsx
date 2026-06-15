// KAIROS — KaiFace: Kai as a single recessed aperture, not a literal eye.
//
// Álvaro: more minimalist, without losing detail or creativity. So Kai sheds the
// literal eyeball (cream sclera → "minion") and becomes a refined **aperture** in
// a flat gold seal: a dark recessed well with a hair-thin gold iris-ring that
// always hugs it, one precise catchlight, and a softly concave socket. Fewer
// elements, each exquisite. The personality is still attention — the aperture
// dilates with interest, contracts to a tight point when it focuses, looks
// around, blinks, and the gold closes into a warm crescent when it's pleased —
// but it reads as a lens/eclipse, not a cartoon. The detail lives in the ring,
// the glint and the spring of the motion. Stable flat form (no deform/rotate);
// all life is on the 2D plane. Poke it and the aperture flares. Reduce-motion →
// calm hold.
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
  type WithSpringConfig,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

const ACircle = Animated.createAnimatedComponent(Circle);
const ARect = Animated.createAnimatedComponent(Rect);
const APath = Animated.createAnimatedComponent(Path);

export type KaiEmotion = 'idle' | 'happy' | 'thinking' | 'proud' | 'rest';

interface KaiFaceProps {
  size?: number;
  emotion?: KaiEmotion;
  interactive?: boolean;
}

const CX = 50;
const CY = 50;
const EYE_R = 19; // aperture opening radius — smaller, more negative space (minimal)
const GOLD_LID = '#CDA866'; // lids = block gold so the aperture shuts into the form

const EASE: WithSpringConfig = { damping: 16, stiffness: 150, mass: 1 };
const GAZE: WithSpringConfig = { damping: 18, stiffness: 110, mass: 1 };
const MOOD: WithSpringConfig = { damping: 17, stiffness: 95, mass: 1 };

interface Pose {
  dilate: number; // pupil size: + bigger (interest), − smaller (focus)
  warmth: number; // lower lid lifts into a crescent (pleased)
  focus: number; // both lids narrow (concentration)
  upX: number;
  upY: number; // gaze bias (thinking looks up)
}
const POSES: Record<KaiEmotion, Pose> = {
  idle: { dilate: 0.3, warmth: 0, focus: 0, upX: 0, upY: 0 },
  happy: { dilate: 0.6, warmth: 1, focus: 0, upX: 0, upY: 0 },
  proud: { dilate: 0.45, warmth: 0.65, focus: 0, upX: 0, upY: 0 },
  thinking: { dilate: 0, warmth: 0, focus: 1, upX: 0.4, upY: -0.7 },
  rest: { dilate: 0.55, warmth: 0.8, focus: 0, upX: 0, upY: 0 },
};

export default function KaiFace({ size = 96, emotion = 'idle', interactive = true }: KaiFaceProps) {
  const reduce = useReducedMotion();

  const blink = useSharedValue(1); // 1 open … 0 closed
  const gazeX = useSharedValue(0);
  const gazeY = useSharedValue(0);
  const dilate = useSharedValue(POSES.idle.dilate);
  const warmth = useSharedValue(0);
  const focus = useSharedValue(0);

  const settle = useCallback(
    (p: Pose, cfg: WithSpringConfig) => {
      'worklet';
      dilate.value = withSpring(p.dilate, cfg);
      warmth.value = withSpring(p.warmth, cfg);
      focus.value = withSpring(p.focus, cfg);
    },
    [dilate, warmth, focus],
  );

  useEffect(() => {
    const p = POSES[emotion];
    settle(p, EASE);
    if (!reduce) {
      gazeX.value = withSpring(p.upX, GAZE);
      gazeY.value = withSpring(p.upY, GAZE);
    }
  }, [emotion, reduce, settle, gazeX, gazeY]);

  useEffect(() => {
    if (reduce) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(2900, withTiming(0, { duration: 70, easing: Easing.in(Easing.quad) })),
        withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
    );
  }, [reduce, blink]);

  // Living attention — only in idle. Kai glances around and its interest flickers
  // (pupil dilates a touch, a curious beat) then settles. Real, changing, on-plane.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (reduce || emotion !== 'idle') return () => {};
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!alive.current) return;
      gazeX.value = withSpring((Math.random() * 2 - 1) * 0.85, GAZE);
      gazeY.value = withSpring((Math.random() * 2 - 1) * 0.55, GAZE);
      if (Math.random() < 0.5) dilate.value = withSpring(0.55, MOOD); // a flicker of interest
      t = setTimeout(
        () => {
          if (!alive.current) return;
          gazeX.value = withSpring(0, GAZE);
          gazeY.value = withSpring(0, GAZE);
          dilate.value = withSpring(POSES.idle.dilate, MOOD);
          t = setTimeout(tick, 2600 + Math.random() * 2600);
        },
        1100 + Math.random() * 900,
      );
    };
    t = setTimeout(tick, 2000 + Math.random() * 1600);
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, [reduce, emotion, gazeX, gazeY, dilate]);

  const poke = useCallback(() => {
    if (reduce) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    gazeX.value = withSpring(0, GAZE);
    gazeY.value = withSpring(0, GAZE);
    dilate.value = withSequence(
      withSpring(1, EASE),
      withDelay(650, withSpring(POSES.idle.dilate, EASE)),
    );
    warmth.value = withSequence(withSpring(0.8, EASE), withDelay(750, withSpring(0, EASE)));
    blink.value = withSequence(withTiming(0, { duration: 55 }), withTiming(1, { duration: 110 }));
  }, [reduce, gazeX, gazeY, dilate, warmth, blink]);

  // The aperture: a dark recessed well whose radius reads as interest/focus. The
  // hair-thin gold stroke is the iris-ring — because it's the same circle, it
  // always hugs the well perfectly as it breathes.
  const pupil = useAnimatedProps(() => {
    const gx = reduce ? 0 : gazeX.value * 5;
    const gy = reduce ? 0 : gazeY.value * 4;
    const r = 6.4 + dilate.value * 2.2 - focus.value * 2.6;
    return { cx: CX + gx, cy: CY + gy, r } as never;
  });
  const glint = useAnimatedProps(() => {
    const gx = reduce ? 0 : gazeX.value * 5;
    const gy = reduce ? 0 : gazeY.value * 4;
    return { cx: CX + gx - 2.7, cy: CY + gy - 3.3, opacity: blink.value } as never;
  });
  const upperLid = useAnimatedProps(() => {
    // bottom edge sweeps down to close; narrows a little when focused
    const closed = 1 - blink.value;
    const bottom = CY - EYE_R + closed * (2 * EYE_R) + focus.value * 7;
    return { height: Math.max(0, bottom - (CY - EYE_R - 6)) } as never;
  });
  const lowerLid = useAnimatedProps(() => {
    const closed = 1 - blink.value;
    // Lift the gold from below — but leave a clear crescent of the well visible
    // (without a bright sclera, over-lifting just blanks the aperture).
    const raise = warmth.value * 12 + focus.value * 6 + closed * 10;
    const topY = CY + EYE_R - raise;
    const arch = warmth.value * 10; // convex top = warm crescent aperture
    return {
      d: `M${CX - EYE_R - 6} ${CY + EYE_R + 6} L${CX - EYE_R - 6} ${topY} Q ${CX} ${topY - arch} ${CX + EYE_R + 6} ${topY} L${CX + EYE_R + 6} ${CY + EYE_R + 6} Z`,
    } as never;
  });

  const face = (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="kaiBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D9BD84" />
          <Stop offset="1" stopColor="#CAA85F" />
        </LinearGradient>
        {/* Concave socket: deeper at the centre, lit at the rim. */}
        <RadialGradient id="kaiSocket" cx="50%" cy="46%" r="52%">
          <Stop offset="0" stopColor="#9C7B3A" />
          <Stop offset="1" stopColor="#CDAB6B" />
        </RadialGradient>
        {/* The well, with a touch of depth lifted toward the catchlight. */}
        <RadialGradient id="kaiWell" cx="40%" cy="36%" r="66%">
          <Stop offset="0" stopColor="#2C2114" />
          <Stop offset="1" stopColor="#15100A" />
        </RadialGradient>
        <ClipPath id="eyeClip">
          <Circle cx={CX} cy={CY} r={EYE_R} />
        </ClipPath>
      </Defs>

      {/* Flat gold seal — a hairline lit edge, not a 3D bauble. */}
      <Path
        d={roundedRect(12, 12, 76, 76, 22)}
        fill="url(#kaiBody)"
        stroke="rgba(255,250,238,0.38)"
        strokeWidth={1.1}
      />

      <G clipPath="url(#eyeClip)">
        <Circle cx={CX} cy={CY} r={EYE_R} fill="url(#kaiSocket)" />
        {/* Aperture (dark well) + its hair-thin gold iris-ring, one circle. */}
        <ACircle fill="url(#kaiWell)" stroke="#E6C57E" strokeWidth={1.3} animatedProps={pupil} />
        <ACircle r={1.9} fill="#FFF7E6" animatedProps={glint} />
        {/* Lids are the block's gold — the aperture shuts into the form. */}
        <ARect
          x={CX - EYE_R - 6}
          y={CY - EYE_R - 6}
          width={2 * (EYE_R + 6)}
          fill={GOLD_LID}
          animatedProps={upperLid}
        />
        <APath fill={GOLD_LID} animatedProps={lowerLid} />
      </G>
      {/* The crafted opening — one recessed rim for definition. */}
      <Circle
        cx={CX}
        cy={CY}
        r={EYE_R}
        fill="none"
        stroke="rgba(108,82,34,0.45)"
        strokeWidth={1.3}
      />
    </Svg>
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[styles.glow, { width: size * 1.08, height: size * 1.08, top: size * 0.06 }]}
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
    opacity: 0.55,
    zIndex: -1,
  },
});
