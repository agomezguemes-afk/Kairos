// KAIROS — Welcome Screen v3
// Spec: §5.2 — token migration, serif wordmark, eyebrow tagline, idle pulse.
// Motion: entrance via Reanimated springs (not RN Animated), idle scale pulse.
// Gold CTA preserved — this is a "moment" screen.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KairosLogo from '../components/KairosLogo';
import { Colors, Type, Spacing, Radius, Shadows } from '../theme/tokens';
import { springs } from '../theme/animations';

const LOGO_SIZE = 80;

export default function WelcomeScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // ── Shared values ─────────────────────────────────────────────────────────
  const logoOp = useSharedValue(0);
  const logoY = useSharedValue(-20);
  const textOp = useSharedValue(0);
  const textY = useSharedValue(14);
  const btnsOp = useSharedValue(0);
  const btnsY = useSharedValue(16);
  const idleScale = useSharedValue(1);

  // ── Entrance + idle pulse ─────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion) {
      // Snap everything in without animation — respect accessibility.
      logoOp.value = 1;
      logoY.value = 0;
      textOp.value = 1;
      textY.value = 0;
      btnsOp.value = 1;
      btnsY.value = 0;
      return;
    }

    // Logo entrance
    logoOp.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) });
    logoY.value = withSpring(0, springs.gentle);

    // Wordmark + tagline
    textOp.value = withDelay(
      160,
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }),
    );
    textY.value = withDelay(160, withSpring(0, springs.gentle));

    // Buttons
    btnsOp.value = withDelay(
      300,
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }),
    );
    btnsY.value = withDelay(300, withSpring(0, springs.gentle));

    // Idle pulse after entrance
    idleScale.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(1.035, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(idleScale);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Button press scale ────────────────────────────────────────────────────
  const ctaScale = useSharedValue(1);
  const loginScale = useSharedValue(1);

  const pressIn = (sv: SharedValue<number>) => {
    sv.value = withSpring(0.96, springs.tap);
  };
  const pressOut = (sv: SharedValue<number>) => {
    sv.value = withSpring(1, springs.bouncy);
  };

  // ── Animated styles ───────────────────────────────────────────────────────
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value,
    transform: [{ translateY: logoY.value }, { scale: idleScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOp.value,
    transform: [{ translateY: textY.value }],
  }));
  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsOp.value,
    transform: [{ translateY: btnsY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));
  const loginStyle = useAnimatedStyle(() => ({ transform: [{ scale: loginScale.value }] }));

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
        <Animated.View style={[{ marginBottom: Spacing['2xl'] }, logoStyle]}>
          <KairosLogo size={LOGO_SIZE} />
        </Animated.View>

        {/* Wordmark + tagline */}
        <Animated.View style={[styles.brandBlock, textStyle]}>
          {/* Spec §5.2: serif title, not system sans */}
          <Text style={styles.appName}>Kairos</Text>
          {/* Spec §5.2: eyebrow-style uppercase tagline */}
          <Text style={styles.tagline}>THE TRAINING OS</Text>
        </Animated.View>
      </View>

      {/* ── Bottom CTAs ── */}
      <Animated.View style={[styles.footer, btnsStyle]}>
        {/* Primary CTA — gold (moment screen, per spec §4.4).
            Soft-wall: valor antes de cuenta — «Empezar» va directo al quiz. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Empezar"
          accessibilityHint="Comienza el cuestionario para crear tu espacio de entrenamiento"
          onPressIn={() => pressIn(ctaScale)}
          onPressOut={() => pressOut(ctaScale)}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            // TODO(integración): DEV-L debe registrar la ruta 'Onboarding' en el
            // stack pre-sesión (hoy solo existe en los stacks post-auth/local).
            navigation.navigate('Onboarding');
          }}
        >
          <Animated.View style={[styles.primaryBtn, ctaStyle]}>
            <Text style={styles.primaryBtnText}>Empezar</Text>
          </Animated.View>
        </Pressable>

        {/* Secondary — ghost style (spec §4.4: demote to ghost) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ya tengo cuenta"
          accessibilityHint="Abre el inicio de sesión"
          onPressIn={() => pressIn(loginScale)}
          onPressOut={() => pressOut(loginScale)}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            // Fix del bug: antes ambos CTAs navegaban a Auth sin modo y el
            // usuario de «Crear cuenta» aterrizaba en «Bienvenido de nuevo».
            navigation.navigate('Auth', { mode: 'signin' });
          }}
        >
          <Animated.View style={[styles.secondaryBtn, loginStyle]}>
            <Text style={styles.secondaryBtnText}>Ya tengo cuenta</Text>
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
    backgroundColor: Colors.bg.void,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen.horizontal + 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandBlock: {
    alignItems: 'center',
  },
  // Spec §5.2: Type.title (32px serif), letterSpacing -1.2 preserved.
  appName: {
    ...Type.title,
    color: Colors.ink.primary,
    letterSpacing: -1.2,
    marginBottom: 6,
  },
  // Spec §5.2: Type.eyebrow style — uppercase, tracked, gold-deep.
  tagline: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: 8,
  },
  primaryBtn: {
    width: 300,
    backgroundColor: Colors.gold.base,
    paddingVertical: Spacing.lg + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.card,
    shadowColor: Colors.gold.base,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.ink.primary,
  },
  secondaryBtn: {
    width: 300,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.hair.base,
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.ink.primary,
  },
  version: {
    fontSize: 11,
    color: Colors.ink.muted,
    marginTop: 4,
  },
});
