// src/animations/splash/SplashCondensed.tsx
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GoldBlock, KairosWordmark, MorphCube } from './primitives';

// ── Stage ──────────────────────────────────────────────────────────────
const STAGE_SIZE = 380;
const CENTER = STAGE_SIZE / 2;
const GLYPH_CY = 168;
const WORDMARK_CY = 250;
const TAGLINE_CY = 286;

// ── Layout (closer / larger per the new reference) ─────────────────────
// Sphere is the gravitational center; satellites emanate from it and
// settle into a tight asymmetric constellation.
const SPHERE = { dx: 6, dy: -6, size: 22 };

const SATELLITES = [
  { dx: -22, dy: -22, size: 17 },   // top-left
  { dx: -16, dy: 22, size: 18 },    // bottom-left
  { dx: 24, dy: 24, size: 16 },     // bottom-right
];

// ── Easings ────────────────────────────────────────────────────────────
const EASE_FLUID = Easing.bezier(0.22, 0.9, 0.32, 1.0);
const EASE_GENTLE_OUT = Easing.bezier(0.25, 0.46, 0.45, 0.94);
const EASE_ACCEL = Easing.bezier(0.55, 0.05, 0.85, 0.3);

// ── Timings (faster, more energetic per direction) ─────────────────────
const SPHERE_FADE_MS = 360;
const SATELLITE_BIRTH_DELAY = 220;
const SATELLITE_STAGGER_MS = 130;
const SATELLITE_FADE_IN_MS = 240;
const WORDMARK_DELAY = 800;
const WORDMARK_FADE_MS = 520;
const TAGLINE_DELAY = 1080;
const TAGLINE_FADE_MS = 460;
const BREATH_START = 1700;
const EXIT_START = 2350;
const EXIT_MS = 320;

// Wordmark breathing
const BREATH_DELTA = 0.005;
const BREATH_DURATION = 3000;

interface SplashCondensedProps {
  onDone: () => void;
}

