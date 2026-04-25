// KAIROS — Welcome Screen (v2)
// Consistent KairosLogo mark (static, no draw animation here).
// Entrance: logo slides down + fades in, text staggers below.
// Idle: mark breathes with a very subtle scale pulse.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KairosLogo from '../components/KairosLogo';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

const LOGO_SIZE = 80;

export default function WelcomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // ── Entrance animations ───────────────────────────────────────────────────
  const logoOp      = useRef(new Animated.Value(0)).current;
  const logoY       = useRef(new Animated.Value(-20)).current;
  const textOp      = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(14)).current;
  const buttonsOp   = useRef(new Animated.Value(0)).current;
  const buttonsY    = useRef(new Animated.Value(16)).current;

  // ── Idle pulse on the logo mark ───────────────────────────────────────────
  const idleScale = useRef(new Animated.Value(1)).current;

  // ── Button press feedback ─────────────────────────────────────────────────
  const ctaScale   = useRef(new Animated.Value(1)).current;
  const loginScale = useRef(new Animated.Value(1)).current;

  const pressIn  = (v: Animated.Value) =>
    Animated.spring(v, { toValue: 0.96, useNativeDriver: true, friction: 6, tension: 60 }).start();
  const pressOut = (v: Animated.Value) =>
    Animated.spring(v, { toValue: 1,    useNativeDriver: true, friction: 4, tension: 50 }).start();

  useEffect(() => {
    // 1. Logo entrance
    Animated.parallel([
      Animated.timing(logoOp, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.spring(logoY,  { toValue: 0, useNativeDriver: true, friction: 7, tension: 50 }),
    ]).start();

    // 2. Wordmark + tagline entrance (slight delay after logo)
    Animated.sequence([
      Animated.delay(160),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(textY,  { toValue: 0, useNativeDriver: true, friction: 7, tension: 50 }),
      ]),
    ]).start();

    // 3. Buttons entrance
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(buttonsOp, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(buttonsY,  { toValue: 0, useNativeDriver: true, friction: 7, tension: 50 }),
      ]),
    ]).start();

    // 4. Idle pulse (starts after entrance)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(idleScale, {
          toValue: 1.035,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(idleScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseTimeout = setTimeout(() => pulse.start(), 700);

    return () => {
      clearTimeout(pulseTimeout);
      pulse.stop();
    };
  }, []);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) },
      ]}
    >
      {/* ── Centred branding ── */}
      <View style={styles.center}>

        {/* Logo mark */}
        <Animated.View
          style={{
            opacity: logoOp,
            transform: [{ translateY: logoY }, { scale: idleScale }],
            marginBottom: Spacing['2xl'],
          }}
        >
          <KairosLogo size={LOGO_SIZE} animate={false} />
        </Animated.View>

        {/* Wordmark + tagline */}
        <Animated.View
          style={{
            opacity: textOp,
            transform: [{ translateY: textY }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.appName}>Kairos</Text>
          <Text style={styles.tagline}>The Training OS</Text>
        </Animated.View>

      </View>

      {/* ── Bottom CTAs ── */}
      <Animated.View
        style={[
          styles.footer,
          { opacity: buttonsOp, transform: [{ translateY: buttonsY }] },
        ]}
      >
        <Pressable
          onPressIn={() => pressIn(ctaScale)}
          onPressOut={() => pressOut(ctaScale)}
          onPress={() => navigation.navigate('Auth')}
        >
          <Animated.View
            style={[styles.primaryBtn, { transform: [{ scale: ctaScale }] }]}
          >
            <Text style={styles.primaryBtnText}>Crear cuenta</Text>
          </Animated.View>
        </Pressable>

        <Pressable
          onPressIn={() => pressIn(loginScale)}
          onPressOut={() => pressOut(loginScale)}
          onPress={() => navigation.navigate('Auth')}
        >
          <Animated.View
            style={[styles.secondaryBtn, { transform: [{ scale: loginScale }] }]}
          >
            <Text style={styles.secondaryBtnText}>Iniciar sesión</Text>
          </Animated.View>
        </Pressable>

        <Text style={styles.version}>v1.0.0 · Beta</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen.horizontal + 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 46,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    letterSpacing: -1.2,
    marginBottom: 6,
  },
  tagline: {
    fontSize: Typography.size.subheading,
    fontWeight: '400' as const,
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: 8,
  },
  primaryBtn: {
    width: 300,
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.lg + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.card,
    shadowColor: Colors.accent.primary,
  },
  primaryBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: '600' as const,
    color: Colors.text.inverse,
  },
  secondaryBtn: {
    width: 300,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
  },
  secondaryBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: '500' as const,
    color: Colors.text.primary,
  },
  version: {
    fontSize: Typography.size.micro,
    color: Colors.text.disabled,
    marginTop: 4,
  },
});
