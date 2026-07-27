// src/features/planner/components/AssignBlockSheet.tsx
// Single-screen tile grid for assigning a block to a date.
// - Tap tile  → assignOnce + close sheet.
// - Long-press tile → inline recurrence overlay (presets + advanced inline).
// No 4-step wizard, no nested sheets. Mirrors the visual identity of
// BlocksScreen so the user lands in familiar territory.

import React, { useMemo, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useScheduleStore } from '../../../store/scheduleStore';
import { todayISO, formatLongDate } from '../lib/dates';
import RecurrenceOverlay from './RecurrenceOverlay';
import KIcon from '../../../components/icons/KIcon';
import { DISCIPLINE_CONFIGS, type Discipline, type WorkoutBlock } from '../../../types/core';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  initialDate?: ISODate;
  onClose: () => void;
}

const SCREEN_W = Dimensions.get('window').width;
const COLUMNS = 3;
const H_PAD = Spacing.screen.horizontal;
const TILE_GAP = Spacing.sm;
// Width of one tile: screen minus side padding minus inter-tile gaps.
const TILE_SIZE = Math.floor((SCREEN_W - H_PAD * 2 - TILE_GAP * (COLUMNS - 1)) / COLUMNS);

function disciplineColor(d: Discipline): string {
  return Colors.discipline[d] ?? Colors.gold.base;
}

export default function AssignBlockSheet({ visible, initialDate, onClose }: Props) {
  const insets = useSafeAreaInsets();

  // Subscribe to the raw array (stable reference). Filter in useMemo so the
  // selector doesn't return a new array on every render — that would trip
  // useSyncExternalStore's getSnapshot caching and infinite-loop the screen.
  const allBlocks = useWorkoutStore((s) => s.blocks);
  const blocks = useMemo(() => allBlocks.filter((b) => !b.is_archived), [allBlocks]);
  const assignOnce = useScheduleStore((s) => s.assignOnce);

  const date = initialDate ?? todayISO();
  const [recurrenceFor, setRecurrenceFor] = useState<WorkoutBlock | null>(null);

  const close = useCallback(() => {
    setRecurrenceFor(null);
    onClose();
  }, [onClose]);

  const handleTap = useCallback(
    (block: WorkoutBlock) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      assignOnce(date, block.id);
      close();
    },
    [assignOnce, date, close],
  );

  const handleLongPress = useCallback((block: WorkoutBlock) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRecurrenceFor(block);
  }, []);

  const renderTile = useCallback(
    ({ item, index }: ListRenderItemInfo<WorkoutBlock>) => (
      <BlockTile
        block={item}
        // Rightmost column doesn't get right margin — keeps the row flush.
        isLastInRow={(index + 1) % COLUMNS === 0}
        onTap={() => handleTap(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [handleTap, handleLongPress],
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />

          <View style={styles.headerBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {`Asignar a ${formatLongDate(date)}`}
            </Text>
            <Text style={styles.hint}>Mantén pulsado un bloque para repetirlo.</Text>
          </View>

          {blocks.length === 0 ? (
            <EmptyHint />
          ) : (
            <FlatList
              data={blocks}
              keyExtractor={(b) => b.id}
              numColumns={COLUMNS}
              renderItem={renderTile}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {recurrenceFor && (
            <RecurrenceOverlay
              block={recurrenceFor}
              startDate={date}
              onDone={close}
              onCancel={() => setRecurrenceFor(null)}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

interface TileProps {
  block: WorkoutBlock;
  isLastInRow: boolean;
  onTap: () => void;
  onLongPress: () => void;
}

const BlockTile = React.memo(function BlockTile({
  block,
  isLastInRow,
  onTap,
  onLongPress,
}: TileProps) {
  const color = disciplineColor(block.discipline);
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={block.name}
      accessibilityHint="Toca para asignar, mantén pulsado para repetir"
      style={({ pressed }) => [
        styles.tile,
        !isLastInRow && { marginRight: TILE_GAP },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.tileStripe, { backgroundColor: color }]} />
      <View style={styles.tileContent}>
        <View style={[styles.tileSwatch, { backgroundColor: color }]} />
        <Text style={styles.tileName} numberOfLines={2}>
          {block.name}
        </Text>
        <Text style={styles.tileMeta} numberOfLines={1}>
          {DISCIPLINE_CONFIGS[block.discipline]?.name ?? block.discipline}
        </Text>
      </View>
    </Pressable>
  );
});

function EmptyHint() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <KIcon name="grid" size={22} color={Colors.gold.deep} />
      </View>
      <Text style={styles.emptyTitle}>Sin bloques</Text>
      <Text style={styles.emptyBody}>
        Crea tu primer bloque desde la pestaña Bloques para empezar a planificar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.paper.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: H_PAD,
    maxHeight: '88%',
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  headerBlock: {
    paddingBottom: Spacing.md,
  },
  title: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    textTransform: 'capitalize',
  },
  hint: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
  gridContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  // FlatList row wrapper. Items declare their own right gap so we can omit
  // it on the last column without a brittle modulus check inside flexbox.
  columnWrapper: {
    marginBottom: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    aspectRatio: 1,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  tileStripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  tileContent: {
    flex: 1,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingLeft: Spacing.md + 2, // +2 to clear the 3pt stripe
    paddingRight: Spacing.sm,
    justifyContent: 'space-between',
  },
  tileSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  tileName: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    marginTop: Spacing.sm,
  },
  tileMeta: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 4,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    ...Type.body,
    color: Colors.ink.tertiary,
    textAlign: 'center',
  },
});
