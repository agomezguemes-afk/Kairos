// src/animations/splash/SplashCondensed.tsx
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { EASE, SPRING, VISUAL } from './choreography';
import { GoldBlock, GoldSphere, KairosWordmark } from './primitives';

const STAGE_SIZE = 400;
const CENTER = STAGE_SIZE / 2;
const GLYPH_CY = 155;       // glyph constellation center
const WORDMARK_CY = 270;
const TAGLINE_CY = 308;

// Sphere is the gravitational center — appears first, satellites emanate from it.
const SPHERE = { dx: 14, dy: 0, size: 26 };

// Three squares emanate outward to form the constellation.
const SATELLITES = [
  { dx: -32, dy: -28, size: 18 },  // top-left
  { dx: -22, dy: 30, size: 22 },   // bottom-left (largest)
  { dx: 38, dy: 36, size: 16 },    // bottom-right
];

const SPHERE_FADE_MS = 480;
const SATELLITE_BIRTH_DELAY = 320;   // sphere has 320ms alone before satellites are born
const SATELLITE_STAGGER_MS = 180;
const SATELLITE_TRAVEL_MS = 720;
const SATELLITE_FADE_IN_MS = 320;
const WORDMARK_DELAY = 1280;
const WORDMARK_FADE_MS = 700;
const TAGLINE_DELAY = 1620;
const TAGLINE_FADE_MS = 600;
const BREATH_START = 2350;
const EXIT_START = 3000;
const EXIT_MS = 380;

interface SplashCondensedProps {
  onDone: () => void;
}

export default function SplashCondensed({ onDone }: SplashCondensedProps) {
  const rootOpacity = useSharedValue(1);

  // ── Sphere (the gravitational center) ──────────────────────────────
  const sphereCx = CENTER + SPHERE.dx;
  const sphereCy = GLYPH_CY + SPHERE.dy;
  const sphereX = useSharedValue(sphereCx);
  const sphereY = useSharedValue(sphereCy);
  const sphereScale = useSharedValue(0.4);
  const sphereOpacity = useSharedValue(0);
  const sphereGlow = useSharedValue(0);

  // ── Satellites — start at sphere position, travel to their slots ──
  const sx0 = useSharedValue(sphereCx);
  const sy0 = useSharedValue(sphereCy);
  const sx1 = useSharedValue(sphereCx);
  const sy1 = useSharedValue(sphereCy);
  const sx2 = useSharedValue(sphereCx);
  const sy2 = useSharedValue(sphereCy);
  const satelliteX = [sx0, sx1, sx2];
  const satelliteY = [sy0, sy1, sy2];

  const satOp0 = useSharedValue(0);
  const satOp1 = useSharedValue(0);
  const satOp2 = useSharedValue(0);
  const satelliteOpacities = [satOp0, satOp1, satOp2];

  const satScale0 = useSharedValue(0.3);
  const satScale1 = useSharedValue(0.3);
  const satScale2 = useSharedValue(0.3);
  const satelliteScales = [satScale0, satScale1, satScale2];

  const satGlow0 = useSharedValue(0);
  const satGlow1 = useSharedValue(0);
  const satGlow2 = useSharedValue(0);
  const satelliteGlows = [satGlow0, satGlow1, satGlow2];

  const satRot0 = useSharedValue(0);
  const satRot1 = useSharedValue(0);
  const satRot2 = useSharedValue(0);
  const satelliteRotations = [satRot0, satRot1, satRot2];

  // ── Wordmark + tagline ─────────────────────────────────────────────
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkScale = useSharedValue(1.0);
  const taglineOpacity = useSharedValue(0);

  // KairosWordmark expects 6 reveal SVs — we hold them at 1 since we control
  // visibility via the group opacity instead.
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

    // ── Sphere appears alone first ─────────────────────────────────────
    Haptics.selectionAsync().catch(() => {});
    sphereOpacity.value = withTiming(1, { duration: SPHERE_FADE_MS, easing: EASE.decelerate });
    sphereScale.value = withTiming(1, { duration: SPHERE_FADE_MS, easing: EASE.decelerate });
    sphereGlow.value = withTiming(0.65, {
      duration: SPHERE_FADE_MS + 200,
      easing: EASE.decelerate,
    });

    // ── Satellites emanate from the sphere center ──────────────────────
    SATELLITES.forEach((s, i) => {
      const targetX = CENTER + s.dx;
      const targetY = GLYPH_CY + s.dy;

      t(SATELLITE_BIRTH_DELAY + i * SATELLITE_STAGGER_MS, () => {
        // Brief fade-in while still at sphere center
        satelliteOpacities[i].value = withTiming(1, { duration: SATELLITE_FADE_IN_MS, easing: EASE.decelerate });
        satelliteScales[i].value = withTiming(1, { duration: SATELLITE_FADE_IN_MS + 80, easing: EASE.decelerate });

        // Spring outward — gives the emanation a soft, organic settle
        satelliteX[i].value = withSpring(targetX, { ...SPRING.block, mass: 0.9 });
        satelliteY[i].value = withSpring(targetY, { ...SPRING.block, mass: 0.9 });

        // Subtle rotation while traveling — degrees vary so motion isn't uniform
        const targetRot = ((i % 2 === 0 ? 1 : -1) * (4 + i * 2) * Math.PI) / 180;
        satelliteRotations[i].value = withTiming(targetRot, {
          duration: SATELLITE_TRAVEL_MS,
          easing: EASE.decelerate,
        });

        // Glow trails the body, peaking after arrival
        satelliteGlows[i].value = withTiming(0.55, {
          duration: SATELLITE_TRAVEL_MS,
          easing: EASE.decelerate,
        });
      });
    });

    // ── Wordmark + tagline ─────────────────────────────────────────────
    t(WORDMARK_DELAY, () => {
      wordmarkOpacity.value = withTiming(1, { duration: WORDMARK_FADE_MS, easing: EASE.primary });
    });

    t(TAGLINE_DELAY, () => {
      taglineOpacity.value = withTiming(1, { duration: TAGLINE_FADE_MS, easing: EASE.primary });
    });

    // ── Breathing on the wordmark ──────────────────────────────────────
    t(BREATH_START, () => {
      Haptics.selectionAsync().catch(() => {});
      wordmarkScale.value = withRepeat(
        withSequence(
          withTiming(1 + VISUAL.breathScaleDelta, {
            duration: VISUAL.breathDuration / 2,
            easing: EASE.meditative,
          }),
          withTiming(1, {
            duration: VISUAL.breathDuration / 2,
            easing: EASE.meditative,
          }),
        ),
        -1,
        false,
      );
    });

    // ── Exit ───────────────────────────────────────────────────────────
    t(EXIT_START, () => {
      rootOpacity.value = withTiming(0, { duration: EXIT_MS, easing: EASE.accelerate }, (finished) => {
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
        <GoldSphere
          x={sphereX}
          y={sphereY}
          scale={sphereScale}
          opacity={sphereOpacity}
          glow={sphereGlow}
          size={SPHERE.size}
        />

        {SATELLITES.map((s, i) => (
          <GoldBlock
            key={`sat-${i}`}
            x={satelliteX[i]}
            y={satelliteY[i]}
            rotation={satelliteRotations[i]}
            scale={satelliteScales[i]}
            opacity={satelliteOpacities[i]}
            glow={satelliteGlows[i]}
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
          style={[
            styles.taglineWrap,
            { top: TAGLINE_CY - 10 },
            taglineStyle,
          ]}
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
