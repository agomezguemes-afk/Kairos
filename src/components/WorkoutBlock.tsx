// KAIROS — WorkoutBlock V3 (Strict Types)

import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import ExerciseCard from './ExerciseCard';
import type {
  WorkoutBlock as WorkoutBlockType,
  ExerciseCard as ExerciseCardType,
  ExerciseSet,
  FieldDefinition,
  FieldValue,
} from '../types/core';
import { calculateBlockStats, DISCIPLINE_CONFIGS } from '../types/core';
import KairosIcon from './KairosIcon';
import { Colors, Typography, Spacing, Radius, Shadows, Animation } from '../theme/index';

// ======================== PROPS ========================

interface WorkoutBlockProps {
  block: WorkoutBlockType;
  onUpdateSetValue: (exerciseId: string, setIndex: number, fieldId: string, value: FieldValue) => void;
  onToggleSetComplete: (exerciseId: string, setIndex: number) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setIndex: number) => void;
  onUpdateExercise: (exerciseId: string, updates: Partial<ExerciseCardType>) => void;
  onAddExercise: (blockId: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<WorkoutBlockType>) => void;
  onDeleteExercise?: (blockId: string, exerciseId: string) => void;
  onPressHeader?: (blockId: string) => void;
  isActive?: boolean;
  isDetailView?: boolean;
}

// ======================== PROGRESS BAR ========================

const ProgressBar: React.FC<{ percentage: number }> = React.memo(({ percentage }) => {
  const w = useSharedValue(percentage);
  React.useEffect(() => {
    w.value = withSpring(percentage, Animation.spring.gentle);
  }, [percentage, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  const color: string = percentage >= 100 ? Colors.semantic.success : Colors.accent.primary;
  return (
    <View style={pbStyles.track}>
      <Animated.View style={[pbStyles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
});
ProgressBar.displayName = 'ProgressBar';

const pbStyles = StyleSheet.create({
  track: { height: 3, backgroundColor: Colors.border.subtle, borderRadius: 2, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 2 },
});

// ======================== EXERCISE DELETE ACTION ========================

const ExerciseDeleteAction: React.FC<{
  progress: SharedValue<number>;
  onDelete: () => void;
}> = React.memo(({ progress, onDelete }) => {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.7, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1]) }],
  }));
  return (
    <Animated.View style={[exDeleteStyles.wrap, animStyle]}>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => [exDeleteStyles.btn, pressed && exDeleteStyles.btnPressed]}
      >
        <KairosIcon name="trash" size={20} color={Colors.text.inverse} />
        <Text style={exDeleteStyles.label}>Eliminar</Text>
      </Pressable>
    </Animated.View>
  );
});
ExerciseDeleteAction.displayName = 'ExerciseDeleteAction';

