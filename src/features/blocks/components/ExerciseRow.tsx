import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import SetRow from './SetRow';
import FieldConfigSheet from './FieldConfigSheet';
import type { ExerciseCard, FieldDefinition, FieldValue } from '../../../types/core';
import { getExerciseSummary } from '../../../types/core';
import { useWorkoutStore } from '../../../store/workoutStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExerciseRowProps {
  exercise: ExerciseCard;
  blockId: string;
  index: number;
  onUpdateName: (exerciseId: string, name: string) => void;
  onUpdateSetValue: (exerciseId: string, setId: string, fieldId: string, value: FieldValue) => void;
  onToggleSetComplete: (exerciseId: string, setId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  compact?: boolean;
}

function ExerciseRowInner({
  exercise,
  blockId,
  onUpdateName,
  onUpdateSetValue,
  onToggleSetComplete,
  onAddSet,
  onRemoveSet,
  onDeleteExercise,
  compact,
}: ExerciseRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(exercise.name);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const updateExercise = useWorkoutStore(s => s.updateExercise);

  const completedSets = exercise.sets.filter(s => s.completed).length;
  const totalSets = exercise.sets.length;
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const allDone = completedSets === totalSets && totalSets > 0;
  const summary = React.useMemo(() => getExerciseSummary(exercise), [exercise]);
  const disciplineColor = exercise.color || Colors.accent.primary;

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(prev => !prev);
  }, []);

  const handleNameSubmit = useCallback(() => {
    setEditingName(false);
    if (nameDraft.trim() && nameDraft.trim() !== exercise.name) {
      onUpdateName(exercise.id, nameDraft.trim());
    } else {
      setNameDraft(exercise.name);
    }
  }, [nameDraft, exercise.name, exercise.id, onUpdateName]);

  const handleSetValueChange = useCallback(
    (setId: string, fieldId: string, value: FieldValue) => {
      onUpdateSetValue(exercise.id, setId, fieldId, value);
    },
    [exercise.id, onUpdateSetValue],
  );

  const handleToggleSet = useCallback(
    (setId: string) => {
      onToggleSetComplete(exercise.id, setId);
    },
    [exercise.id, onToggleSetComplete],
  );

  const handleRemoveSet = useCallback(
    (setId: string) => {
      onRemoveSet(exercise.id, setId);
    },
    [exercise.id, onRemoveSet],
  );

  const handleSaveFields = useCallback((newFields: FieldDefinition[]) => {
    updateExercise(blockId, exercise.id, { fields: newFields });
  }, [blockId, exercise.id, updateExercise]);

  const maxFields = compact ? 2 : 4;
  const visibleFields = exercise.fields
    .filter(f => f.type !== 'boolean' || f.isPrimary)
    .sort((a, b) => a.order - b.order)
    .slice(0, maxFields);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      {/* Colored top edge */}
      <View style={[styles.topStrip, { backgroundColor: disciplineColor }]} />

      {/* Header */}
      <Pressable onPress={toggleExpand} style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerInfo}>
          {editingName ? (
            <TextInput
              style={[styles.nameInput, compact && styles.nameInputCompact]}
              value={nameDraft}
              onChangeText={setNameDraft}
              onBlur={handleNameSubmit}
              onSubmitEditing={handleNameSubmit}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
            />
          ) : (
            <Pressable onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditingName(true);
            }} delayLongPress={300}>
              <Text style={[styles.exerciseName, compact && styles.exerciseNameCompact]} numberOfLines={1}>{exercise.name}</Text>
            </Pressable>
          )}
          {!compact && <Text style={styles.exerciseSummary} numberOfLines={1}>{summary}</Text>}
        </View>

        <View style={styles.headerRight}>
          {totalSets > 0 && (
            <View style={styles.completionBadge}>
              <Text style={[styles.completionText, allDone && styles.completionDone]}>
                {completedSets}/{totalSets}
              </Text>
            </View>
          )}
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={compact ? 14 : 16}
            color={Colors.text.tertiary}
          />
        </View>
      </Pressable>

      {/* Mini progress bar */}
      {totalSets > 0 && !expanded && (
        <View style={styles.miniProgressTrack}>
          <View style={[
            styles.miniProgressFill,
            { width: `${pct}%` as `${number}%`, backgroundColor: allDone ? Colors.semantic.success : disciplineColor },
          ]} />
        </View>
      )}

      {/* Expanded content */}
      {expanded && (
        <View style={[styles.setsContainer, compact && styles.setsContainerCompact]}>
          {!compact && (
            <View style={styles.columnHeaders}>
              <Text style={[styles.columnLabel, styles.setNumCol]}>#</Text>
              <View style={styles.fieldsHeaderRow}>
                {visibleFields.map(f => (
                  <Text key={f.id} style={[styles.columnLabel, styles.fieldCol]} numberOfLines={1}>
                    {f.name}{f.unit ? ` (${f.unit})` : ''}
                  </Text>
                ))}
              </View>
              <View style={styles.checkCol} />
              <View style={styles.deleteCol} />
            </View>
          )}

          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              set={set}
              setIndex={i}
              fields={exercise.fields}
              onUpdateValue={handleSetValueChange}
              onToggleComplete={handleToggleSet}
              onRemove={handleRemoveSet}
              compact={compact}
            />
          ))}

          <View style={[styles.actionsRow, compact && styles.actionsRowCompact]}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAddSet(exercise.id);
              }}
              style={[styles.addSetBtn, compact && styles.addSetBtnCompact]}
            >
              <Feather name="plus" size={compact ? 11 : 13} color={Colors.accent.primary} />
              {!compact && <Text style={styles.addSetText}>Serie</Text>}
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFieldConfig(true);
              }}
              style={[styles.fieldsBtn, compact && styles.fieldsBtnCompact]}
            >
              <Feather name="sliders" size={compact ? 11 : 13} color={Colors.text.tertiary} />
              {!compact && <Text style={styles.fieldsBtnText}>Columnas</Text>}
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDeleteExercise(exercise.id);
              }}
              hitSlop={8}
              style={styles.deleteExBtn}
            >
              <Feather name="trash-2" size={compact ? 11 : 13} color={Colors.text.disabled} />
            </Pressable>
          </View>
        </View>
      )}

      <FieldConfigSheet
        visible={showFieldConfig}
        fields={exercise.fields}
        discipline={exercise.discipline}
        onSave={handleSaveFields}
        onClose={() => setShowFieldConfig(false)}
      />
    </Animated.View>
  );
}

