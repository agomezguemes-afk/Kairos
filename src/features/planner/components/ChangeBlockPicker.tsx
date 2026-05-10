// src/features/planner/components/ChangeBlockPicker.tsx
// Modal sheet: pick a different block for a single occurrence. For recurring
// series this mints a OneTime replacement and skips the original date —
// scheduleStore.changeOccurrenceBlock handles that branching.

import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useScheduleStore } from '../../../store/scheduleStore';
import { DISCIPLINE_CONFIGS } from '../../../types/core';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  date: ISODate | null;
  onClose: () => void;
}

export default function ChangeBlockPicker({ visible, assignmentId, date, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // Subscribe to the raw array (stable reference). Filtering inside the
  // selector returns a new array each render → useSyncExternalStore detects
  // it as a change → infinite loop ("getSnapshot should be cached").
  const allBlocks = useWorkoutStore((s) => s.blocks);
  const blocks = useMemo(() => allBlocks.filter((b) => !b.is_archived), [allBlocks]);
  const change = useScheduleStore((s) => s.changeOccurrenceBlock);

  if (!assignmentId || !date) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Cambiar bloque</Text>
          <Text style={styles.subtitle}>Solo cambia este día — la serie sigue intacta.</Text>

          <FlatList
            data={blocks}
            keyExtractor={(b) => b.id}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            ListEmptyComponent={() => (
              <Text style={styles.emptyHint}>
                Crea un bloque primero desde la pestaña Bloques.
              </Text>
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { change(assignmentId, date, item.id); onClose(); }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <View style={[styles.swatch, { backgroundColor: item.color || Colors.gold.glow }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {DISCIPLINE_CONFIGS[item.discipline]?.name ?? item.discipline}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    ...Shadows.card,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  title: {
    ...Type.title,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.ink.primary,
    marginBottom: 2,
  },
  subtitle: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
  },
  name: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  meta: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
  emptyHint: {
    ...Type.body,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
