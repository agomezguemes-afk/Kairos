// KAIROS — ExerciseCard V3 (Dynamic Fields, Strict Types)

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type {
  ExerciseCard as ExerciseCardType,
  ExerciseSet,
  FieldDefinition,
  FieldValue,
} from '../types/core';
import { getExerciseSummary } from '../types/core';
import { Colors, Typography, Spacing, Radius, Animation } from '../theme/index';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ======================== PROPS ========================

interface ExerciseCardProps {
  exercise: ExerciseCardType;
  onUpdateSetValue: (exerciseId: string, setIndex: number, fieldId: string, value: FieldValue) => void;
  onToggleSetComplete: (exerciseId: string, setIndex: number) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setIndex: number) => void;
  onUpdateExercise: (exerciseId: string, updates: Partial<ExerciseCardType>) => void;
  isActive?: boolean;
  onDeleteExercise?: (exerciseId: string) => void;
}

// ======================== INLINE FIELD ========================

const InlineField: React.FC<{
  value: FieldValue;
  field: FieldDefinition;
  onChange: (val: FieldValue) => void;
  isActive: boolean;
  isCompleted: boolean;
}> = React.memo(({ value, field, onChange, isActive, isCompleted }) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [temp, setTemp] = useState<string>('');
  const inputRef = useRef<TextInput>(null);

  const handlePress = (): void => {
    if (!isActive || field.type !== 'number') return;
    setEditing(true);
    setTemp(value !== null ? String(value) : '');
  };

  const handleBlur = (): void => {
    setEditing(false);
    if (field.type === 'number') {
      const parsed: number = parseFloat(temp);
      onChange(isNaN(parsed) ? null : parsed);
    }
  };

  if (editing && isActive) {
    return (
      <TextInput
        ref={inputRef}
        style={[styles.fieldInput, styles.fieldEditing]}
        value={temp}
        onChangeText={setTemp}
        onBlur={handleBlur}
        onSubmitEditing={() => inputRef.current?.blur()}
        keyboardType="numeric"
        selectTextOnFocus
        autoFocus
        maxLength={8}
        returnKeyType="done"
      />
    );
  }

  const display: string = value !== null && value !== undefined ? String(value) : '—';

  return (
    <Pressable onPress={handlePress} disabled={!isActive} style={styles.fieldTouchable}>
      <Text style={[
        styles.fieldInput,
        value === null && styles.fieldEmpty,
        isCompleted && styles.fieldDone,
      ]}>
        {display}
      </Text>
    </Pressable>
  );
});

InlineField.displayName = 'InlineField';

// ======================== CHECKBOX ========================

const Checkbox: React.FC<{
  completed: boolean;
  onToggle: () => void;
  isActive: boolean;
}> = React.memo(({ completed, onToggle, isActive }) => {
  const scale = useSharedValue(1);

  const handlePress = (): void => {
    if (!isActive) return;
    scale.value = withSpring(0.75, Animation.spring.snappy, () => {
      scale.value = withSpring(1, Animation.spring.bouncy);
    });
    onToggle();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress} disabled={!isActive} hitSlop={10}>
      <Animated.View style={[styles.checkbox, completed && styles.checkboxDone, animStyle]}>
        {completed && <Text style={styles.checkmark}>✓</Text>}
      </Animated.View>
    </Pressable>
  );
});

Checkbox.displayName = 'Checkbox';

// ======================== SET DELETE ACTION ========================

const SetDeleteAction: React.FC<{
  progress: SharedValue<number>;
  onDelete: () => void;
}> = React.memo(({ progress, onDelete }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));
  return (
    <Animated.View style={[setDeleteStyles.wrap, animStyle]}>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [setDeleteStyles.btn, pressed && setDeleteStyles.btnPressed]}
      >
        <Text style={setDeleteStyles.icon}>×</Text>
      </Pressable>
    </Animated.View>
  );
});
SetDeleteAction.displayName = 'SetDeleteAction';

