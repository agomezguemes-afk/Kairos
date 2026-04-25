import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import ExerciseRow from './components/ExerciseRow';
import AddExerciseSheet from './components/AddExerciseSheet';
import CompletionCelebration from '../../components/CompletionCelebration';
import ConfettiBurst, { type ConfettiRef } from '../../components/ConfettiParticles';
import { useBlockEditor } from './hooks/useBlockEditor';
import { calculateBlockStats, getBlockExercises } from '../../types/core';
import type { WorkoutBlock, ExerciseCard, Discipline } from '../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme/index';
import { springs } from '../../theme/animations';

export default function BlockDetailScreen({ route, navigation }: any) {
  const { blockId } = route.params as { blockId: string };
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiRef | null>(null);

  const {
    block,
    handleUpdateName,
    handleUpdateDescription,
    handleToggleFavorite,
    handleDelete,
    handleAddExercise,
    handleUpdateExerciseName,
    handleDeleteExercise,
    handleUpdateSetValue,
    handleToggleSetComplete,
    handleAddSet,
    handleRemoveSet,
  } = useBlockEditor(blockId);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [celebrationBlock, setCelebrationBlock] = useState<WorkoutBlock | null>(null);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const stats = React.useMemo(
    () => (block ? calculateBlockStats(block) : null),
    [block],
  );

  const handleNameEdit = useCallback(() => {
    if (!block) return;
    setNameDraft(block.name);
    setEditingName(true);
  }, [block]);

  const handleNameSubmit = useCallback(() => {
    setEditingName(false);
    if (nameDraft.trim()) handleUpdateName(nameDraft.trim());
  }, [nameDraft, handleUpdateName]);

  const handleDescEdit = useCallback(() => {
    setDescDraft(block?.description ?? '');
    setEditingDesc(true);
  }, [block]);

  const handleDescSubmit = useCallback(() => {
    setEditingDesc(false);
    handleUpdateDescription(descDraft.trim());
  }, [descDraft, handleUpdateDescription]);

  const handleDeleteBlock = useCallback(() => {
    Alert.alert('Eliminar bloque', '¿Seguro que quieres eliminar este bloque?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          handleDelete();
          navigation.goBack();
        },
      },
    ]);
  }, [handleDelete, navigation]);

  const handleDeleteExerciseConfirm = useCallback(
    (exerciseId: string) => {
      Alert.alert('Eliminar ejercicio', '¿Eliminar este ejercicio y sus series?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => handleDeleteExercise(exerciseId),
        },
      ]);
    },
    [handleDeleteExercise],
  );

  const handleSetComplete = useCallback(
    (exerciseId: string, setId: string) => {
      const completedBlock = handleToggleSetComplete(exerciseId, setId);
      if (completedBlock) {
        setTimeout(() => {
          setCelebrationBlock(completedBlock);
          confettiRef.current?.burst();
        }, 600);
      }
    },
    [handleToggleSetComplete],
  );

  if (!block) {
    return (
      <View style={[styles.screen, styles.emptyScreen]}>
        <Text style={styles.emptyText}>Bloque no encontrado</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.emptyLink}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const disciplineColor = block.color || Colors.accent.primary;
  const pct = stats?.completion_percentage ?? 0;

  return (
    <View style={styles.screen}>
      <ConfettiBurst confettiRef={confettiRef} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header bar */}
          <View style={styles.headerBar}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable onPress={handleToggleFavorite} hitSlop={8}>
                <Feather
                  name={block.is_favorite ? 'star' : 'star'}
                  size={20}
                  color={block.is_favorite ? Colors.accent.primary : Colors.text.tertiary}
                />
              </Pressable>
              <Pressable onPress={handleDeleteBlock} hitSlop={8}>
                <Feather name="trash-2" size={20} color={Colors.text.tertiary} />
              </Pressable>
            </View>
          </View>

          {/* Color strip */}
          <View style={[styles.topStrip, { backgroundColor: disciplineColor }]} />

          {/* Block name */}
          <Animated.View entering={FadeIn.duration(300)}>
            {editingName ? (
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={handleNameSubmit}
                onSubmitEditing={handleNameSubmit}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
              />
            ) : (
              <Pressable onPress={handleNameEdit}>
                <Text style={styles.blockName}>{block.name}</Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Description */}
          {editingDesc ? (
            <TextInput
              style={styles.descInput}
              value={descDraft}
              onChangeText={setDescDraft}
              onBlur={handleDescSubmit}
              onSubmitEditing={handleDescSubmit}
              placeholder="Descripcion del bloque..."
              placeholderTextColor={Colors.text.disabled}
              multiline
              autoFocus
            />
          ) : (
            <Pressable onPress={handleDescEdit}>
              <Text style={styles.blockDesc}>
                {block.description || 'Toca para agregar descripcion...'}
              </Text>
            </Pressable>
          )}

          {/* Progress summary */}
          {stats && stats.total_sets > 0 && (
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressPct}>{pct}%</Text>
                <Text style={styles.progressLabel}>
                  {stats.completed_sets}/{stats.total_sets} series
                </Text>
                {stats.total_volume > 0 && (
                  <Text style={styles.progressVolume}>
                    {Math.round(stats.total_volume)} kg vol
                  </Text>
                )}
              </View>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%` as `${number}%`,
                      backgroundColor: pct === 100 ? Colors.semantic.success : disciplineColor,
                    },
                  ]}
                />
              </View>
            </Animated.View>
          )}

          {/* Discipline badge */}
          <View style={styles.metaRow}>
            <View style={[styles.disciplineBadge, { backgroundColor: disciplineColor + '14' }]}>
              <View style={[styles.disciplineDot, { backgroundColor: disciplineColor }]} />
              <Text style={[styles.disciplineText, { color: disciplineColor }]}>
                {block.discipline.charAt(0).toUpperCase() + block.discipline.slice(1)}
              </Text>
            </View>
            {block.times_performed > 0 && (
              <Text style={styles.metaDetail}>
                Realizado {block.times_performed}x
              </Text>
            )}
          </View>

          {/* Exercises */}
          <View style={styles.exercisesSection}>
            <Text style={styles.sectionTitle}>
              Ejercicios ({getBlockExercises(block).length})
            </Text>

            {getBlockExercises(block).length === 0 ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.emptyExercises}>
                <Feather name="plus-circle" size={32} color={Colors.text.disabled} />
                <Text style={styles.emptyExercisesText}>
                  Agrega tu primer ejercicio
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.exerciseList}>
                {getBlockExercises(block).map((ex: ExerciseCard, i: number) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    blockId={blockId}
                    index={i}
                    onUpdateName={handleUpdateExerciseName}
                    onUpdateSetValue={handleUpdateSetValue}
                    onToggleSetComplete={handleSetComplete}
                    onAddSet={handleAddSet}
                    onRemoveSet={handleRemoveSet}
                    onDeleteExercise={handleDeleteExerciseConfirm}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB — add exercise */}
      <Animated.View style={[styles.fab, fabStyle, { bottom: insets.bottom + 20 }]}>
        <Pressable
          onPressIn={() => { fabScale.value = withSpring(0.88, springs.tap); }}
          onPressOut={() => { fabScale.value = withSpring(1, springs.bouncy); }}
          onPress={() => setShowAddExercise(true)}
          style={styles.fabInner}
        >
          <Feather name="plus" size={24} color={Colors.text.inverse} />
        </Pressable>
      </Animated.View>

      {/* Add exercise sheet */}
      <AddExerciseSheet
        visible={showAddExercise}
        blockDiscipline={block.discipline}
        onAdd={(opts) => handleAddExercise(opts)}
        onClose={() => setShowAddExercise(false)}
      />

      {/* Celebration */}
      <CompletionCelebration
        block={celebrationBlock}
        onDismiss={() => setCelebrationBlock(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  emptyScreen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  emptyLink: {
    fontSize: Typography.size.body,
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
  },

  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },

  topStrip: {
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.xl,
  },

  nameInput: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent.primary,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
    letterSpacing: Typography.tracking.tight,
  },
  blockName: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    letterSpacing: Typography.tracking.tight,
  },

  descInput: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xl,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
  blockDesc: {
    fontSize: Typography.size.body,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },

  progressCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border.light,
    ...Shadows.subtle,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  progressPct: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  progressLabel: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
  },
  progressVolume: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginLeft: 'auto',
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.background.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  disciplineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  disciplineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  disciplineText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
  },
  metaDetail: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },

  exercisesSection: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  exerciseList: {
    gap: Spacing.md,
  },
  emptyExercises: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'] + 10,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderStyle: 'dashed',
  },
  emptyExercisesText: {
    fontSize: Typography.size.caption,
    color: Colors.text.disabled,
    marginTop: Spacing.md,
  },

  fab: {
    position: 'absolute',
    right: 20,
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.elevated,
  },
});
