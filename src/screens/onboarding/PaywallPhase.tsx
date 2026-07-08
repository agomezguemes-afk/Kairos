// KAIROS — Paywall fake-door beta (U4)
// «Kairos Pro — gratis durante la beta»: mide intención sin cobrar nada.
// Los eventos paywall_viewed/paywall_dismissed los emite el padre.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { Colors, Type, Spacing, Radius, Shadows, Animation } from '../../theme/tokens';

const PRO_FEATURES = [
  'Generación de espacios con IA',
  'Kai, tu copiloto de entrenamiento',
  'Análisis de progreso sin límites',
];

interface PaywallPhaseProps {
  reduceMotion: boolean;
  onContinue: () => void;
}

export default function PaywallPhase({ reduceMotion, onContinue }: PaywallPhaseProps) {
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(Animation.duration.normal)}
          style={styles.headerBlock}
        >
          <Text style={styles.eyebrow}>KAIROS PRO</Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.5}>
            Gratis durante la beta
          </Text>
          <Text style={styles.subtitle}>
            Todo Kairos Pro está incluido mientras construimos esto contigo.
          </Text>
        </Animated.View>

        <Animated.View
          entering={
            reduceMotion ? undefined : FadeInDown.delay(120).duration(Animation.duration.normal)
          }
          style={styles.featureCard}
        >
          {PRO_FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Feather name="check" size={16} color={Colors.gold.base} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View
        entering={
          reduceMotion ? undefined : FadeInDown.delay(200).duration(Animation.duration.normal)
        }
        style={styles.footer}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuar"
          accessibilityHint="Entra en tu espacio de entrenamiento"
          onPress={onContinue}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressedDim]}
        >
          <Text style={styles.primaryText}>Continuar</Text>
        </Pressable>
        <Text style={styles.footnote}>Sin pagos ni suscripciones durante la beta.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing['2xl'],
  },
  headerBlock: {
    gap: Spacing.sm,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  title: {
    ...Type.title,
    color: Colors.ink.primary,
  },
  subtitle: {
    ...Type.body,
    color: Colors.ink.tertiary,
  },
  featureCard: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureText: {
    ...Type.body,
    color: Colors.ink.primary,
    flexShrink: 1,
  },
  footer: {
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: Radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold.base,
    ...Shadows.card,
    shadowColor: Colors.gold.base,
  },
  primaryText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
  },
  footnote: {
    ...Type.micro,
    color: Colors.ink.muted,
  },
  pressedDim: {
    opacity: 0.92,
  },
});