const exDeleteStyles = StyleSheet.create({
  wrap: { width: 80, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 2 },
  btn: {
    flex: 1,
    backgroundColor: '#E84545',
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  btnPressed: { opacity: 0.8 },
  icon: { fontSize: 18, marginBottom: 2 },
  label: { fontSize: 10, fontWeight: '600', color: '#fff' },
});

// ======================== MAIN ========================

const WorkoutBlockComponent: React.FC<WorkoutBlockProps> = ({
  block, onUpdateSetValue, onToggleSetComplete, onAddSet, onRemoveSet,
  onUpdateExercise, onAddExercise, onUpdateBlock, onDeleteExercise, onPressHeader,
  isActive = true, isDetailView = false,
}) => {
  const [editingName, setEditingName] = useState<boolean>(false);
  const [nameVal, setNameVal] = useState<string>(block.name);
  const nameRef = useRef<TextInput>(null);

  const stats = useMemo(() => calculateBlockStats(block), [block]);
  const config = DISCIPLINE_CONFIGS[block.discipline];

  const statusColor: string = useMemo((): string => {
    switch (block.status) {
      case 'completed': return Colors.semantic.success;
      case 'in_progress': return Colors.accent.primary;
      case 'partial': return Colors.semantic.warning;
      default: return Colors.text.tertiary;
    }
  }, [block.status]);

  const fmtDuration: string = useMemo((): string => {
    const m: number = stats.estimated_duration;
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }, [stats.estimated_duration]);

  const fmtVolume: string = useMemo((): string => {
    if (stats.total_volume === 0) return '—';
    return stats.total_volume >= 1000 ? `${(stats.total_volume / 1000).toFixed(1)}t` : `${stats.total_volume}kg`;
  }, [stats.total_volume]);

  const handleNamePress = useCallback((): void => {
    if (!isActive) return;
    setEditingName(true);
    setNameVal(block.name);
    setTimeout(() => nameRef.current?.focus(), 100);
  }, [isActive, block.name]);

  const handleNameDone = useCallback((): void => {
    setEditingName(false);
    if (nameVal.trim() && nameVal.trim() !== block.name) {
      onUpdateBlock(block.id, { name: nameVal.trim() });
    }
  }, [nameVal, block.id, block.name, onUpdateBlock]);

  return (
    <View style={[styles.container, { backgroundColor: `${block.color}08`, shadowColor: block.color }]}>
      <View style={[styles.stripe, { backgroundColor: block.color }]} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => onPressHeader?.(block.id)}>
              <View style={[styles.blockIcon, { backgroundColor: `${block.color}20` }]}>
                <Text style={styles.blockEmoji}>{block.icon}</Text>
              </View>
            </Pressable>
            <View style={styles.nameArea}>
              {editingName ? (
                <TextInput
                  ref={nameRef} style={styles.nameInput} value={nameVal}
                  onChangeText={setNameVal} onBlur={handleNameDone} onSubmitEditing={handleNameDone}
                  returnKeyType="done" selectTextOnFocus maxLength={40}
                />
              ) : (
                <Pressable onPress={handleNamePress}>
                  <Text style={styles.blockName} numberOfLines={1}>{block.name}</Text>
                </Pressable>
              )}
              <Text style={styles.blockMeta}>
                {config.icon} {config.name} · {stats.total_exercises} exercise{stats.total_exercises !== 1 ? 's' : ''}
                {stats.estimated_duration > 0 ? ` · ~${fmtDuration}` : ''}
              </Text>
            </View>
          </View>
          {block.status !== 'draft' && <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
        </View>

        {stats.total_sets > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statsLeft}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{stats.completed_sets}/{stats.total_sets}</Text>
                <Text style={styles.statLabel}>SETS</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{fmtVolume}</Text>
                <Text style={styles.statLabel}>VOL</Text>
              </View>
            </View>
            <View style={styles.progressArea}>
              <ProgressBar percentage={stats.completion_percentage} />
              <Text style={styles.progressPct}>{stats.completion_percentage}%</Text>
            </View>
          </View>
        )}

        {block.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {block.tags.map((t: { id: string; name: string; color: string }) => (
              <View key={t.id} style={[styles.tag, { backgroundColor: `${t.color}20` }]}>
                <Text style={[styles.tagText, { color: t.color }]}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Exercise list */}
      <View style={styles.list}>
        {block.exercises.map((ex: ExerciseCardType) => {
          const swipeRef = React.createRef<SwipeableMethods>();
          const card = (
            <ExerciseCard
              exercise={ex}
              onUpdateSetValue={onUpdateSetValue}
              onToggleSetComplete={onToggleSetComplete}
              onAddSet={onAddSet}
              onRemoveSet={onRemoveSet}
              onUpdateExercise={onUpdateExercise}
              isActive={isActive}
            />
          );

          if (isDetailView && onDeleteExercise) {
            return (
              <ReanimatedSwipeable
                key={ex.id}
                ref={swipeRef}
                friction={2}
                rightThreshold={60}
                overshootRight={false}
                renderRightActions={(progress: SharedValue<number>) => (
                  <ExerciseDeleteAction
                    progress={progress}
                    onDelete={() => {
                      swipeRef.current?.close();
                      Alert.alert(
                        'Eliminar ejercicio',
                        `¿Seguro que quieres eliminar "${ex.name}"?\nSe borrarán todas sus series.`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: () => onDeleteExercise!(block.id, ex.id),
                          },
                        ]
                      );
                    }}
                  />
                )}
              >
                {card}
              </ReanimatedSwipeable>
            );
          }

          return <React.Fragment key={ex.id}>{card}</React.Fragment>;
        })}
        {isActive && (
          <Pressable onPress={() => onAddExercise(block.id)} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
            <Text style={styles.addBtnText}>+ Añadir ejercicio</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border.light, overflow: 'hidden', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 8 },
  stripe: { height: 3, width: '100%' },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  blockIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  blockEmoji: { fontSize: 20 },
  nameArea: { flex: 1 },
  blockName: { fontSize: Typography.size.subheading, fontWeight: Typography.weight.semibold, color: Colors.text.primary },
  nameInput: { fontSize: Typography.size.subheading, fontWeight: Typography.weight.semibold, color: Colors.text.primary, borderBottomWidth: 1.5, borderBottomColor: Colors.accent.primary, paddingVertical: 2 },
  blockMeta: { fontSize: Typography.size.micro, color: Colors.text.tertiary, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  statsLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stat: { alignItems: 'center', gap: 2, minWidth: 44 },
  statVal: { fontSize: Typography.size.body, fontWeight: Typography.weight.semibold, color: Colors.text.primary },
  statLabel: { fontSize: 10, fontWeight: Typography.weight.medium, color: Colors.text.tertiary, letterSpacing: 0.3 },
  divider: { width: 1, height: 24, backgroundColor: Colors.border.subtle },
  progressArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, maxWidth: 140, marginLeft: Spacing.lg },
  progressPct: { fontSize: Typography.size.micro, fontWeight: Typography.weight.medium, color: Colors.text.tertiary, minWidth: 30, textAlign: 'right' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  tagText: { fontSize: Typography.size.micro, fontWeight: Typography.weight.medium },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.gap.cards },
  addBtn: { paddingVertical: Spacing.md, borderWidth: 0.5, borderColor: Colors.border.subtle, borderStyle: 'dashed', borderRadius: Radius.md, alignItems: 'center' },
  addBtnPressed: { backgroundColor: Colors.background.elevated, borderColor: Colors.accent.dim },
  addBtnText: { fontSize: Typography.size.caption, fontWeight: Typography.weight.medium, color: Colors.text.disabled },
  // (legacy stubs kept to avoid TS errors if referenced elsewhere)
  exerciseRow: {},
  exerciseCardWrap: { flex: 1 },
  deleteExBtn: {},
  deleteExBtnPressed: {},
  deleteExIcon: {},
});

export default React.memo(WorkoutBlockComponent);
