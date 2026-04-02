// KAIROS — Block Library Screen V3

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import WorkoutBlock from '../components/WorkoutBlock';
import type {
  WorkoutBlock as WorkoutBlockType,
  ExerciseCard as ExerciseCardType,
  ExerciseSet,
  FieldValue,
  Discipline,
} from '../types/core';
import {
  createWorkoutBlock,
  createExerciseCard,
  createEmptySet,
  DISCIPLINE_CONFIGS,
} from '../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

const MOCK_USER_ID = 'user_001';

export default function BlockLibraryScreen() {
  const [blocks, setBlocks] = useState<WorkoutBlockType[]>([]);

  // ===== BLOCK =====

  const handleCreateBlock = useCallback((discipline: Discipline = 'strength'): void => {
    const config = DISCIPLINE_CONFIGS[discipline];
    const newBlock: WorkoutBlockType = createWorkoutBlock(MOCK_USER_ID, blocks.length, discipline, {
      name: 'New block',
      icon: config.icon,
      color: config.color,
    });
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] => [...prev, newBlock]);
  }, [blocks.length]);

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<WorkoutBlockType>): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((b: WorkoutBlockType): WorkoutBlockType =>
        b.id === blockId ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
      )
    );
  }, []);

  // ===== EXERCISE =====

  const handleAddExercise = useCallback((blockId: string): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((block: WorkoutBlockType): WorkoutBlockType => {
        if (block.id !== blockId) return block;
        const ex: ExerciseCardType = createExerciseCard(blockId, block.exercises.length, block.discipline);
        return { ...block, exercises: [...block.exercises, ex], updated_at: new Date().toISOString() };
      })
    );
  }, []);

  const handleUpdateExercise = useCallback((exerciseId: string, updates: Partial<ExerciseCardType>): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((block: WorkoutBlockType): WorkoutBlockType => ({
        ...block,
        exercises: block.exercises.map((ex: ExerciseCardType): ExerciseCardType =>
          ex.id === exerciseId ? { ...ex, ...updates, updated_at: new Date().toISOString() } : ex
        ),
      }))
    );
  }, []);

  // ===== SETS =====

  const handleUpdateSetValue = useCallback((exerciseId: string, setIndex: number, fieldId: string, value: FieldValue): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((block: WorkoutBlockType): WorkoutBlockType => ({
        ...block,
        exercises: block.exercises.map((ex: ExerciseCardType): ExerciseCardType => {
          if (ex.id !== exerciseId) return ex;
          const newSets: ExerciseSet[] = [...ex.sets];
          newSets[setIndex] = {
            ...newSets[setIndex],
            values: { ...newSets[setIndex].values, [fieldId]: value },
          };
          return { ...ex, sets: newSets, updated_at: new Date().toISOString() };
        }),
      }))
    );
  }, []);

  const handleToggleSetComplete = useCallback((exerciseId: string, setIndex: number): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((block: WorkoutBlockType): WorkoutBlockType => ({
        ...block,
        exercises: block.exercises.map((ex: ExerciseCardType): ExerciseCardType => {
          if (ex.id !== exerciseId) return ex;
          const newSets: ExerciseSet[] = [...ex.sets];
          const s: ExerciseSet = newSets[setIndex];
          newSets[setIndex] = { ...s, completed: !s.completed, completed_at: !s.completed ? new Date().toISOString() : null };
          return { ...ex, sets: newSets, updated_at: new Date().toISOString() };
        }),
      }))
    );
  }, []);

  const handleAddSet = useCallback((exerciseId: string): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((block: WorkoutBlockType): WorkoutBlockType => ({
        ...block,
        exercises: block.exercises.map((ex: ExerciseCardType): ExerciseCardType => {
          if (ex.id !== exerciseId) return ex;
          const newSet: ExerciseSet = createEmptySet(exerciseId, ex.sets.length, ex.fields);
          return { ...ex, sets: [...ex.sets, newSet], updated_at: new Date().toISOString() };
        }),
      }))
    );
  }, []);

  const handleRemoveSet = useCallback((exerciseId: string, setIndex: number): void => {
    setBlocks((prev: WorkoutBlockType[]): WorkoutBlockType[] =>
      prev.map((block: WorkoutBlockType): WorkoutBlockType => ({
        ...block,
        exercises: block.exercises.map((ex: ExerciseCardType): ExerciseCardType => {
          if (ex.id !== exerciseId) return ex;
          const filtered: ExerciseSet[] = ex.sets.filter((_s: ExerciseSet, i: number): boolean => i !== setIndex);
          const reordered: ExerciseSet[] = filtered.map((s: ExerciseSet, i: number): ExerciseSet => ({ ...s, order: i }));
          return { ...ex, sets: reordered, updated_at: new Date().toISOString() };
        }),
      }))
    );
  }, []);

  const hasBlocks: boolean = blocks.length > 0;

  return (
    <View style={styles.screen}>
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.header}>
        <View>
          <Text style={styles.brand}>Kairos</Text>
          <Text style={styles.subtitle}>Your training blocks</Text>
        </View>
        {hasBlocks && (
          <Pressable onPress={() => handleCreateBlock()} style={({ pressed }) => [styles.plusBtn, pressed && styles.plusBtnPressed]}>
            <Text style={styles.plusText}>+</Text>
          </Pressable>
        )}
      </Animated.View>

      {hasBlocks ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {blocks.map((block: WorkoutBlockType, i: number) => (
            <Animated.View key={block.id} entering={FadeInDown.delay(i * 80).duration(350)}>
              <WorkoutBlock
                block={block}
                onUpdateSetValue={handleUpdateSetValue}
                onToggleSetComplete={handleToggleSetComplete}
                onAddSet={handleAddSet}
                onRemoveSet={handleRemoveSet}
                onUpdateExercise={handleUpdateExercise}
                onAddExercise={handleAddExercise}
                onUpdateBlock={handleUpdateBlock}
                onPressHeader={(id: string) => Alert.alert('Settings', 'Edit block (coming soon)')}
                isActive
              />
            </Animated.View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.empty}>
          <View style={styles.emptyIcon}><Text style={{ fontSize: 32 }}>📂</Text></View>
          <Text style={styles.emptyTitle}>No blocks yet</Text>
          <Text style={styles.emptyDesc}>Create your first training block to start building your workout library.</Text>
          <Pressable onPress={() => handleCreateBlock()} style={({ pressed }) => [styles.createBtn, pressed && styles.createBtnPressed]}>
            <Text style={styles.createBtnText}>Create block</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background.void },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: Spacing.screen.horizontal, paddingTop: Spacing.screen.top, paddingBottom: Spacing.lg },
  brand: { fontSize: Typography.size.title, fontWeight: Typography.weight.bold, color: Colors.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: Typography.size.caption, color: Colors.text.tertiary, marginTop: 2 },
  plusBtn: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.accent.muted, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: Colors.accent.dim },
  plusBtnPressed: { backgroundColor: Colors.accent.primary },
  plusText: { fontSize: 20, fontWeight: Typography.weight.medium, color: Colors.accent.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.screen.horizontal, gap: Spacing.gap.sections, paddingBottom: Spacing.screen.bottom },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.screen.horizontal * 2 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.accent.muted, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  emptyTitle: { fontSize: Typography.size.heading, fontWeight: Typography.weight.medium, color: Colors.text.primary, marginBottom: Spacing.sm },
  emptyDesc: { fontSize: Typography.size.body, color: Colors.text.secondary, textAlign: 'center', lineHeight: Typography.size.body * Typography.lineHeight.relaxed, marginBottom: Spacing['2xl'] },
  createBtn: { backgroundColor: Colors.accent.primary, paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing['2xl'], borderRadius: Radius.sm, ...Shadows.subtle },
  createBtnPressed: { backgroundColor: Colors.accent.light },
  createBtnText: { fontSize: Typography.size.body, fontWeight: Typography.weight.semibold, color: Colors.text.inverse },
});
