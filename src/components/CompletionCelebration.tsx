// KAIROS — Block completion celebration
// Full-screen modal that appears when every set in a block is ticked off.
// Shows stats, confetti burst, success haptic.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import ConfettiBurst, { type ConfettiRef } from './ConfettiParticles';
import KairosIcon from './KairosIcon';
import type { WorkoutBlock } from '../types/core';
import { getBlockExercises } from '../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';
import { springs } from '../theme/animations';

// ======================== STATS HELPER ========================

function blockStats(block: WorkoutBlock) {
  let totalSets = 0;
  let completedSets = 0;
  let totalVolume = 0;
  const exercises = getBlockExercises(block);

  for (const ex of exercises) {
    for (const set of ex.sets) {
      totalSets++;
      if (set.completed) completedSets++;

      const weightField = ex.fields.find((f) => f.unit === 'kg');
      const repsField   = ex.fields.find((f) => f.name.toLowerCase().includes('rep'));
      if (weightField && repsField) {
        const w = Number(set.values[weightField.id] ?? 0);
        const r = Number(set.values[repsField.id]   ?? 0);
        if (w > 0 && r > 0 && set.completed) totalVolume += w * r;
      }
    }
  }

  return { totalSets, completedSets, totalVolume, exerciseCount: exercises.length };
}

// ======================== COMPONENT ========================

interface Props {
  block: WorkoutBlock | null;
  onDismiss: () => void;
}

export default function CompletionCelebration({ block, onDismiss }: Props) {
  const confettiRef = useRef<ConfettiRef | null>(null);
  const cardScale   = useSharedValue(0.7);
  const cardOpacity = useSharedValue(0);

  const stats = block ? blockStats(block) : null;

  useEffect(() => {
    if (!block) return;

    // Haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Card entrance
    cardScale.value   = withSpring(1, springs.bouncy);
    cardOpacity.value = withTiming(1, { duration: 280 });

    // Confetti after a tiny delay
    const t = setTimeout(() => confettiRef.current?.burst(), 180);
    return () => clearTimeout(t);
  }, [block]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  if (!block) return null;

  return (
    <Modal
      visible={!!block}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        {/* Confetti layer */}
        <ConfettiBurst confettiRef={confettiRef} />

        {/* Card */}
        <Animated.View style={[styles.card, cardStyle]}>
          {/* Gold trophy */}
          <View style={styles.trophyRing}>
            <KairosIcon name="trophy" size={36} color={Colors.accent.primary} />
          </View>

          <Text style={styles.headline}>¡Bloque completado!</Text>
          <Text style={styles.blockName}>{block.name}</Text>

          {/* Stats row */}
          {stats && (
            <Animated.View
              entering={FadeIn.delay(300).duration(350)}
              style={styles.statsRow}
            >
              <StatPill label="Series" value={`${stats.completedSets}`} icon="checkmark" />
              <StatPill label="Ejercicios" value={`${stats?.exerciseCount ?? 0}`} icon="dumbbell" />
              {stats.totalVolume > 0 && (
                <StatPill label="Volumen" value={`${Math.round(stats.totalVolume)} kg`} icon="stats" />
              )}
            </Animated.View>
          )}

          {/* Encouragement */}
          <Text style={styles.encouragement}>
            ¡Sigue así, cada sesión cuenta!
          </Text>

          {/* Dismiss */}
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.btnText}>Cerrar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statPill}>
      <KairosIcon name={icon} size={16} color={Colors.accent.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: Dimensions.get('window').width - 48,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    ...Shadows.modal,
  },
  trophyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.accent.dim,
    borderWidth: 1.5,
    borderColor: Colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  headline: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  blockName: {
    fontSize: Typography.size.body,
    color: Colors.text.tertiary,
    marginTop: 4,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statPill: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
  encouragement: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    fontStyle: 'italic',
  },
  btn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['3xl'],
  },
  btnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },
});