export default function SplashCondensed({ onDone }: SplashCondensedProps) {
  const rootOpacity = useSharedValue(1);

  // ── Sphere (central, MorphCube fixed at full roundness = circle) ──
  const sphereCx = CENTER + SPHERE.dx;
  const sphereCy = GLYPH_CY + SPHERE.dy;
  const sphereX = useSharedValue(sphereCx);
  const sphereY = useSharedValue(sphereCy);
  const sphereScale = useSharedValue(0.4);
  const sphereOpacity = useSharedValue(0);
  const sphereRotation = useSharedValue(0);
  const sphereVisualSize = useSharedValue(SPHERE.size);
  const sphereRoundness = useSharedValue(SPHERE.size / 2);  // full circle

  // ── Satellites — born at sphere position, travel to constellation ──
  const sx0 = useSharedValue(sphereCx);
  const sy0 = useSharedValue(sphereCy);
  const sx1 = useSharedValue(sphereCx);
  const sy1 = useSharedValue(sphereCy);
  const sx2 = useSharedValue(sphereCx);
  const sy2 = useSharedValue(sphereCy);
  const satX = [sx0, sx1, sx2];
  const satY = [sy0, sy1, sy2];

  const satOp0 = useSharedValue(0);
  const satOp1 = useSharedValue(0);
  const satOp2 = useSharedValue(0);
  const satOpacity = [satOp0, satOp1, satOp2];

  const satScale0 = useSharedValue(0.3);
  const satScale1 = useSharedValue(0.3);
  const satScale2 = useSharedValue(0.3);
  const satScale = [satScale0, satScale1, satScale2];

  const satRot0 = useSharedValue(0);
  const satRot1 = useSharedValue(0);
  const satRot2 = useSharedValue(0);
  const satRotation = [satRot0, satRot1, satRot2];

  // ── Wordmark + tagline ──────────────────────────────────────────────
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkScale = useSharedValue(1.0);
  const taglineOpacity = useSharedValue(0);

  // KairosWordmark needs 6 reveal SVs but we hold them at 1 since
  // visibility is controlled at the group level here.
  const lr0 = useSharedValue(1);
  const lr1 = useSharedValue(1);
  const lr2 = useSharedValue(1);
  const lr3 = useSharedValue(1);
  const lr4 = useSharedValue(1);
  const lr5 = useSharedValue(1);
  const allReveals = [lr0, lr1, lr2, lr3, lr4, lr5];

  useEffect(() => {
    const timers: number[] = [];
    const t = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms) as unknown as number;
      timers.push(id);
    };

    // ── Sphere lands first, alone ─────────────────────────────────────
    Haptics.selectionAsync().catch(() => {});
    sphereOpacity.value = withTiming(1, { duration: SPHERE_FADE_MS, easing: EASE_FLUID });
    sphereScale.value = withTiming(1, { duration: SPHERE_FADE_MS, easing: EASE_FLUID });

    // ── Satellites emanate from the sphere center ──────────────────────
    SATELLITES.forEach((s, i) => {
      const targetX = CENTER + s.dx;
      const targetY = GLYPH_CY + s.dy;

      t(SATELLITE_BIRTH_DELAY + i * SATELLITE_STAGGER_MS, () => {
        satOpacity[i].value = withTiming(1, { duration: SATELLITE_FADE_IN_MS, easing: EASE_FLUID });
        satScale[i].value = withTiming(1, { duration: SATELLITE_FADE_IN_MS + 80, easing: EASE_FLUID });

        // Soft springs — settles like a mercury drop, no harsh bounce.
        satX[i].value = withSpring(targetX, { stiffness: 95, damping: 18, mass: 0.95 });
        satY[i].value = withSpring(targetY, { stiffness: 95, damping: 18, mass: 0.95 });

        const targetRot = ((i % 2 === 0 ? 1 : -1) * (3 + i * 2) * Math.PI) / 180;
        satRotation[i].value = withTiming(targetRot, { duration: 600, easing: EASE_GENTLE_OUT });
      });
    });

    // ── Wordmark + tagline ─────────────────────────────────────────────
    t(WORDMARK_DELAY, () => {
      wordmarkOpacity.value = withTiming(1, { duration: WORDMARK_FADE_MS, easing: EASE_FLUID });
    });

    t(TAGLINE_DELAY, () => {
      taglineOpacity.value = withTiming(1, { duration: TAGLINE_FADE_MS, easing: EASE_FLUID });
    });

    // ── Breathing on the wordmark ──────────────────────────────────────
    t(BREATH_START, () => {
      wordmarkScale.value = withRepeat(
        withSequence(
          withTiming(1 + BREATH_DELTA, { duration: BREATH_DURATION / 2 }),
          withTiming(1, { duration: BREATH_DURATION / 2 }),
        ),
        -1,
        false,
      );
    });

    // ── Exit ───────────────────────────────────────────────────────────
    t(EXIT_START, () => {
      rootOpacity.value = withTiming(0, { duration: EXIT_MS, easing: EASE_ACCEL }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    });

    return () => {
      timers.forEach((id) => clearTimeout(id));
    };
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <View style={styles.stage}>
        <MorphCube
          x={sphereX}
          y={sphereY}
          scale={sphereScale}
          opacity={sphereOpacity}
          rotation={sphereRotation}
          visualSize={sphereVisualSize}
          roundness={sphereRoundness}
          maxSize={SPHERE.size}
        />

        {SATELLITES.map((s, i) => (
          <GoldBlock
            key={`sat-${i}`}
            x={satX[i]}
            y={satY[i]}
            rotation={satRotation[i]}
            scale={satScale[i]}
            opacity={satOpacity[i]}
            size={s.size}
          />
        ))}

        <KairosWordmark
          centerX={CENTER}
          centerY={WORDMARK_CY}
          letterReveals={allReveals}
          scale={wordmarkScale}
          opacity={wordmarkOpacity}
          color="#1C1C1E"
        />

        <Animated.View
          style={[styles.taglineWrap, { top: TAGLINE_CY - 10 }, taglineStyle]}
          pointerEvents="none"
        >
          <Text style={styles.tagline}>ATHLETIC INTELLIGENCE</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
  },
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    position: 'relative',
  },
  taglineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 3.5,
    color: '#D4AF37',
    textAlign: 'center',
  },
});
