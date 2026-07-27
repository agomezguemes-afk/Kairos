// First-workout hero card. Mounts only while workoutHistory is empty — the
// single most important CTA in the activation funnel. Disappears forever
// after the first logged session.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import KIcon from '../../../components/icons/KIcon';
import PressableScale from '../../../components/PressableScale';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { getBlockExercises, type WorkoutBlock } from '../../../types/core';

interface Props {
  block: WorkoutBlock;
  onStart: (block: WorkoutBlock) => void;
}

function FirstWorkoutCTA({ block, onStart }: Props) {
  const exerciseCount = getBlockExercises(block).length;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
      <Text style={styles.eyebrow}>Tu primer entrenamiento</Text>
      <Text style={styles.title} numberOfLines={2}>
        {block.name}
      </Text>
      <Text style={styles.meta}>
        {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · listo para empezar
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Empezar primer entrenamiento: ${block.name}`}
        onPress={() => onStart(block)}
        haptic="medium"
        style={styles.cta}
      >
        <KIcon name="zap" size={16} color={Colors.ink.inverse} />
        <Text style={styles.ctaText}>Empezar ahora</Text>
      </PressableScale>
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
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.paper.warm,
    gap: Spacing.xs,
    ...Shadows.none,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.tertiary,
  },
  // Letterpress: on a warm surface the title sinks into the fibre (§3f). Only
  // valid ≥22pt — titleSmall is exactly 22.
  title: {
    ...Type.titleSmall,
    ...Type.letterpress,
    color: Colors.ink.primary,
    marginTop: 2,
  },
  meta: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  // Primary action = dark ink pill (gold is reserved for the Kai orb).
  cta: {
    marginTop: Spacing.lg,
    minHeight: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
  },
});
