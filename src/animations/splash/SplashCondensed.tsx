// src/animations/splash/SplashCondensed.tsx
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { CONDENSED, EASE, VISUAL } from './choreography';
import { GoldSphere, KairosWordmark } from './primitives';

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;

interface SplashCondensedProps {
  onDone: () => void;
}

export default function SplashCondensed({ onDone }: SplashCondensedProps) {
  // root
  const rootOpacity = useSharedValue(1);

  // sphere
  const sphereScale = useSharedValue(0.7);
  const sphereOpacity = useSharedValue(0);
  const sphereGlow = useSharedValue(0);

  // wordmark group
  const wordmarkScale = useSharedValue(1.0);
  const wordmarkOpacity = useSharedValue(0);

  // per-letter reveal
  const r0 = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const r3 = useSharedValue(0);
  const r4 = useSharedValue(0);
  const r5 = useSharedValue(0);
  const reveals = [r0, r1, r2, r3, r4, r5];

  useEffect(() => {
    // ── Phase 1: Origin ───────────────────────────────────────────────
    Haptics.selectionAsync().catch(() => {});
    sphereOpacity.value = withTiming(1, { duration: CONDENSED.origin.duration, easing: EASE.decelerate });
    sphereScale.value = withTiming(1.0, { duration: CONDENSED.origin.duration, easing: EASE.decelerate });
    sphereGlow.value = withDelay(
      CONDENSED.origin.duration - 200,
      withTiming(0.4, { duration: 200, easing: EASE.decelerate }),
    );

    // ── Phase 2: Compressed arc — sphere fades while wordmark begins ──
    sphereGlow.value = withDelay(
      CONDENSED.compressedArc.start,
      withTiming(0, { duration: CONDENSED.compressedArc.duration / 2, easing: EASE.accelerate }),
    );
    sphereOpacity.value = withDelay(
      CONDENSED.compressedArc.start + 400,
      withTiming(0, { duration: 400, easing: EASE.accelerate }),
    );
    sphereScale.value = withDelay(
      CONDENSED.compressedArc.start + 400,
      withTiming(0.5, { duration: 400, easing: EASE.accelerate }),
    );

    // ── Phase 3: Mutation — wordmark group fades in, letters stagger ──
    wordmarkOpacity.value = withDelay(
      CONDENSED.mutation.start,
      withTiming(1, { duration: 400, easing: EASE.primary }),
    );

    reveals.forEach((reveal, i) => {
      reveal.value = withDelay(
        CONDENSED.mutation.start + i * CONDENSED.mutation.staggerMs,
        withTiming(1, { duration: 600, easing: EASE.primary }),
      );
    });

    // Haptic at S complete
    setTimeout(() => {
      Haptics.selectionAsync().catch(() => {});
    }, CONDENSED.hapticBeats[1]);

    // ── Phase 4: Final state — subtle breathing ───────────────────────
    wordmarkScale.value = withDelay(
      CONDENSED.finalState.start,
      withRepeat(
        withSequence(
          withTiming(1 + VISUAL.breathScaleDelta, { duration: VISUAL.breathDuration / 2, easing: EASE.meditative }),
          withTiming(1, { duration: VISUAL.breathDuration / 2, easing: EASE.meditative }),
        ),
        -1,
        false,
      ),
    );

    // ── Exit ──────────────────────────────────────────────────────────
    rootOpacity.value = withDelay(
      CONDENSED.exit.start,
      withTiming(0, { duration: CONDENSED.exit.duration, easing: EASE.accelerate }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [onDone, sphereScale, sphereOpacity, sphereGlow, wordmarkScale, wordmarkOpacity, r0, r1, r2, r3, r4, r5, rootOpacity]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
        <GoldSphere
          cx={CENTER}
          cy={CENTER}
          scale={sphereScale}
          opacity={sphereOpacity}
          glow={sphereGlow}
        />
        <KairosWordmark
          cx={CENTER}
          cy={CENTER}
          letterReveals={reveals}
          scale={wordmarkScale}
          opacity={wordmarkOpacity}
        />
      </Svg>
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
});
