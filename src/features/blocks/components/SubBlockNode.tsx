import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { SubBlockContentNode } from '../../../types/content';
import { useWorkoutStore } from '../../../store/workoutStore';
import { calculateBlockStats } from '../../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface SubBlockNodeProps {
  node: SubBlockContentNode;
  onNavigate: (blockId: string) => void;
  onDelete: (nodeId: string) => void;
}

function SubBlockNodeInner({ node, onNavigate, onDelete }: SubBlockNodeProps) {
  const subBlock = useWorkoutStore(
    React.useCallback((s) => s.blocks.find(b => b.id === node.data.blockId), [node.data.blockId]),
  );

  if (!subBlock) {
    return (
      <View style={[styles.card, styles.missing]}>
        <Feather name="alert-circle" size={16} color={Colors.text.disabled} />
        <Text style={styles.missingText}>Sub-bloque eliminado</Text>
        <Pressable onPress={() => onDelete(node.id)} hitSlop={8}>
          <Feather name="x" size={16} color={Colors.text.disabled} />
        </Pressable>
      </View>
    );
  }

  const stats = calculateBlockStats(subBlock);
  const color = subBlock.color || Colors.accent.primary;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onNavigate(subBlock.id);
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.strip, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Feather name="layers" size={16} color={color} />
          <Text style={styles.name} numberOfLines={1}>{subBlock.name}</Text>
          <Feather name="chevron-right" size={16} color={Colors.text.tertiary} />
        </View>
        {stats.total_exercises > 0 && (
          <Text style={styles.meta}>
            {stats.total_exercises} ejercicios · {stats.completed_sets}/{stats.total_sets} series
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default React.memo(SubBlockNodeInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.warm,
    overflow: 'hidden',
    minWidth: 0,
    ...Shadows.subtle,
  },
  strip: {
    width: 3,
  },
  content: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  meta: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 4,
    marginLeft: 24,
  },
  missing: {
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  missingText: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.text.disabled,
    fontStyle: 'italic',
  },
});
