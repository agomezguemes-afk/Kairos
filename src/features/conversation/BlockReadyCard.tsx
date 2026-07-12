// KAIROS — The block-ready moment of the "Hoy" conversation.
//
// When Kai finishes building, the session materialises as a card inside the
// chat: name, exercise preview, and ONE gold CTA ("Empezar ahora"). Secondary
// paths (see the block / ask for something else) stay quiet so the moment has
// a single obvious next step. Success haptic on mount — the block landing is
// the payoff of the whole conversation.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon from '../../components/icons/KIcon';
import type { BuiltSession } from '../../lib/ai/conversation';
import { Animation, Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';

interface Props {
  session: BuiltSession;
  onStart: () => void;
  onView: () => void;
  onAskAgain: () => void;
}

function BlockReadyCard({ session, onStart, onView, onAskAgain }: Props) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const accent = Colors.discipline[session.discipline] ?? Colors.gold.base;

  return (
    <Animated.View
      entering={FadeInDown.springify()
        .damping(Animation.spring.gentle.damping)
        .stiffness(Animation.spring.gentle.stiffness)}
      style={styles.card}
    >
      <Text style={styles.eyebrow} accessibilityRole="header">
        Tu bloque de hoy
      </Text>
      <View style={styles.titleRow}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <Text style={styles.title} numberOfLines={3}>
          {session.blockName}
        </Text>
      </View>

      <View style={styles.exercises}>
        {session.exercises.map((ex, i) => (
          <View
            key={`${i}-${ex.name}`}
            style={styles.exerciseRow}
            accessible
            accessibilityLabel={ex.detail.length > 0 ? `${ex.name}, ${ex.detail}` : ex.name}
          >
            <Text style={styles.exerciseName} numberOfLines={2}>
              {ex.name}
            </Text>
            {ex.detail.length > 0 ? (
              <Text style={styles.exerciseDetail} maxFontSizeMultiplier={1.6}>
                {ex.detail}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Empezar ahora: ${session.blockName}`}
        accessibilityHint="Abre el workout y empieza a registrar"
        onPress={onStart}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <KIcon name="zap" size={16} color={Colors.ink.primary} />
        <Text style={styles.ctaText} maxFontSizeMultiplier={1.5}>
          Empezar ahora
        </Text>
      </Pressable>

      <View style={styles.secondaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver bloque"
          accessibilityHint="Abre el detalle del bloque sin empezar"
          onPress={onView}
          hitSlop={8}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryText}>Ver bloque</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pedir otra cosa"
          accessibilityHint="Descarta este bloque y empieza otra conversación"
          onPress={onAskAgain}
          hitSlop={8}
          style={styles.secondaryBtn}
        >
          <Text style={styles.mutedText}>Pedir otra cosa</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default React.memo(BlockReadyCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.hair.gold,
    padding: Spacing.xl,
    marginTop: Spacing.sm,
    ...Shadows.card,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  accentBar: {
    width: 4, // decorative discipline bar — sized in px, not a spacing rhythm
    height: 26,
    borderRadius: 2,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    flex: 1,
  },
  exercises: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  // flex-start (not baseline) so a wrapped, Dynamic-Type-scaled name keeps its
  // detail top-aligned instead of drifting off the baseline.
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  exerciseName: {
    ...Type.body,
    color: Colors.ink.secondary,
    flexShrink: 1,
  },
  exerciseDetail: {
    ...Type.caption,
    color: Colors.ink.muted,
    flexShrink: 0,
  },
  cta: {
    marginTop: Spacing.xl,
    minHeight: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    ...Shadows.cardWarm,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.md,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm,
  },
  secondaryText: {
    ...Type.caption,
    color: Colors.ink.secondary,
  },
  mutedText: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
});