function areExerciseRowPropsEqual(prev: ExerciseRowProps, next: ExerciseRowProps): boolean {
  if (prev.compact !== next.compact) return false;
  if (prev.blockId !== next.blockId) return false;
  if (prev.index !== next.index) return false;
  if (
    prev.onUpdateName !== next.onUpdateName ||
    prev.onUpdateSetValue !== next.onUpdateSetValue ||
    prev.onToggleSetComplete !== next.onToggleSetComplete ||
    prev.onAddSet !== next.onAddSet ||
    prev.onRemoveSet !== next.onRemoveSet ||
    prev.onDeleteExercise !== next.onDeleteExercise
  ) {
    return false;
  }

  const a = prev.exercise;
  const b = next.exercise;
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (a.name !== b.name || a.color !== b.color || a.icon !== b.icon) return false;
  if (a.updated_at !== b.updated_at) return false;
  if (a.fields !== b.fields && JSON.stringify(a.fields) !== JSON.stringify(b.fields)) return false;
  if (a.sets.length !== b.sets.length) return false;
  for (let i = 0; i < a.sets.length; i++) {
    const sa = a.sets[i];
    const sb = b.sets[i];
    if (sa.id !== sb.id) return false;
    if (sa.completed !== sb.completed) return false;
    if (sa.values !== sb.values && JSON.stringify(sa.values) !== JSON.stringify(sb.values)) return false;
  }
  return true;
}

export default React.memo(ExerciseRowInner, areExerciseRowPropsEqual);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.warm,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  topStrip: {
    height: 3,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  nameInput: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent.primary,
    paddingVertical: 2,
    marginRight: Spacing.sm,
  },
  exerciseSummary: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  completionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.elevated,
  },
  completionText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.tertiary,
  },
  completionDone: {
    color: Colors.semantic.success,
  },
  miniProgressTrack: {
    height: 2,
    backgroundColor: Colors.background.elevated,
  },
  miniProgressFill: {
    height: 2,
  },
  setsContainer: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
    marginBottom: Spacing.xs,
  },
  fieldsHeaderRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.disabled,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  setNumCol: {
    width: 28,
  },
  fieldCol: {
    flex: 1,
  },
  checkCol: {
    width: 34,
  },
  deleteCol: {
    width: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.dim,
  },
  addSetText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
    color: Colors.accent.primary,
  },
  fieldsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.background.elevated,
  },
  fieldsBtnText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
  },
  deleteExBtn: {
    padding: Spacing.xs,
  },
  headerCompact: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  exerciseNameCompact: {
    fontSize: Typography.size.caption,
  },
  nameInputCompact: {
    fontSize: Typography.size.caption,
  },
  setsContainerCompact: {
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  actionsRowCompact: {
    marginTop: Spacing.xs,
    paddingHorizontal: 0,
    gap: Spacing.xs,
  },
  addSetBtnCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  fieldsBtnCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
});
