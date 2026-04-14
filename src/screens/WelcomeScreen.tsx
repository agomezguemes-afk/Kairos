// KAIROS — Welcome Screen
// Minimalist first screen with app name, tagline, and two CTAs.
// Shown only when the user has not completed onboarding.

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

export default function WelcomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // Button animations (RN Animated — lightweight, no worklet needed here)
  const ctaScale = useRef(new Animated.Value(1)).current;
  const loginScale = useRef(new Animated.Value(1)).current;

  const springDown = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 0.96, useNativeDriver: true, friction: 6, tension: 60 }).start();
  const springUp = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 50 }).start();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Centered branding */}
      <View style={styles.center}>
        {/* Logo mark */}
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>K</Text>
        </View>

        <Text style={styles.appName}>Kairos</Text>
        <Text style={styles.tagline}>The Training OS</Text>
      </View>

      {/* Bottom CTAs */}
      <View style={styles.footer}>
        <Pressable
          onPressIn={() => springDown(ctaScale)}
          onPressOut={() => springUp(ctaScale)}
          onPress={() => navigation.navigate('Auth')}
        >
          <Animated.View style={[styles.primaryBtn, { transform: [{ scale: ctaScale }] }]}>
            <Text style={styles.primaryBtnText}>Crear cuenta</Text>
          </Animated.View>
        </Pressable>

        <Pressable
          onPressIn={() => springDown(loginScale)}
          onPressOut={() => springUp(loginScale)}
          onPress={() => navigation.navigate('Auth')}
        >
          <Animated.View style={[styles.secondaryBtn, { transform: [{ scale: loginScale }] }]}>
            <Text style={styles.secondaryBtnText}>Iniciar sesi&#243;n</Text>
          </Animated.View>
        </Pressable>

        <Text style={styles.version}>v1.0.0 · Beta</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen.horizontal + 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.elevated,
    shadowColor: Colors.accent.primary,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: Typography.weight.bold,
    color: Colors.text.inverse,
    marginTop: -2,
  },
  appName: {
    fontSize: 44,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -1,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
    gap: Spacing.md,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.lg + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    minWidth: 280,
    ...Shadows.card,
    shadowColor: Colors.accent.primary,
  },
  primaryBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    minWidth: 280,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
  },
  secondaryBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },
  version: {
    fontSize: Typography.size.micro,
    color: Colors.text.disabled,
    marginTop: Spacing.sm,
  },
});
