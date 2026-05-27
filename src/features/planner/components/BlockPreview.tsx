// src/features/planner/components/BlockPreview.tsx
// Compact list of up to N exercises + "+N más" overflow line, plus an optional
// "Ver bloque completo" link. Pulls exercises via getBlockExercises (which
// walks ContentNode[] — WorkoutBlock has no flat .exercises field).
//
// `subdued` makes the labels recede (ink.tertiary) — used inside DayCard
// where the preview is secondary information beneath the hero block name.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Type, Spacing } from '../../../theme/tokens';
import KIcon from '../../../components/icons/KIcon';
import type { WorkoutBlock } from '../../../types/core';
import { getBlockExercises } from '../../../types/core';

interface Props {
  block: WorkoutBlock;
  onSeeFull?: () => void;
  maxItems?: number;
  subdued?: boolean;
}

export default function BlockPreview({ block, onSeeFull, maxItems = 4, subdued = false }: Props) {
  const exercises = getBlockExercises(block);
  const visible = exercises.slice(0, maxItems);
  const overflow = exercises.length - visible.length;

  const labelColor = subdued ? Colors.ink.tertiary : Colors.ink.secondary;
  const iconColor = subdued ? Colors.ink.muted : Colors.ink.tertiary;

  return (
    <View style={styles.container}>
      {visible.map((ex) => (
        <View key={ex.id} style={styles.row}>
          <KIcon name="barbell" size={14} color={iconColor} />
          <Text style={[styles.name, { color: labelColor }]} numberOfLines={1}>
            {ex.name}
          </Text>
        </View>
      ))}
      {overflow > 0 && <Text style={styles.overflow}>+ {overflow} más</Text>}
      {onSeeFull && exercises.length > 0 && (
        <Pressable
          onPress={onSeeFull}
          accessibilityRole="button"
          accessibilityLabel="Ver bloque completo"
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={styles.fullLink}>Ver bloque completo →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    ...Type.caption,
    flex: 1,
  },
  overflow: {
    ...Type.micro,
    color: Colors.gold.deep,
    marginTop: 2,
  },
  fullLink: {
    ...Type.micro,
    color: Colors.gold.deep,
    marginTop: Spacing.sm,
  },
});
