// First-workout hero card. Mounts only while workoutHistory is empty — the
// single most important CTA in the activation funnel. Disappears forever
// after the first logged session.

import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon from '../../../components/icons/KIcon';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { getBlockExercises, type WorkoutBlock } from '../../../types/core';

interface Props {
  block: WorkoutBlock;
  onStart: (block: WorkoutBlock) => void;
}

function FirstWorkoutCTA({ block, onStart }: Props) {
  const exerciseCount = getBlockExercises(block).length;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onStart(block);
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
      <Text style={styles.eyebrow}>Tu primer entrenamiento</Text>
      <Text style={styles.title} numberOfLines={2}>
        {block.name}
      </Text>
      <Text style={styles.meta}>
        {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · listo para empezar
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Empezar primer entrenamiento: ${block.name}`}
        onPress={handlePress}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <KIcon name="zap" size={16} color={Colors.ink.primary} />
        <Text style={styles.ctaText}>Empezar ahora</Text>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(FirstWorkoutCTA);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing['2xl'],
    borderRadius: Radius.xl,
    backgroundColor: Colors.bg.warm,
    borderWidth: 1,
    borderColor: Colors.hair.gold,
    gap: Spacing.xs,
    ...Shadows.card,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    marginTop: 2,
  },
  meta: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  cta: {
    marginTop: Spacing.lg,
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
});
