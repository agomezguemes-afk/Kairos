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
      <Text style={styles.eyebrow}>Tu bloque de hoy</Text>
      <View style={styles.titleRow}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <Text style={styles.title} numberOfLines={2}>
          {session.blockName}
        </Text>
      </View>

      <View style={styles.exercises}>
        {session.exercises.map((ex, i) => (
          <View key={`${i}-${ex.name}`} style={styles.exerciseRow}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {ex.name}
            </Text>
            {ex.detail.length > 0 ? <Text style={styles.exerciseDetail}>{ex.detail}</Text> : null}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Empezar ahora: ${session.blockName}`}
        onPress={onStart}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <KIcon name="zap" size={16} color={Colors.ink.primary} />
        <Text style={styles.ctaText}>Empezar ahora</Text>
      </Pressable>

      <View style={styles.secondaryRow}>
        <Pressable accessibilityRole="button" onPress={onView} hitSlop={8}>
          <Text style={styles.secondaryText}>Ver bloque</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAskAgain} hitSlop={8}>
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
    gap: Spacing.sm,
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
  },
  accentBar: {
    width: 4,
    height: 26,
    borderRadius: 2,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    flex: 1,
  },
  exercises: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
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
  },
  cta: {
    marginTop: Spacing.md,
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
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
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
