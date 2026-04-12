// KAIROS — Block Library Screen
// Desktop-style grid of block icons (4 columns).
// Long-press + drag to reorder. Tap to open detail. FAB to create.

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import BlockAppIcon from '../components/BlockAppIcon';
import BlockCreationSheet, {
  type BlockCreationOptions,
} from '../components/BlockCreationSheet';
import BlockDetailModal from '../components/BlockDetailModal';

import type {
  WorkoutBlock as WorkoutBlockType,
  ExerciseCard as ExerciseCardType,
  ExerciseSet,
  FieldValue,
} from '../types/core';
import {
  createWorkoutBlock,
  createExerciseCard,
  createEmptySet,
} from '../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';
import { useGamification } from '../context/GamificationContext';

const STORAGE_KEY = 'kairos_blocks_v1';
const MOCK_USER_ID = 'user_001';

const COLUMNS = 4;
const SCREEN_W = Dimensions.get('window').width;
const H_PAD = Spacing.screen.horizontal;
const ICON_SLOT = Math.floor((SCREEN_W - H_PAD * 2) / COLUMNS);

// ======================== SCREEN ========================

export default function BlockLibraryScreen() {
  const [blocks, setBlocks] = useState<WorkoutBlockType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreation, setShowCreation] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const { onSetCompleted, onBlockCreated } = useGamification();

  const selectedBlock = useMemo(
    () =>
      selectedBlockId
        ? blocks.find((b) => b.id === selectedBlockId) ?? null
        : null,
    [selectedBlockId, blocks],
  );

  // ======================== PERSISTENCE ========================

  const saveBlocks = useCallback(async (updated: WorkoutBlockType[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Kairos: Error saving blocks', e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: WorkoutBlockType[] = JSON.parse(raw);
          setBlocks(parsed);
        }
      } catch (e) {
        console.warn('Kairos: Error loading blocks', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const updateBlocks = useCallback(
    (updater: (prev: WorkoutBlockType[]) => WorkoutBlockType[]) => {
      setBlocks((prev) => {
        const next = updater(prev);
        saveBlocks(next);
        return next;
      });
    },
    [saveBlocks],
  );

  // ======================== BLOCK HANDLERS ========================

  const handleCreateBlock = useCallback(
    (opts: BlockCreationOptions) => {
      const newBlock = createWorkoutBlock(
        MOCK_USER_ID,
        blocks.length,
        opts.discipline,
        { name: opts.name, icon: opts.icon, color: opts.color },
      );
      const blockWithCover: WorkoutBlockType = { ...newBlock, cover: opts.cover };
      updateBlocks((prev) => {
        const updated = [...prev, blockWithCover];
        // Fire gamification check for block creation
        onBlockCreated(updated);
        return updated;
      });
    },
    [blocks.length, updateBlocks, onBlockCreated],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      Alert.alert('Eliminar bloque', '¿Seguro que quieres eliminar este bloque?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            updateBlocks((prev) => prev.filter((b) => b.id !== blockId));
            setSelectedBlockId((id) => (id === blockId ? null : id));
          },
        },
      ]);
    },
    [updateBlocks],
  );

  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<WorkoutBlockType>) => {
      updateBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, ...updates, updated_at: new Date().toISOString() }
            : b,
        ),
      );
    },
    [updateBlocks],
  );

  const handleDragEnd = useCallback(
    (data: WorkoutBlockType[]) => {
      setBlocks(data);
      saveBlocks(data);
    },
    [saveBlocks],
  );

  // ======================== EXERCISE HANDLERS ========================

  const handleAddExercise = useCallback(
    (blockId: string) => {
      updateBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== blockId) return block;
          const ex = createExerciseCard(
            blockId,
            block.exercises.length,
            block.discipline,
          );
          return {
            ...block,
            exercises: [...block.exercises, ex],
            updated_at: new Date().toISOString(),
          };
        }),
      );
    },
    [updateBlocks],
  );

  const handleDeleteExercise = useCallback(
    (blockId: string, exerciseId: string) => {
      updateBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== blockId) return block;
          return {
            ...block,
            exercises: block.exercises.filter((ex) => ex.id !== exerciseId),
            updated_at: new Date().toISOString(),
          };
        }),
      );
    },
    [updateBlocks],
  );

  const handleUpdateExercise = useCallback(
    (exerciseId: string, updates: Partial<ExerciseCardType>) => {
      updateBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          exercises: block.exercises.map((ex) =>
            ex.id === exerciseId
              ? { ...ex, ...updates, updated_at: new Date().toISOString() }
              : ex,
          ),
        })),
      );
    },
    [updateBlocks],
  );

  // ======================== SET HANDLERS ========================

  const handleUpdateSetValue = useCallback(
    (exerciseId: string, setIndex: number, fieldId: string, value: FieldValue) => {
      updateBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          exercises: block.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const newSets = [...ex.sets];
            newSets[setIndex] = {
              ...newSets[setIndex],
              values: { ...newSets[setIndex].values, [fieldId]: value },
            };
            return { ...ex, sets: newSets, updated_at: new Date().toISOString() };
          }),
        })),
      );
    },
    [updateBlocks],
  );

  const handleToggleSetComplete = useCallback(
    (exerciseId: string, setIndex: number) => {
      updateBlocks((prev) => {
        const updated = prev.map((block) => ({
          ...block,
          exercises: block.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const newSets = [...ex.sets];
            const s = newSets[setIndex];
            newSets[setIndex] = {
              ...s,
              completed: !s.completed,
              completed_at: !s.completed ? new Date().toISOString() : null,
            };
            return { ...ex, sets: newSets, updated_at: new Date().toISOString() };
          }),
        }));

        // Gamification: if set was just completed (toggled ON), check streak/badges/PR
        const wasCompleted = prev.some((b) =>
          b.exercises.some((ex) =>
            ex.id === exerciseId && ex.sets[setIndex] && !ex.sets[setIndex].completed,
          ),
        );
        if (wasCompleted) {
          // Find the exercise and the newly completed set
          for (const block of updated) {
            const ex = block.exercises.find((e) => e.id === exerciseId);
            if (ex) {
              onSetCompleted(ex, ex.sets[setIndex], updated);
              break;
            }
          }
        }

        return updated;
      });
    },
    [updateBlocks, onSetCompleted],
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      updateBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          exercises: block.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const newSet = createEmptySet(exerciseId, ex.sets.length, ex.fields);
            return {
              ...ex,
              sets: [...ex.sets, newSet],
              updated_at: new Date().toISOString(),
            };
          }),
        })),
      );
    },
    [updateBlocks],
  );

  const handleRemoveSet = useCallback(
    (exerciseId: string, setIndex: number) => {
      updateBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          exercises: block.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const filtered = ex.sets.filter((_, i) => i !== setIndex);
            const reordered: ExerciseSet[] = filtered.map((s, i) => ({
              ...s,
              order: i,
            }));
            return { ...ex, sets: reordered, updated_at: new Date().toISOString() };
          }),
        })),
      );
    },
    [updateBlocks],
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
      />
    ),
    [],
  );

  // ======================== LOADING ========================

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={Colors.accent.primary} />
      </View>
    );
  }

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
            <Text style={{ fontSize: 36 }}>🏋️</Text>
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
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.background.void,
    alignItems: 'center',
    justifyContent: 'center',
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
