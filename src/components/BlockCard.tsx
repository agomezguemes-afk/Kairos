// KAIROS — BlockCard
// Compact card shown in the library. Swipe left to reveal delete action.

import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { WorkoutBlock } from '../types/core';
import { calculateBlockStats, DISCIPLINE_CONFIGS } from '../types/core';
import KairosIcon from './KairosIcon';
import { Colors, Typography, Spacing, Radius } from '../theme/index';

// ======================== DELETE ACTION ========================

const DeleteAction: React.FC<{
  progress: SharedValue<number>;
  onDelete: () => void;
}> = React.memo(({ progress, onDelete }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.7, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));

  return (
    <Animated.View style={[styles.deleteWrap, animStyle]}>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
      >
        <KairosIcon name="trash" size={20} color={Colors.text.inverse} />
        <Text style={styles.deleteLabel}>Eliminar</Text>
      </Pressable>
    </Animated.View>
  );
});

DeleteAction.displayName = 'DeleteAction';

// ======================== BLOCK CARD ========================

export interface BlockCardProps {
  block: WorkoutBlock;
  onPress: (block: WorkoutBlock) => void;
  onDelete: (blockId: string) => void;
}

const BlockCardComponent: React.FC<BlockCardProps> = ({ block, onPress, onDelete }) => {
  const swipeRef = useRef<SwipeableMethods>(null);
  const scale = useSharedValue(1);

  const stats = useMemo(() => calculateBlockStats(block), [block]);
  const config = DISCIPLINE_CONFIGS[block.discipline];
  const pct = stats.completion_percentage;

  const handleDelete = useCallback(() => {
    swipeRef.current?.close();
    Alert.alert(
      'Eliminar bloque',
      `¿Seguro que quieres eliminar "${block.name}"?\nSe borrarán todos sus ejercicios y series.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(block.id),
        },
      ]
    );
  }, [block.id, block.name, onDelete]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 300 });
  }, [scale]);

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <DeleteAction progress={progress} onDelete={handleDelete} />
    ),
    [handleDelete]
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={60}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={() => onPress(block)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: `${block.color}0A`,
                borderColor: `${block.color}22`,
                shadowColor: block.color,
              },
            ]}
          >
            {/* Color stripe */}
            <View style={[styles.stripe, { backgroundColor: block.color }]} />

            <View style={styles.body}>
              {/* Icon */}
              <View style={[styles.iconWrap, { backgroundColor: `${block.color}25` }]}>
                <Text style={styles.iconText}>{block.icon}</Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {block.name}
                </Text>
                <Text style={styles.meta}>
                  {config.icon} {config.name}
                  {'  ·  '}
                  {stats.total_exercises}{' '}
                  {stats.total_exercises === 1 ? 'ejercicio' : 'ejercicios'}
                  {stats.estimated_duration > 0
                    ? `  ·  ~${stats.estimated_duration}m`
                    : ''}
                </Text>

                {stats.total_sets > 0 && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pct}%`,
                            backgroundColor:
                              pct >= 100 ? Colors.semantic.success : block.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressPct}>{pct}%</Text>
                  </View>
                )}
              </View>

              {/* Arrow */}
              <Text style={styles.arrow}>›</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </ReanimatedSwipeable>
  );
};

export const BlockCard = React.memo(BlockCardComponent);

// ======================== STYLES ========================

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  stripe: { height: 3, width: '100%' },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 22 },
  info: { flex: 1 },
  name: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginBottom: 3,
  },
  meta: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginBottom: 5,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.border.subtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressPct: {
    fontSize: 10,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
    minWidth: 28,
    textAlign: 'right',
  },
  arrow: { fontSize: 22, color: Colors.text.tertiary, marginLeft: 2 },

  // Delete action
  deleteWrap: {
    width: 80,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: Colors.semantic.error,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteBtnPressed: { opacity: 0.8 },
  deleteIcon: { fontSize: 20, marginBottom: 3 },
  deleteLabel: {
    fontSize: 11,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
});
