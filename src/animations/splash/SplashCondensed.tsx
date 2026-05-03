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
  withTiming,
} from 'react-native-reanimated';

import { EASE, VISUAL } from './choreography';
import { GoldBlock, GoldSphere, KairosWordmark } from './primitives';

const STAGE_SIZE = 400;
const CENTER = STAGE_SIZE / 2;
const GLYPH_CY = 155;       // glyph constellation center
const WORDMARK_CY = 270;    // wordmark baseline
const TAGLINE_CY = 308;     // tagline baseline

// Constellation layout — positions captured from the reference image (asymmetric).
// Each entry is an offset from (CENTER, GLYPH_CY).
const CONSTELLATION = [
  { type: 'square' as const, dx: -32, dy: -25, size: 17 },  // top-left
  { type: 'circle' as const, dx: 22, dy: 5, size: 22 },     // mid-right (largest)
  { type: 'square' as const, dx: -18, dy: 28, size: 19 },   // bottom-left
  { type: 'square' as const, dx: 38, dy: 35, size: 16 },    // bottom-right
];

const TOTAL_MS = 3000;
const STAGGER_MS = 220;
const SHAPE_FADE_MS = 600;
const WORDMARK_DELAY = 900;
const WORDMARK_FADE_MS = 600;
const TAGLINE_DELAY = 1200;
const TAGLINE_FADE_MS = 500;
const BREATH_START = 1900;
const EXIT_START = 2700;
const EXIT_MS = 300;

interface SplashCondensedProps {
  onDone: () => void;
}

export default function SplashCondensed({ onDone }: SplashCondensedProps) {
  const rootOpacity = useSharedValue(1);

  // Per-shape state — opacity + scale + glow
  const o0 = useSharedValue(0);
  const o1 = useSharedValue(0);
  const o2 = useSharedValue(0);
  const o3 = useSharedValue(0);
  const shapeOpacities = [o0, o1, o2, o3];

  const s0 = useSharedValue(0.7);
  const s1 = useSharedValue(0.7);
  const s2 = useSharedValue(0.7);
  const s3 = useSharedValue(0.7);
  const shapeScales = [s0, s1, s2, s3];

  const g0 = useSharedValue(0);
  const g1 = useSharedValue(0);
  const g2 = useSharedValue(0);
  const g3 = useSharedValue(0);
  const shapeGlows = [g0, g1, g2, g3];

  // Static positions per constellation entry — not animated
  const xVals = CONSTELLATION.map((c) => useSharedValue(CENTER + c.dx));
  const yVals = CONSTELLATION.map((c) => useSharedValue(GLYPH_CY + c.dy));
  const rotations = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  // Wordmark + tagline group
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkScale = useSharedValue(1.0);
  const taglineOpacity = useSharedValue(0);

  // For KairosWordmark, all letters reveal at once via the group opacity
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

    // ── Phase 1: shapes appear with stagger ────────────────────────────
    Haptics.selectionAsync().catch(() => {});
    CONSTELLATION.forEach((_, i) => {
      t(i * STAGGER_MS, () => {
        shapeOpacities[i].value = withTiming(1, { duration: SHAPE_FADE_MS, easing: EASE.decelerate });
        shapeScales[i].value = withTiming(1, { duration: SHAPE_FADE_MS, easing: EASE.decelerate });
        shapeGlows[i].value = withTiming(0.55, { duration: SHAPE_FADE_MS + 200, easing: EASE.decelerate });
      });
    });

    // ── Phase 2: wordmark fades in ─────────────────────────────────────
    t(WORDMARK_DELAY, () => {
      wordmarkOpacity.value = withTiming(1, { duration: WORDMARK_FADE_MS, easing: EASE.primary });
    });

    // ── Phase 3: tagline fades in ──────────────────────────────────────
    t(TAGLINE_DELAY, () => {
      taglineOpacity.value = withTiming(1, { duration: TAGLINE_FADE_MS, easing: EASE.primary });
    });

    // ── Phase 4: breathing ─────────────────────────────────────────────
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
        {CONSTELLATION.map((c, i) =>
          c.type === 'circle' ? (
            <GoldSphere
              key={`shape-${i}`}
              x={xVals[i]}
              y={yVals[i]}
              scale={shapeScales[i]}
              opacity={shapeOpacities[i]}
              glow={shapeGlows[i]}
              size={c.size}
            />
          ) : (
            <GoldBlock
              key={`shape-${i}`}
              x={xVals[i]}
              y={yVals[i]}
              rotation={rotations[i]}
              scale={shapeScales[i]}
              opacity={shapeOpacities[i]}
              glow={shapeGlows[i]}
              size={c.size}
            />
          ),
        )}

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
