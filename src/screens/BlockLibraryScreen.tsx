// KAIROS — Block Library Screen
// Desktop-style grid of block icons (4 columns).
// Long-press + drag to reorder. Tap to open detail. FAB to create.

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import BlockAppIcon from '../components/BlockAppIcon';
import BlockCreationSheet, {
  type BlockCreationOptions,
} from '../components/BlockCreationSheet';
import BlockDetailModal from '../components/BlockDetailModal';

import type {
  WorkoutBlock as WorkoutBlockType,
  ExerciseCard as ExerciseCardType,
  FieldValue,
} from '../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';
import { useGamification } from '../context/GamificationContext';
import { useTree } from '../context/TreeContext';
import { useMission } from '../context/MissionContext';
import { useWorkoutStore } from '../store/workoutStore';
import KairosIcon from '../components/KairosIcon';

const COLUMNS = 4;
const SCREEN_W = Dimensions.get('window').width;
const H_PAD = Spacing.screen.horizontal;
const ICON_SLOT = Math.floor((SCREEN_W - H_PAD * 2) / COLUMNS);

// ======================== SCREEN ========================

export default function BlockLibraryScreen({ route }: any) {
  // ---- Store subscription (single source of truth) ----
  const blocks = useWorkoutStore((s) => s.blocks);
  const storeAddBlock = useWorkoutStore((s) => s.addBlock);
  const storeUpdateBlock = useWorkoutStore((s) => s.updateBlock);
  const storeDeleteBlock = useWorkoutStore((s) => s.deleteBlock);
  const storeReorderBlocks = useWorkoutStore((s) => s.reorderBlocks);
  const storeAddExercise = useWorkoutStore((s) => s.addExercise);
  const storeDeleteExercise = useWorkoutStore((s) => s.deleteExercise);
  const storeUpdateExercise = useWorkoutStore((s) => s.updateExercise);
  const storeUpdateSetValue = useWorkoutStore((s) => s.updateSetValue);
  const storeToggleSetComplete = useWorkoutStore((s) => s.toggleSetComplete);
  const storeAddSet = useWorkoutStore((s) => s.addSet);
  const storeRemoveSet = useWorkoutStore((s) => s.removeSet);

  const pendingHighlight = useWorkoutStore((s) => s.pendingHighlight);
  const clearHighlight = useWorkoutStore((s) => s.setHighlight);

  const [showCreation, setShowCreation] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const { streak, onSetCompleted, onBlockCreated, onMissionCompleted } = useGamification();
  const { onTreeSetCompleted, onTreePRCreated } = useTree();
  const { updateMissionProgress, recordPRForMission } = useMission();

  const highlightTargetId = route?.params?.highlightBlockId ?? pendingHighlight;
  const listRef = useRef<any>(null);

  // ---- Highlight scroll ----
  useEffect(() => {
    if (!highlightTargetId || blocks.length === 0) return;
    const idx = blocks.findIndex((b) => b.id === highlightTargetId);
    if (idx >= 0) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 0.3,
          });
        } catch {}
      }, 300);
    }
    const timer = setTimeout(() => clearHighlight(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightTargetId, blocks, clearHighlight]);

  const selectedBlock = useMemo(
    () =>
      selectedBlockId
        ? blocks.find((b) => b.id === selectedBlockId) ?? null
        : null,
    [selectedBlockId, blocks],
  );

  // ======================== BLOCK HANDLERS ========================

  const handleCreateBlock = useCallback(
    (opts: BlockCreationOptions) => {
      const id = storeAddBlock(opts.discipline, {
        name: opts.name,
        icon: opts.icon,
        color: opts.color,
        cover: opts.cover ?? undefined,
      });
      // Fire gamification check for block creation against the fresh state
      const next = useWorkoutStore.getState().blocks;
      onBlockCreated(next);
      // Surface highlight so the new block is visible
      if (id) clearHighlight(id);
    },
    [storeAddBlock, onBlockCreated, clearHighlight],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      Alert.alert('Eliminar bloque', '¿Seguro que quieres eliminar este bloque?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            storeDeleteBlock(blockId);
            setSelectedBlockId((id) => (id === blockId ? null : id));
          },
        },
      ]);
    },
    [storeDeleteBlock],
  );

  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<WorkoutBlockType>) => {
      storeUpdateBlock(blockId, updates);
    },
    [storeUpdateBlock],
  );

  const handleDragEnd = useCallback(
    (data: WorkoutBlockType[]) => {
      storeReorderBlocks(data);
    },
    [storeReorderBlocks],
  );

  // ======================== EXERCISE HANDLERS ========================

  const handleAddExercise = useCallback(
    (blockId: string) => {
      const block = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
      if (!block) return;
      storeAddExercise(blockId, { discipline: block.discipline });
    },
    [storeAddExercise],
  );

  const handleDeleteExercise = useCallback(
    (blockId: string, exerciseId: string) => {
      storeDeleteExercise(blockId, exerciseId);
    },
    [storeDeleteExercise],
  );

  const handleUpdateExercise = useCallback(
    (exerciseId: string, updates: Partial<ExerciseCardType>) => {
      const owner = useWorkoutStore
        .getState()
        .blocks.find((b) => b.exercises.some((ex) => ex.id === exerciseId));
      if (!owner) return;
      storeUpdateExercise(owner.id, exerciseId, updates);
    },
    [storeUpdateExercise],
  );

  // ======================== SET HANDLERS ========================

  const findBlockIdForExercise = useCallback((exerciseId: string): string | null => {
    const owner = useWorkoutStore
      .getState()
      .blocks.find((b) => b.exercises.some((ex) => ex.id === exerciseId));
    return owner?.id ?? null;
  }, []);

  const handleUpdateSetValue = useCallback(
    (exerciseId: string, setIndex: number, fieldId: string, value: FieldValue) => {
      const blockId = findBlockIdForExercise(exerciseId);
      if (!blockId) return;
      storeUpdateSetValue(blockId, exerciseId, setIndex, fieldId, value);
    },
    [findBlockIdForExercise, storeUpdateSetValue],
  );

  const handleToggleSetComplete = useCallback(
    (exerciseId: string, setIndex: number) => {
      const blockId = findBlockIdForExercise(exerciseId);
      if (!blockId) return;

      const toggled = storeToggleSetComplete(blockId, exerciseId, setIndex);
      if (!toggled || !toggled.wasCompleted) return;

      // Gamification pipeline — run against the freshly committed state
      const freshBlocks = useWorkoutStore.getState().blocks;
      onSetCompleted(toggled.exercise, toggled.set, freshBlocks).then(({ prCard }) => {
        onTreeSetCompleted(toggled.exercise, toggled.set);
        if (prCard) {
          onTreePRCreated();
          recordPRForMission();
        }
        updateMissionProgress(freshBlocks, streak).then((completed) => {
          if (completed) onMissionCompleted(freshBlocks);
        });
      });
    },
    [
      findBlockIdForExercise,
      storeToggleSetComplete,
      onSetCompleted,
      onTreeSetCompleted,
      onTreePRCreated,
      recordPRForMission,
      updateMissionProgress,
      onMissionCompleted,
      streak,
    ],
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      const blockId = findBlockIdForExercise(exerciseId);
      if (!blockId) return;
      storeAddSet(blockId, exerciseId);
    },
    [findBlockIdForExercise, storeAddSet],
  );

  const handleRemoveSet = useCallback(
    (exerciseId: string, setIndex: number) => {
      const blockId = findBlockIdForExercise(exerciseId);
      if (!blockId) return;
      storeRemoveSet(blockId, exerciseId, setIndex);
    },
    [findBlockIdForExercise, storeRemoveSet],
  );

  // ======================== FAB ========================

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  // ======================== RENDER ITEM ========================

  const renderItem = useCallback(
    ({ item, drag }: RenderItemParams<WorkoutBlockType>) => (
      <BlockAppIcon
        block={item}
        size={ICON_SLOT}
        onPress={(b) => setSelectedBlockId(b.id)}
        drag={drag}
        isHighlighted={item.id === highlightTargetId}
      />
    ),
    [highlightTargetId],
  );

  // ======================== MAIN RENDER ========================

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)} style={styles.header}>
        <View>
          <Text style={styles.brand}>Kairos</Text>
          <Text style={styles.subtitle}>
            {blocks.length === 0
              ? 'Tu biblioteca de bloques'
              : `${blocks.length} ${blocks.length === 1 ? 'bloque' : 'bloques'}`}
          </Text>
        </View>
      </Animated.View>

      {/* Grid or empty state */}
      {blocks.length > 0 ? (
        <DraggableFlatList<WorkoutBlockType>
          ref={listRef}
          data={blocks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => handleDragEnd(data)}
          numColumns={COLUMNS}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          activationDistance={8}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      ) : (
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <KairosIcon name="weightlifting" size={36} color={Colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>Sin bloques todavía</Text>
          <Text style={styles.emptyDesc}>
            Crea tu primer bloque de entrenamiento para empezar a construir tu biblioteca.
          </Text>
          <Pressable
            onPress={() => setShowCreation(true)}
            style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.emptyBtnText}>Crear primer bloque</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* FAB */}
      {blocks.length > 0 && (
        <Animated.View style={[styles.fab, fabStyle]}>
          <Pressable
            onPressIn={() => { fabScale.value = withSpring(0.88, { damping: 15 }); }}
            onPressOut={() => { fabScale.value = withSpring(1, { damping: 15 }); }}
            onPress={() => setShowCreation(true)}
            style={styles.fabInner}
          >
            <Text style={styles.fabIcon}>+</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Creation sheet */}
      <BlockCreationSheet
        visible={showCreation}
        onClose={() => setShowCreation(false)}
        onCreate={handleCreateBlock}
      />

      {/* Detail modal */}
      <BlockDetailModal
        block={selectedBlock}
        visible={selectedBlock !== null}
        onClose={() => setSelectedBlockId(null)}
        onUpdateSetValue={handleUpdateSetValue}
        onToggleSetComplete={handleToggleSetComplete}
        onAddSet={handleAddSet}
        onRemoveSet={handleRemoveSet}
        onUpdateExercise={handleUpdateExercise}
        onAddExercise={handleAddExercise}
        onUpdateBlock={handleUpdateBlock}
        onDeleteExercise={handleDeleteExercise}
      />
    </View>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },

  header: {
    paddingHorizontal: H_PAD,
    paddingTop: Spacing.screen.top,
    paddingBottom: Spacing.lg,
  },
  brand: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  gridContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: H_PAD * 2,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.subtle,
  },
  emptyTitle: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.size.body * 1.6,
    marginBottom: Spacing['2xl'],
  },
  emptyBtn: {
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius.sm,
    ...Shadows.subtle,
  },
  emptyBtnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 24,
    right: 24,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: Colors.text.inverse,
    lineHeight: 32,
    marginTop: -1,
  },
});
