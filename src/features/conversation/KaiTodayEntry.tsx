// KAIROS — Home entry to the "Hoy" conversation.
//
// Honest-home rule: exactly ONE gold CTA on screen. When the day-0 first-
// workout hero is present it owns the gold, so this renders as a quiet
// companion row; once that hero retires (first session logged), the
// conversation entry takes over as the single gold hero.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import KaiOrb from '../onboarding/premium/KaiOrb';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';

interface Props {
  variant: 'hero' | 'quiet';
  onPress: () => void;
}

function KaiTodayEntry({ variant, onPress }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  if (variant === 'quiet') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pedirle otra cosa a Kai"
        onPress={handlePress}
        style={({ pressed }) => [styles.quietRow, pressed && { opacity: 0.8 }]}
      >
        <KaiOrb size={20} />
        <Text style={styles.quietText}>¿Otra cosa? Cuéntaselo a Kai.</Text>
        <Feather name="chevron-right" size={18} color={Colors.ink.muted} />
      </Pressable>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Contarle a Kai qué hacemos hoy"
        onPress={handlePress}
        style={({ pressed }) => [styles.heroCard, pressed && { opacity: 0.95 }]}
      >
        <View style={styles.heroTop}>
          <KaiOrb size={38} />
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>Hoy</Text>
            <Text style={styles.title}>¿Qué hacemos hoy?</Text>
            <Text style={styles.meta}>Cuéntaselo a Kai y te monta el bloque.</Text>
          </View>
        </View>
        <View style={styles.cta}>
          <Feather name="message-circle" size={16} color={Colors.ink.primary} />
          <Text style={styles.ctaText}>Cuéntaselo a Kai</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(KaiTodayEntry);

const styles = StyleSheet.create({
  // Hero — the single gold CTA of the home once day-0 retires.
  heroCard: {
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing['2xl'],
    borderRadius: Radius.xl,
    backgroundColor: Colors.bg.warm,
    borderWidth: 1,
    borderColor: Colors.hair.gold,
    gap: Spacing.lg,
    ...Shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
  meta: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  cta: {
    minHeight: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.cardWarm,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },

  // Quiet — companion row while the first-workout hero owns the gold.
  quietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.screen.horizontal,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    ...Shadows.subtle,
  },
  quietText: {
    ...Type.body,
    color: Colors.ink.secondary,
    flex: 1,
  },
});