const setDeleteStyles = StyleSheet.create({
  wrap: { width: 52, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 2 },
  btn: {
    flex: 1,
    backgroundColor: 'rgba(232,69,69,0.85)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  btnPressed: { opacity: 0.75 },
  icon: { fontSize: 20, fontWeight: '700', color: '#fff', lineHeight: 22 },
});

// ======================== SET ROW ========================

const SetRow: React.FC<{
  set: ExerciseSet;
  index: number;
  fields: FieldDefinition[];
  isActive: boolean;
  totalSets: number;
  onUpdateValue: (fieldId: string, value: FieldValue) => void;
  onToggleComplete: () => void;
  onRemoveSet: (setIndex: number) => void;
}> = React.memo(({ set, index, fields, isActive, totalSets, onUpdateValue, onToggleComplete, onRemoveSet }) => {
  const swipeRef = useRef<SwipeableMethods>(null);

  const visibleFields: FieldDefinition[] = fields
    .filter((f: FieldDefinition): boolean => f.type === 'number')
    .sort((a: FieldDefinition, b: FieldDefinition): number => a.order - b.order);

  const handleRemove = useCallback((): void => {
    swipeRef.current?.close();
    if (totalSets <= 1) {
      Alert.alert('Mínimo 1 serie', 'Añade otra serie antes de eliminar esta.');
      return;
    }
    Alert.alert(
      'Eliminar serie',
      `¿Eliminar la serie ${index + 1}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onRemoveSet(index) },
      ]
    );
  }, [totalSets, index, onRemoveSet]);

  const rowContent = (
    <View style={[styles.setRow, set.completed && styles.setRowDone]}>
      <Text style={[styles.setNumber, set.completed && styles.setNumberDone]}>
        {index + 1}
      </Text>
      {visibleFields.map((field: FieldDefinition) => (
        <InlineField
          key={field.id}
          value={set.values[field.id] ?? null}
          field={field}
          onChange={(val: FieldValue) => onUpdateValue(field.id, val)}
          isActive={isActive}
          isCompleted={set.completed}
        />
      ))}
      <Checkbox
        completed={set.completed}
        onToggle={onToggleComplete}
        isActive={isActive}
      />
    </View>
  );

  if (!isActive) return rowContent;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={50}
      overshootRight={false}
      renderRightActions={(progress: SharedValue<number>) => (
        <SetDeleteAction progress={progress} onDelete={handleRemove} />
      )}
    >
      {rowContent}
    </ReanimatedSwipeable>
  );
});

SetRow.displayName = 'SetRow';

// ======================== DOT PROGRESS ========================

const DotProgress: React.FC<{ sets: ExerciseSet[] }> = React.memo(({ sets }) => (
  <View style={styles.dots}>
    {sets.map((s: ExerciseSet) => (
      <View key={s.id} style={[styles.dot, s.completed && styles.dotDone]} />
    ))}
  </View>
));

DotProgress.displayName = 'DotProgress';

// ======================== MAIN ========================

const ExerciseCardComponent: React.FC<ExerciseCardProps> = ({
  exercise,
  onUpdateSetValue,
  onToggleSetComplete,
  onAddSet,
  onRemoveSet,
  onUpdateExercise,
  isActive = true,
  onDeleteExercise,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [editingName, setEditingName] = useState<boolean>(false);
  const [nameVal, setNameVal] = useState<string>(exercise.name);
  const nameRef = useRef<TextInput>(null);
  const chevron = useSharedValue(0);

  const summary: string = useMemo(() => getExerciseSummary(exercise), [exercise]);
  const completedCount: number = useMemo(
    () => exercise.sets.filter((s: ExerciseSet): boolean => s.completed).length,
    [exercise.sets]
  );

  const visibleFields: FieldDefinition[] = useMemo(
    () => exercise.fields
      .filter((f: FieldDefinition): boolean => f.type === 'number')
      .sort((a: FieldDefinition, b: FieldDefinition): number => a.order - b.order),
    [exercise.fields]
  );

  const handleNamePress = useCallback((): void => {
    if (!isActive) return;
    setEditingName(true);
    setNameVal(exercise.name);
    setTimeout(() => nameRef.current?.focus(), 100);
  }, [isActive, exercise.name]);

  const handleNameDone = useCallback((): void => {
    setEditingName(false);
    if (nameVal.trim() && nameVal.trim() !== exercise.name) {
      onUpdateExercise(exercise.id, { name: nameVal.trim() });
    }
  }, [nameVal, exercise.id, exercise.name, onUpdateExercise]);

  const toggle = useCallback((): void => {
    LayoutAnimation.configureNext({
      duration: Animation.duration.normal,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setExpanded((prev: boolean) => !prev);
    chevron.value = withTiming(expanded ? 0 : 1, { duration: Animation.duration.normal });
  }, [expanded, chevron]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevron.value, [0, 1], [0, 90])}deg` }],
  }));

  const progressPct: number = exercise.sets.length > 0
    ? Math.round((completedCount / exercise.sets.length) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable onPress={toggle} style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: `${exercise.color}20` }]}>
            <Text style={[styles.iconText, { color: exercise.color }]}>
              {exercise.icon.length <= 2 ? exercise.icon : exercise.icon[0]}
            </Text>
          </View>
          <View style={styles.nameArea}>
            {editingName ? (
              <TextInput
                ref={nameRef}
                style={styles.nameInput}
                value={nameVal}
                onChangeText={setNameVal}
                onBlur={handleNameDone}
                onSubmitEditing={handleNameDone}
                returnKeyType="done"
                selectTextOnFocus
                maxLength={40}
              />
            ) : (
              <Pressable onPress={handleNamePress} disabled={!isActive}>
                <Text style={styles.nameText} numberOfLines={1}>{exercise.name}</Text>
              </Pressable>
            )}
            {!expanded && <Text style={styles.summaryText}>{summary}</Text>}
          </View>
        </View>
        <View style={styles.headerRight}>
          {!expanded && <DotProgress sets={exercise.sets} />}
          <Animated.Text style={[styles.chevron, chevronStyle]}>›</Animated.Text>
        </View>
      </Pressable>

      {/* Expanded body */}
      {expanded && (
        <View style={styles.body}>
          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              {
                width: `${progressPct}%`,
                backgroundColor: completedCount === exercise.sets.length
                  ? Colors.semantic.success
                  : Colors.accent.primary,
              },
            ]} />
          </View>
          <Text style={styles.progressLabel}>
            {completedCount}/{exercise.sets.length} sets
          </Text>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colLabel, { width: 32 }]}>Set</Text>
            {visibleFields.map((f: FieldDefinition) => (
              <Text key={f.id} style={styles.colLabel}>
                {f.unit ?? f.name}
              </Text>
            ))}
            <View style={{ width: 24 }} />
          </View>

          {/* Rows */}
          {exercise.sets.map((set: ExerciseSet, i: number) => (
            <SetRow
              key={set.id}
              set={set}
              index={i}
              fields={exercise.fields}
              isActive={isActive}
              totalSets={exercise.sets.length}
              onUpdateValue={(fieldId: string, val: FieldValue) => onUpdateSetValue(exercise.id, i, fieldId, val)}
              onToggleComplete={() => onToggleSetComplete(exercise.id, i)}
              onRemoveSet={(setIndex: number) => onRemoveSet(exercise.id, setIndex)}
            />
          ))}

          {/* Add set */}
          {isActive && (
            <Pressable onPress={() => onAddSet(exercise.id)} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
              <Text style={styles.addBtnText}>+ Add set</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

// ======================== STYLES ========================

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.background.elevated, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, minHeight: 56 },
  headerPressed: { backgroundColor: Colors.background.overlay },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, marginRight: Spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBadge: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 13, fontWeight: '600' },
  nameArea: { flex: 1 },
  nameText: { fontSize: Typography.size.body, fontWeight: Typography.weight.medium, color: Colors.text.primary },
  nameInput: { fontSize: Typography.size.body, fontWeight: Typography.weight.medium, color: Colors.text.primary, borderBottomWidth: 1, borderBottomColor: Colors.accent.primary, paddingVertical: 2 },
  summaryText: { fontSize: Typography.size.micro, color: Colors.text.tertiary, marginTop: 2 },
  dots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.border.medium },
  dotDone: { backgroundColor: Colors.semantic.success },
  chevron: { fontSize: 18, color: Colors.text.tertiary, marginLeft: 4 },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  progressBar: { height: 2, backgroundColor: Colors.border.subtle, borderRadius: 1, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 1 },
  progressLabel: { fontSize: Typography.size.micro, color: Colors.text.tertiary, marginBottom: Spacing.sm },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.xs, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, marginBottom: 2 },
  colLabel: { flex: 1, fontSize: 10, fontWeight: Typography.weight.medium, color: Colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, minHeight: 36 },
  setRowDone: { opacity: 0.65 },
  setNumber: { width: 32, fontSize: Typography.size.caption, fontWeight: Typography.weight.medium, color: Colors.text.tertiary },
  setNumberDone: { color: Colors.text.disabled },
  fieldTouchable: { flex: 1 },
  fieldInput: { flex: 1, fontSize: Typography.size.body, fontWeight: Typography.weight.medium, color: Colors.text.primary, paddingVertical: 4, paddingHorizontal: 4, minWidth: 36 },
  fieldEditing: { backgroundColor: Colors.background.overlay, borderRadius: Radius.xs, borderWidth: 1, borderColor: Colors.accent.primary },
  fieldEmpty: { color: Colors.text.disabled },
  fieldDone: { color: Colors.text.secondary },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 0.5, borderColor: Colors.border.medium, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: Colors.semantic.success, borderColor: Colors.semantic.success },
  checkmark: { fontSize: 11, fontWeight: '700', color: Colors.text.inverse },
  addBtn: { paddingVertical: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, borderStyle: 'dashed', borderRadius: Radius.sm, alignItems: 'center', marginTop: Spacing.sm },
  addBtnPressed: { backgroundColor: Colors.background.overlay, borderColor: Colors.accent.dim },
  addBtnText: { fontSize: Typography.size.caption, fontWeight: Typography.weight.medium, color: Colors.text.disabled },
  removeSetBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginLeft: 4 },
  removeSetBtnPressed: { backgroundColor: 'rgba(232, 69, 69, 0.15)' },
  removeSetIcon: { fontSize: 16, fontWeight: '600', color: 'rgba(232, 69, 69, 0.6)', lineHeight: 20 },
});

export default React.memo(ExerciseCardComponent);
