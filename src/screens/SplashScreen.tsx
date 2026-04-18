// KAIROS — Splash Screen
// Shown while the app initialises. Gold glow pulse, then a fade-up exit.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Typography } from '../theme/index';
import { timings } from '../theme/animations';

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  // ── animation values ──────────────────────────────────────────
  const logoScale   = useSharedValue(0.82);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale   = useSharedValue(0.8);
  const rootOpacity = useSharedValue(1);

  // ── sequence ──────────────────────────────────────────────────
  useEffect(() => {
    // 1. Fade + scale in the logo
    logoOpacity.value = withTiming(1, { duration: 420 });
    logoScale.value   = withTiming(1, { duration: 420 });

    // 2. Glow pulse (2 repeats)
    glowOpacity.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 550 }),
          withTiming(0.15, { duration: 550 }),
        ),
        2,
        true,
      ),
    );
    glowScale.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: 550 }),
          withTiming(0.95, { duration: 550 }),
        ),
        2,
        true,
      ),
    );

    // 3. After ~2s, fade out the entire splash and call onDone
    rootOpacity.value = withDelay(2000, withTiming(0, { duration: 380 }, (finished) => {
      if (finished) runOnJS(onDone)();
    }));
  }, []);

  const rootStyle  = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const logoStyle  = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle  = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <Animated.View style={[styles.glowRing, glowStyle]} />

      <Animated.View style={logoStyle}>
        {/* Letter-mark */}
        <View style={styles.logoCircle}>
          <Text style={styles.logoLetter}>K</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.wordmark, logoStyle]}>
        <Text style={styles.brand}>KAIROS</Text>
        <Text style={styles.tagline}>Your training OS</Text>
      </Animated.View>
    </Animated.View>
  );
}

const CIRCLE_SIZE = 88;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.void,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glowRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 48,
    height: CIRCLE_SIZE + 48,
    borderRadius: (CIRCLE_SIZE + 48) / 2,
    backgroundColor: Colors.accent.light,
  },
  logoCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  logoLetter: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: 1,
  },
  wordmark: {
    marginTop: 24,
    alignItems: 'center',
  },
  brand: {
    fontSize: Typography.size.subheading,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
