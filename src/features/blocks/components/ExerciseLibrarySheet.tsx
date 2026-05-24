// src/features/blocks/components/ExerciseLibrarySheet.tsx
// Bottom-sheet exercise picker. Surfaces the static EXERCISE_LIBRARY,
// filtered by a horizontal muscle-group rail and a free-text search.
// Tap a row → calls store.addExerciseFromLibrary and closes the sheet.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
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
import {
  EXERCISE_LIBRARY,
  libraryByMuscleGroup,
  type ExerciseLibraryEntry,
} from '../../../data/exerciseLibrary';
import {
  MUSCLE_GROUP_CONFIGS,
  type Discipline,
  type MuscleGroup,
} from '../../../types/core';

type FilterId = 'todos' | 'piernas' | MuscleGroup;
interface FilterDef {
  id: FilterId;
  label: string;
}

// Filter rail. "Piernas" is a virtual aggregate of the lower-region muscles.
const FILTERS: FilterDef[] = [
  { id: 'todos',     label: 'Todos' },
  { id: 'chest',     label: 'Pecho' },
  { id: 'back',      label: 'Espalda' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'piernas',   label: 'Piernas' },
  { id: 'core',      label: 'Core' },
  { id: 'cardio_engine', label: 'Cardio' },
  { id: 'mobility',  label: 'Movilidad' },
];

const LEG_GROUPS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

function disciplineColor(d: Discipline): string {
  return Colors.discipline[d] ?? Colors.gold.base;
}

function muscleLabels(groups: MuscleGroup[]): string {
  return groups
    .map((g) => MUSCLE_GROUP_CONFIGS[g]?.label ?? g)
    .join(' · ');
}

interface Props {
  visible: boolean;
  blockId: string;
  onClose: () => void;
}

export default function ExerciseLibrarySheet({ visible, blockId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const addExerciseFromLibrary = useWorkoutStore((s) => s.addExerciseFromLibrary);

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('todos');

  const visibleEntries = useMemo(() => {
    let pool: ExerciseLibraryEntry[] = EXERCISE_LIBRARY;
    if (activeFilter === 'piernas') {
      pool = pool.filter((e) => e.muscleGroups.some((g) => LEG_GROUPS.includes(g)));
    } else if (activeFilter !== 'todos') {
      pool = libraryByMuscleGroup(activeFilter);
    }
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      pool = pool.filter((e) => e.name.toLowerCase().includes(q));
    }
    return pool;
  }, [activeFilter, query]);

  const handleSelect = useCallback(
    (entry: ExerciseLibraryEntry) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      addExerciseFromLibrary(blockId, entry.id);
      onClose();
    },
    [addExerciseFromLibrary, blockId, onClose],
  );

  const handleClose = useCallback(() => {
    setQuery('');
    setActiveFilter('todos');
    onClose();
  }, [onClose]);

  const renderRow = useCallback(({ item }: ListRenderItemInfo<ExerciseLibraryEntry>) => (
    <ExerciseRow entry={item} onPress={() => handleSelect(item)} />
  ), [handleSelect]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Librería de ejercicios</Text>
            <Text style={styles.hint}>Toca uno para añadirlo al bloque.</Text>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar ejercicio"
            placeholderTextColor={Colors.ink.muted}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => {
              const isActive = f.id === activeFilter;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveFilter(f.id);
                  }}
                  style={[styles.pill, isActive && styles.pillActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {visibleEntries.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyBody}>Prueba con otro término o filtro.</Text>
            </View>
          ) : (
            <FlatList
              data={visibleEntries}
              keyExtractor={(e) => e.id}
              renderItem={renderRow}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface RowProps {
  entry: ExerciseLibraryEntry;
  onPress: () => void;
}

const ExerciseRow = React.memo(function ExerciseRow({ entry, onPress }: RowProps) {
  const color = disciplineColor(entry.discipline);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{muscleLabels(entry.muscleGroups)}</Text>
      </View>
    </Pressable>
  );
});

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
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  hint: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
  search: {
    ...Type.body,
    color: Colors.ink.primary,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.elevated,
  },
  pillActive: {
    backgroundColor: Colors.gold.glow,
  },
  pillText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  pillTextActive: {
    color: Colors.gold.deep,
  },
  list: {
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.elevated,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  rowMeta: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  emptyTitle: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    marginBottom: Spacing.xs,
  },
  emptyBody: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
});
