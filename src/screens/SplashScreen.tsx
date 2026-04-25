// KAIROS — Splash Screen (v2)
// Cinematic sequence:
//  1. Screen fades in (150ms)
//  2. Logo mark springs up with overshoot
//  3. K strokes draw on (vertical bar → both arms → shimmer)
//  4. "KAIROS" letters stagger-fade in below the mark
//  5. Tagline slides up and fades in
//  6. Short hold, then full-screen fade-out → onDone()

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated } from 'react-native';
import KairosLogo from '../components/KairosLogo';
import { Colors, Typography } from '../theme/index';

interface SplashScreenProps {
  onDone: () => void;
}

const LETTERS = ['K', 'A', 'I', 'R', 'O', 'S'];
const LETTER_STAGGER = 72; // ms between each letter
const LOGO_SIZE = 92;

export default function SplashScreen({ onDone }: SplashScreenProps) {
  // ── Container ────────────────────────────────────────────────────────────
  const screenOp   = useRef(new RNAnimated.Value(0)).current;  // initial fade-in
  const rootOp     = useRef(new RNAnimated.Value(1)).current;  // exit fade-out
  const logoScale  = useRef(new RNAnimated.Value(0.72)).current;
  const logoOp     = useRef(new RNAnimated.Value(0)).current;

  // ── Wordmark — per-letter ────────────────────────────────────────────────
  const letterOpacities = useRef(
    LETTERS.map(() => new RNAnimated.Value(0)),
  ).current;
  const letterTranslates = useRef(
    LETTERS.map(() => new RNAnimated.Value(10)),
  ).current;

  // ── Tagline ──────────────────────────────────────────────────────────────
  const taglineOp = useRef(new RNAnimated.Value(0)).current;
  const taglineY  = useRef(new RNAnimated.Value(8)).current;

  // ── Phase 3: tagline → hold → exit ──────────────────────────────────────
  const showTaglineAndExit = useCallback(() => {
    RNAnimated.sequence([
      RNAnimated.parallel([
        RNAnimated.timing(taglineOp, { toValue: 1, duration: 320, useNativeDriver: true }),
        RNAnimated.timing(taglineY,  { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      RNAnimated.delay(700),
      RNAnimated.timing(rootOp, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  // ── Phase 2: stagger letters, then tagline ───────────────────────────────
  const animateWordmark = useCallback(() => {
    RNAnimated.stagger(
      LETTER_STAGGER,
      LETTERS.map((_, i) =>
        RNAnimated.parallel([
          RNAnimated.timing(letterOpacities[i], {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          RNAnimated.timing(letterTranslates[i], {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start(() => showTaglineAndExit());
  }, []);

  // ── Phase 1: screen in + logo spring ────────────────────────────────────
  useEffect(() => {
    // Screen fades in immediately
    RNAnimated.timing(screenOp, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    // Logo pops in with spring overshoot
    RNAnimated.parallel([
      RNAnimated.timing(logoOp, { toValue: 1, duration: 220, useNativeDriver: true }),
      RNAnimated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 55,
      }),
    ]).start();
    // KairosLogo's draw animation is triggered by animate=true + onReady=animateWordmark
  }, []);

  return (
    <RNAnimated.View style={[styles.root, { opacity: screenOp }]}>
      <RNAnimated.View style={{ opacity: rootOp }}>
        <View style={styles.center}>

          {/* Logo mark — animates its K strokes internally */}
          <RNAnimated.View
            style={{
              opacity: logoOp,
              transform: [{ scale: logoScale }],
              marginBottom: 32,
            }}
          >
            <KairosLogo
              size={LOGO_SIZE}
              animate
              delay={180}
              onReady={animateWordmark}
            />
          </RNAnimated.View>

          {/* KAIROS — letter-by-letter */}
          <View style={styles.wordmarkRow}>
            {LETTERS.map((letter, i) => (
              <RNAnimated.Text
                key={letter + i}
                style={[
                  styles.brandLetter,
                  {
                    opacity: letterOpacities[i],
                    transform: [{ translateY: letterTranslates[i] }],
                  },
                ]}
              >
                {letter}
              </RNAnimated.Text>
            ))}
          </View>

          {/* Tagline */}
          <RNAnimated.Text
            style={[
              styles.tagline,
              {
                opacity: taglineOp,
                transform: [{ translateY: taglineY }],
              },
            ]}
          >
            THE TRAINING OS
          </RNAnimated.Text>

        </View>
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.void,
    zIndex: 999,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Slight upward bias so wordmark reads as centred visually
    paddingBottom: 24,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  brandLetter: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    letterSpacing: 0,
    lineHeight: 36,
  },
  tagline: {
    marginTop: 10,
    fontSize: Typography.size.micro,
    fontWeight: '500' as const,
    color: Colors.text.tertiary,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
});
