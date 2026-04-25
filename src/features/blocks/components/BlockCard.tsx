import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats } from '../../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';
import { springs } from '../../../theme/animations';

interface BlockCardProps {
  block: WorkoutBlock;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
  isHighlighted?: boolean;
}

function BlockCardInner({ block, index, onPress, onLongPress, isHighlighted }: BlockCardProps) {
  const scale = useSharedValue(1);
  const highlightOpacity = useSharedValue(0);

  const stats = React.useMemo(() => calculateBlockStats(block), [block]);

  React.useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withRepeat(
        withSequence(
          withTiming(0.15, { duration: 400 }),
          withTiming(0, { duration: 400 }),
        ),
        3,
        false,
      );
    }
  }, [isHighlighted]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
  }));

  const pct = stats.completion_percentage;
  const hasExercises = stats.total_exercises > 0;
  const disciplineColor = block.color || Colors.accent.primary;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(300).springify().damping(18)}
      style={styles.cardWrapper}
    >
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, springs.tap); }}
        onPressOut={() => { scale.value = withSpring(1, springs.bouncy); }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onLongPress();
        }}
        delayLongPress={400}
      >
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          {/* Highlight overlay */}
          <Animated.View
            style={[styles.highlightOverlay, highlightStyle, { backgroundColor: Colors.accent.primary }]}
            pointerEvents="none"
          />

          {/* Discipline color strip */}
          <View style={[styles.colorStrip, { backgroundColor: disciplineColor }]} />

          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: disciplineColor + '18' }]}>
              <Text style={styles.iconEmoji}>
                {block.icon === 'strength' || block.icon === 'weightlifting' ? '\u{1F4AA}' :
                 block.icon === 'running' ? '\u{1F3C3}' :
                 block.icon === 'calisthenics' ? '\u{1F938}' :
                 block.icon === 'mobility' ? '\u{1F9D8}' :
                 block.icon === 'cycling' ? '\u{1F6B4}' :
                 block.icon === 'swimming' ? '\u{1F3CA}' :
                 block.icon === 'team_sport' ? '\u{26BD}' : '\u{1F3CB}'}
              </Text>
            </View>
            {block.is_favorite && (
              <Feather name="star" size={14} color={Colors.accent.primary} />
            )}
          </View>

          {/* Name */}
          <Text style={styles.blockName} numberOfLines={2}>
            {block.name}
          </Text>

          {/* Stats */}
          {hasExercises ? (
            <View style={styles.statsRow}>
              <Text style={styles.statText}>
                {stats.total_exercises} ej · {stats.total_sets} series
              </Text>
              {stats.estimated_duration > 0 && (
                <Text style={styles.statDuration}>~{stats.estimated_duration}m</Text>
              )}
            </View>
          ) : (
            <Text style={styles.emptyHint}>Sin ejercicios</Text>
          )}

          {/* Progress bar */}
          {hasExercises && stats.total_sets > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%` as `${number}%`,
                    backgroundColor: pct === 100 ? Colors.semantic.success : disciplineColor,
                  },
                ]}
              />
            </View>
          )}

          {/* Status badge */}
          {block.status !== 'draft' && (
            <View style={[
              styles.statusBadge,
              block.status === 'completed' && { backgroundColor: Colors.semantic.successMuted },
              block.status === 'in_progress' && { backgroundColor: Colors.accent.muted },
            ]}>
              <Text style={[
                styles.statusText,
                block.status === 'completed' && { color: Colors.semantic.success },
                block.status === 'in_progress' && { color: Colors.accent.primary },
              ]}>
                {block.status === 'completed' ? 'Completado' :
                 block.status === 'in_progress' ? 'En progreso' :
                 block.status === 'partial' ? 'Parcial' : ''}
              </Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(BlockCardInner);

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    padding: Spacing.gap.cards / 2,
  },
  card: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border.light,
    overflow: 'hidden',
    minHeight: 150,
    ...Shadows.card,
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.lg,
  },
  colorStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  blockName: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    lineHeight: Typography.size.body * Typography.lineHeight.tight,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statText: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
  statDuration: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
  emptyHint: {
    fontSize: Typography.size.micro,
    color: Colors.text.disabled,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.background.elevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xs,
  },
  statusText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.medium,
  },
});
