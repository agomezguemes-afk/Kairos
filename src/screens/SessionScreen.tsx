// KAIROS — Session Screen (tab variant)
// Spec §5.6 — migrated from dark chrome to warm off-white palette.
// Gold tokens: Colors.gold.base (was Colors.gold[500]).
// Dark surfaces (#0D1117, #161B22, #1C232C) replaced with bg.void / bg.surface.
// Alert.alert preserved for exit confirmation (terminal destructive action — spec §11).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';

import KIcon, { type KIconName } from '../components/icons/KIcon';
import RestTimer from '../components/workout/RestTimer';
import SetInput from '../components/workout/SetInput';
import WorkoutSummary from '../components/workout/WorkoutSummary';
import AddExerciseSheet from '../features/blocks/components/AddExerciseSheet';
import { useWorkoutStore, type WorkoutHistoryEntry } from '../store/workoutStore';
import type {
  ExerciseCard,
  FieldValue,
  FieldDefinition,
  Discipline,
} from '../types/core';
import { createExerciseCard } from '../types/core';
import type { RootStackParamList } from '../types/navigation';
import { Colors, Type, Spacing, Radius, Shadows } from '../theme/tokens';

type ScreenRoute = RouteProp<RootStackParamList, 'ActiveWorkout'>;
type DashRoute = RouteProp<{ Sesion: { blockId?: string } | undefined }, 'Sesion'>;

const DISCIPLINE_ICONS: Record<Discipline, KIconName> = {
  strength:    'barbell',
  running:     'running',
  calisthenics:'mat',
  mobility:    'mat',
  team_sport:  'zap',
  cycling:     'running',
  swimming:    'running',
  general:     'barbell',
};

function fmtSessionTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function SessionScreen() {
  const route = useRoute<ScreenRoute | DashRoute>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const awCurrent = useWorkoutStore.getState().activeWorkout;
  const blockId =
    (route.params as { blockId?: string } | undefined)?.blockId ??
    awCurrent?.blockId ??
    '';

  const aw                   = useWorkoutStore((s) => s.activeWorkout);
  const startWorkout         = useWorkoutStore((s) => s.startWorkout);
  const completeSet          = useWorkoutStore((s) => s.completeSet);
  const skipRest             = useWorkoutStore((s) => s.skipRest);
  const goToSet              = useWorkoutStore((s) => s.goToSet);
  const finishWorkout        = useWorkoutStore((s) => s.finishWorkout);
  const cancelWorkout        = useWorkoutStore((s) => s.cancelWorkout);
  const appendActiveExercise = useWorkoutStore((s) => s.appendActiveExercise);
  const reorderActiveExercises = useWorkoutStore((s) => s.reorderActiveExercises);
  const removeActiveExercise = useWorkoutStore((s) => s.removeActiveExercise);
  const setExerciseGoal      = useWorkoutStore((s) => s.setExerciseGoal);
  const block = useWorkoutStore(
    useCallback((s) => s.blocks.find((b) => b.id === blockId) ?? null, [blockId]),
  );

  // Bootstrap: ensure an active workout for this block.
  useEffect(() => {
    if (!blockId) return;
    if (!aw || aw.blockId !== blockId) {
      startWorkout(blockId);
    }
  }, [aw, blockId, startWorkout]);

  // Session timer.
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!aw) return;
    setElapsedSec(Math.floor((Date.now() - aw.startTime) / 1000));
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - aw.startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [aw?.startTime]);

  const [summary,    setSummary]  = useState<WorkoutHistoryEntry | null>(null);
  const [showAdd,    setShowAdd]  = useState(false);
  const [focusedId,  setFocusedId] = useState<string | null>(null);

  // Per-set draft values keyed by set id.
  const [drafts, setDrafts] = useState<Record<string, Record<string, FieldValue>>>({});

  const setDraftFor = useCallback(
    (setId: string, fieldId: string, value: FieldValue) => {
      setDrafts((prev) => ({
        ...prev,
        [setId]: { ...(prev[setId] ?? {}), [fieldId]: value },
      }));
    },
    [],
  );

  const handleExit = useCallback(() => {
    Alert.alert(
      'Salir del entrenamiento',
      '¿Abandonar la sesión actual? Los sets completados no se guardarán como historial.',
      [
        { text: 'Continuar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            nav.navigate('Dashboard', { screen: 'HomeTab' });
          },
        },
      ],
    );
  }, [cancelWorkout, nav]);

  const handleCompleteCurrentSet = useCallback(
    (exerciseId: string, setId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const values = drafts[setId] ?? {};
      completeSet(exerciseId, setId, values);
    },
    [completeSet, drafts],
  );

  const handleAdd = useCallback(
    (opts: { name: string; discipline: Discipline; fields?: FieldDefinition[] }) => {
      const newEx = createExerciseCard(blockId, aw?.exercises.length ?? 0, opts.discipline, {
        name: opts.name,
        fields: opts.fields,
      });
      appendActiveExercise(newEx);
    },
    [aw, blockId, appendActiveExercise],
  );

  const allCompleted = useMemo(() => {
    if (!aw || aw.exercises.length === 0) return false;
    for (const ex of aw.exercises) for (const s of ex.sets) if (!s.completed) return false;
    return true;
  }, [aw]);

  useEffect(() => {
    if (allCompleted && aw && !summary) {
      const s = finishWorkout();
      if (s) setSummary(s);
    }
  }, [allCompleted, aw, summary, finishWorkout]);

  const handleFinish = useCallback(() => {
    const s = finishWorkout();
    if (s) setSummary(s);
  }, [finishWorkout]);

  const handleCloseSummary = useCallback(() => {
    setSummary(null);
    nav.navigate('Dashboard', { screen: 'HomeTab' });
  }, [nav]);

  const exercises         = aw?.exercises ?? [];
  const focusedExercise   = focusedId ? exercises.find((e) => e.id === focusedId) ?? null : null;
  const currentExerciseId = aw?.exercises[aw.currentExerciseIndex]?.id;
  const currentSetId      = aw?.exercises[aw.currentExerciseIndex]?.sets[aw.currentSetIndex]?.id;
  const restActive        = aw?.restTimer.active === true;

  // ===== Render =====

  if (summary) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <WorkoutSummary entry={summary} onClose={handleCloseSummary} />
      </View>
    );
  }

  if (!aw || !blockId) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Sin sesión activa</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir rutina"
          onPress={() => nav.navigate('Dashboard', { screen: 'WorkoutTab' })}
          style={[styles.cta, { marginTop: Spacing.lg, paddingHorizontal: Spacing['3xl'] - 4 }]}
        >
          <Text style={styles.ctaText}>Elegir rutina</Text>
        </Pressable>
      </View>
    );
  }

  const renderCard = ({ item, drag, isActive }: RenderItemParams<ExerciseCard>) => (
    <ExerciseCardUnified
      exercise={item}
      blockId={blockId}
      isActive={item.id === currentExerciseId}
      isDragActive={isActive}
      onLongPressDrag={drag}
      restActive={item.id === currentExerciseId && restActive}
      restDuration={aw.restTimer.duration}
      restStartTime={aw.restTimer.startTime}
      onSkipRest={skipRest}
      currentSetId={item.id === currentExerciseId ? currentSetId : undefined}
      drafts={drafts}
      setDraftFor={setDraftFor}
      onCompleteSet={handleCompleteCurrentSet}
      onSelectSet={(setIndex) => {
        if (item.id === currentExerciseId) goToSet(setIndex);
      }}
      onDelete={() => {
        Alert.alert('Eliminar ejercicio', `¿Eliminar "${item.name}"?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => removeActiveExercise(item.id) },
        ]);
      }}
      onSetGoal={(goal) => setExerciseGoal(blockId, item.id, goal)}
      onFocus={() => setFocusedId(item.id)}
    />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salir del entrenamiento"
          onPress={handleExit}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <KIcon name="x" size={20} color={Colors.ink.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {block?.name ?? 'Sesión'}
          </Text>
          {/* Timer stays gold — it's the single live indicator on this screen */}
          <Text style={styles.sessionTimer}>{fmtSessionTime(elapsedSec)}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {focusedExercise ? (
        <ScrollView
          contentContainerStyle={styles.focusContainer}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la lista"
            onPress={() => setFocusedId(null)}
            hitSlop={10}
            style={styles.focusBack}
          >
            <KIcon name="x" size={16} color={Colors.ink.muted} />
            <Text style={styles.focusBackText}>Volver a la lista</Text>
          </Pressable>
          <ExerciseCardUnified
            exercise={focusedExercise}
            blockId={blockId}
            isActive={focusedExercise.id === currentExerciseId}
            isDragActive={false}
            onLongPressDrag={undefined}
            restActive={focusedExercise.id === currentExerciseId && restActive}
            restDuration={aw.restTimer.duration}
            restStartTime={aw.restTimer.startTime}
            onSkipRest={skipRest}
            currentSetId={focusedExercise.id === currentExerciseId ? currentSetId : undefined}
            drafts={drafts}
            setDraftFor={setDraftFor}
            onCompleteSet={handleCompleteCurrentSet}
            onSelectSet={(setIndex) => {
              if (focusedExercise.id === currentExerciseId) goToSet(setIndex);
            }}
            onDelete={() => removeActiveExercise(focusedExercise.id)}
            onSetGoal={(goal) => setExerciseGoal(blockId, focusedExercise.id, goal)}
            focusMode
          />
        </ScrollView>
      ) : (
        <DraggableFlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          onDragEnd={({ data }) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            reorderActiveExercises(data.map((e) => e.id));
          }}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <View style={styles.footerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Añadir ejercicio"
                onPress={() => setShowAdd(true)}
                style={styles.addBtn}
              >
                <KIcon name="plus" size={16} color={Colors.gold.base} />
                <Text style={styles.addBtnText}>Añadir ejercicio</Text>
              </Pressable>
              {allCompleted && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Finalizar entrenamiento"
                  onPress={handleFinish}
                  style={styles.finishBtn}
                >
                  <Text style={styles.finishText}>Finalizar entrenamiento</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      <AddExerciseSheet
        visible={showAdd}
        blockDiscipline={block?.discipline ?? 'general'}
        onAdd={handleAdd}
        onClose={() => setShowAdd(false)}
      />
    </View>
  );
}

// ============================ EXERCISE CARD ============================

interface CardProps {
  exercise: ExerciseCard;
  blockId: string;
  isActive: boolean;
  isDragActive: boolean;
  onLongPressDrag: (() => void) | undefined;
  restActive: boolean;
  restDuration: number;
  restStartTime: number;
  onSkipRest: () => void;
  currentSetId?: string;
  drafts: Record<string, Record<string, FieldValue>>;
  setDraftFor: (setId: string, fieldId: string, value: FieldValue) => void;
  onCompleteSet: (exerciseId: string, setId: string) => void;
  onSelectSet: (setIndex: number) => void;
  onDelete: () => void;
  onSetGoal: (goal: { goalWeight?: number; goalReps?: number }) => void;
  onFocus?: () => void;
  focusMode?: boolean;
}

const ExerciseCardUnified = React.memo(function ExerciseCardUnified({
  exercise,
  isActive,
  isDragActive,
  onLongPressDrag,
  restActive,
  restDuration,
  restStartTime,
  onSkipRest,
  currentSetId,
  drafts,
  setDraftFor,
  onCompleteSet,
  onSelectSet,
  onDelete,
  onSetGoal,
  onFocus,
  focusMode,
}: CardProps) {
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalDraft, setGoalDraft] = useState<string>(
    exercise.goalWeight !== undefined ? String(exercise.goalWeight) : '',
  );

  const completedSets = exercise.sets.filter((s) => s.completed);
  const visibleFields = useMemo(
    () =>
      exercise.fields
        .filter((f) => f.type !== 'boolean' || f.isPrimary)
        .sort((a, b) => a.order - b.order),
    [exercise.fields],
  );

  const activeSet    = currentSetId ? exercise.sets.find((s) => s.id === currentSetId) ?? null : null;
  const draftValues  = activeSet ? drafts[activeSet.id] ?? activeSet.values : {};

  const handleSaveGoal = useCallback(() => {
    const num = parseFloat(goalDraft);
    onSetGoal({ goalWeight: isNaN(num) ? undefined : num });
    setShowGoalEditor(false);
  }, [goalDraft, onSetGoal]);

  return (
    <View
      style={[
        cardStyles.card,
        isActive && cardStyles.cardActive,
        isDragActive && cardStyles.cardDragging,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ejercicio: ${exercise.name}. ${completedSets.length} de ${exercise.sets.length} sets completados`}
        onLongPress={onLongPressDrag}
        delayLongPress={250}
        onPress={onFocus}
        style={cardStyles.head}
      >
        <View style={cardStyles.iconWrap}>
          <KIcon name={DISCIPLINE_ICONS[exercise.discipline]} size={18} color={Colors.gold.base} />
        </View>
        <View style={cardStyles.headInfo}>
          <Text style={cardStyles.name} numberOfLines={1}>{exercise.name}</Text>
          <Text style={cardStyles.meta}>
            {exercise.discipline.toUpperCase()} · {completedSets.length}/{exercise.sets.length} sets
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${exercise.name}`}
          onPress={onDelete}
          hitSlop={10}
          style={cardStyles.deleteBtn}
        >
          <KIcon name="x" size={16} color={Colors.ink.muted} />
        </Pressable>
      </Pressable>

      {/* Field columns header */}
      <View style={cardStyles.colHeader}>
        <Text style={[cardStyles.colHeaderText, { width: 30 }]}>#</Text>
        {visibleFields.map((f) => (
          <Text key={f.id} style={[cardStyles.colHeaderText, cardStyles.colCell]} numberOfLines={1}>
            {f.name}{f.unit ? ` (${f.unit})` : ''}
          </Text>
        ))}
      </View>

      {/* Completed sets list */}
      <View style={cardStyles.setsList}>
        {exercise.sets.map((s, i) => {
          const isCurrent = s.id === currentSetId;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Set ${i + 1}${s.completed ? ', completado' : ''}`}
              onPress={() => onSelectSet(i)}
              style={[
                cardStyles.setRow,
                s.completed && cardStyles.setRowDone,
                isCurrent && cardStyles.setRowActive,
              ]}
            >
              <Text style={[cardStyles.setNum, { width: 30 }]}>{i + 1}</Text>
              {visibleFields.map((f) => {
                const v = s.values[f.id];
                return (
                  <Text key={f.id} style={[cardStyles.setVal, cardStyles.colCell]} numberOfLines={1}>
                    {v == null || v === '' ? '—' : String(v)}
                  </Text>
                );
              })}
            </Pressable>
          );
        })}
      </View>

      {/* Rest timer (embedded) */}
      {restActive && (
        <View style={cardStyles.restEmbed}>
          <RestTimer
            durationSec={restDuration}
            startTime={restStartTime}
            onSkip={onSkipRest}
            onComplete={onSkipRest}
          />
        </View>
      )}

      {/* Active set inputs */}
      {!restActive && isActive && activeSet && (
        <View style={cardStyles.activeSet}>
          <SetInput
            fields={exercise.fields}
            values={draftValues}
            onChange={(fid, val) => setDraftFor(activeSet.id, fid, val)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Completar set ${exercise.sets.indexOf(activeSet) + 1}`}
            onPress={() => onCompleteSet(exercise.id, activeSet.id)}
            style={cardStyles.completeBtn}
          >
            <Text style={cardStyles.completeBtnText}>
              Completar set {exercise.sets.indexOf(activeSet) + 1}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Goal row */}
      {(focusMode || isActive) && (
        <View style={cardStyles.goalRow}>
          {showGoalEditor ? (
            <View style={cardStyles.goalEditor}>
              <TextInput
                value={goalDraft}
                onChangeText={setGoalDraft}
                placeholder="Objetivo en kg"
                placeholderTextColor={Colors.ink.muted}
                keyboardType="decimal-pad"
                style={cardStyles.goalInput}
                accessibilityLabel="Objetivo de peso en kilogramos"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar objetivo"
                onPress={handleSaveGoal}
                style={cardStyles.goalSaveBtn}
              >
                <Text style={cardStyles.goalSaveText}>OK</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                exercise.goalWeight !== undefined
                  ? `Objetivo: ${exercise.goalWeight} kg. Toca para editar.`
                  : 'Definir objetivo de peso'
              }
              onPress={() => setShowGoalEditor(true)}
              style={cardStyles.goalChip}
            >
              <KIcon name="zap" size={12} color={Colors.gold.base} />
              <Text style={cardStyles.goalText}>
                {exercise.goalWeight !== undefined
                  ? `Objetivo: ${exercise.goalWeight} kg`
                  : 'Definir objetivo'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
});

// ============================ STYLES ============================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.void,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    ...Type.body,
    color: Colors.ink.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
  },
  headerBtn: {
    minWidth: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  // Timer stays gold — single live indicator on the screen (spec §5.6)
  sessionTimer: {
    ...Type.numSmall,
    color: Colors.gold.base,
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  focusContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  focusBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.xs + 2,
  },
  focusBackText: {
    ...Type.caption,
    color: Colors.ink.muted,
    fontWeight: '600',
  },
  footerActions: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  addBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.gold.light,
  },
  addBtnText: {
    ...Type.caption,
    fontWeight: '600',
    color: Colors.gold.base,
  },
  finishBtn: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.ink.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishText: {
    ...Type.caption,
    fontWeight: '700',
    color: Colors.ink.inverse,
  },
  // Gold CTA for empty state only — moment action
  cta: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink.primary,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  cardActive: {
    borderColor: Colors.gold.light,
    borderWidth: 1,
  },
  cardDragging: {
    opacity: 0.85,
    ...Shadows.elevated,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headInfo: {
    flex: 1,
  },
  name: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  meta: {
    ...Type.micro,
    color: Colors.ink.muted,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colHeader: {
    flexDirection: 'row',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
  },
  colHeaderText: {
    ...Type.micro,
    color: Colors.ink.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  colCell: {
    flex: 1,
    textAlign: 'center',
  },
  setsList: {
    gap: 2,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
    alignItems: 'center',
  },
  setRowDone: {
    backgroundColor: Colors.semantic.successMuted,
    borderRadius: Radius.xs,
  },
  setRowActive: {
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.xs,
  },
  setNum: {
    ...Type.numSmall,
    color: Colors.ink.secondary,
    textAlign: 'center',
  },
  setVal: {
    ...Type.numSmall,
    color: Colors.ink.primary,
  },
  restEmbed: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    marginTop: Spacing.xs + 2,
  },
  activeSet: {
    marginTop: Spacing.xs + 2,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    paddingBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
  },
  completeBtn: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ink.primary,
  },
  goalRow: {
    marginTop: Spacing.xs,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    backgroundColor: Colors.gold.glow,
  },
  goalText: {
    ...Type.micro,
    fontWeight: '600',
    color: Colors.gold.deep,
  },
  goalEditor: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
    alignItems: 'center',
  },
  goalInput: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    paddingHorizontal: Spacing.sm + 2,
    color: Colors.ink.primary,
    backgroundColor: Colors.bg.void,
    fontSize: 14,
  },
  goalSaveBtn: {
    paddingHorizontal: Spacing.md,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalSaveText: {
    ...Type.caption,
    fontWeight: '700',
    color: Colors.ink.primary,
  },
});
