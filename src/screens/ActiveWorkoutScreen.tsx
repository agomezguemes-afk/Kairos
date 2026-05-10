// KAIROS — Active Workout Screen (swipe-to-navigate variant)
// Spec §5.6 — migrated from dark chrome to warm off-white palette.
// Gold tokens: Colors.gold.base (was Colors.gold[500]).
// Dark surfaces (#0D1117) replaced with bg.void / bg.surface.
// Alert.alert preserved for exit confirmation (terminal destructive action).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon from '../components/icons/KIcon';
import RestTimer from '../components/workout/RestTimer';
import SetInput from '../components/workout/SetInput';
import WorkoutSummary from '../components/workout/WorkoutSummary';
import AddExerciseSheet from '../features/blocks/components/AddExerciseSheet';
import { useWorkoutStore, type WorkoutHistoryEntry } from '../store/workoutStore';
import { useScheduleStore } from '../store/scheduleStore';
import { todayISO } from '../features/planner/lib/dates';
import type { RootStackParamList } from '../types/navigation';
import type { ExerciseCard, FieldValue, FieldDefinition, Discipline } from '../types/core';
import { createExerciseCard } from '../types/core';
import { Colors, Type, Spacing, Radius, Shadows } from '../theme/tokens';

type Route = RouteProp<RootStackParamList, 'ActiveWorkout'>;

const SWIPE_THRESHOLD = 60;

function fmtSessionTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutScreen() {
  const route   = useRoute<Route>();
  const nav     = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets  = useSafeAreaInsets();
  const { blockId, assignmentId, scheduledDate, source } = route.params;

  const aw                   = useWorkoutStore((s) => s.activeWorkout);
  const workoutHistory       = useWorkoutStore((s) => s.workoutHistory);
  const startWorkout         = useWorkoutStore((s) => s.startWorkout);
  const completeSet          = useWorkoutStore((s) => s.completeSet);
  const skipRest             = useWorkoutStore((s) => s.skipRest);
  const nextExercise         = useWorkoutStore((s) => s.nextExercise);
  const previousExercise     = useWorkoutStore((s) => s.previousExercise);
  const goToSet              = useWorkoutStore((s) => s.goToSet);
  const finishWorkout        = useWorkoutStore((s) => s.finishWorkout);
  const cancelWorkout        = useWorkoutStore((s) => s.cancelWorkout);
  const appendActiveExercise = useWorkoutStore((s) => s.appendActiveExercise);
  const block = useWorkoutStore(
    useCallback((s) => s.blocks.find((b) => b.id === blockId) ?? null, [blockId]),
  );

  // ===== bootstrap =====
  useEffect(() => {
    if (!aw || aw.blockId !== blockId) {
      startWorkout(blockId, { assignmentId, scheduledDate, source });
    }
  }, [aw, blockId, assignmentId, scheduledDate, source, startWorkout]);

  // ===== session timer =====
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!aw) return;
    setElapsedSec(Math.floor((Date.now() - aw.startTime) / 1000));
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - aw.startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [aw?.startTime]);

  // ===== completion summary =====
  const [summary, setSummary] = useState<WorkoutHistoryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // ===== current state =====
  const exercise: ExerciseCard | null = useMemo(() => {
    if (!aw) return null;
    return aw.exercises[aw.currentExerciseIndex] ?? null;
  }, [aw]);

  const currentSet = useMemo(() => {
    if (!aw || !exercise) return null;
    return exercise.sets[aw.currentSetIndex] ?? null;
  }, [aw, exercise]);

  // Pick a "previous" value source for the SetInput repeat affordance:
  //   1. nearest completed set earlier in this exercise (current session), then
  //   2. the last completed set of the same exercise from history.
  const previousValues = useMemo<Record<string, FieldValue> | undefined>(() => {
    if (!aw || !exercise) return undefined;
    const idx = aw.currentSetIndex;
    for (let i = idx - 1; i >= 0; i--) {
      if (exercise.sets[i].completed) return exercise.sets[i].values;
    }
    for (const h of workoutHistory) {
      if (h.blockId !== aw.blockId) continue;
      const exHistory = h.exercises.find((e) => e.exerciseId === exercise.id);
      if (!exHistory?.performedSets) continue;
      for (let i = exHistory.performedSets.length - 1; i >= 0; i--) {
        const ps = exHistory.performedSets[i];
        if (ps.completed && (ps.weight != null || ps.reps != null)) {
          return {
            ...(ps.weight != null ? { weight: ps.weight } : {}),
            ...(ps.reps != null ? { reps: ps.reps } : {}),
          };
        }
      }
    }
    return undefined;
  }, [aw, exercise, workoutHistory]);

  const [draftValues, setDraftValues] = useState<Record<string, FieldValue>>({});

  useEffect(() => {
    if (!currentSet) {
      setDraftValues({});
      return;
    }
    setDraftValues({ ...currentSet.values });
  }, [currentSet?.id]);

  // ===== fade transition between exercises =====
  const fade    = useSharedValue(1);
  const fadedKey = useRef<string | null>(null);
  useEffect(() => {
    const key = `${aw?.currentExerciseIndex ?? -1}`;
    if (fadedKey.current === key) return;
    if (fadedKey.current === null) {
      fadedKey.current = key;
      return;
    }
    fade.value = 0;
    fade.value = withTiming(1, { duration: 150 });
    fadedKey.current = key;
  }, [aw?.currentExerciseIndex, fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // ===== handlers =====
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
            nav.goBack();
          },
        },
      ],
    );
  }, [cancelWorkout, nav]);

  const handleFieldChange = useCallback((fieldId: string, value: FieldValue) => {
    setDraftValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleCompleteSet = useCallback(() => {
    if (!aw || !exercise || !currentSet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    completeSet(exercise.id, currentSet.id, draftValues);
  }, [aw, exercise, currentSet, draftValues, completeSet]);

  // Mark the matching schedule occurrence as completed. Capture context BEFORE
  // finishWorkout() runs because that call clears activeWorkout.
  // Prefer the assignment context the session was started with (precise);
  // only fall back to the today/blockId search when started "free".
  const markScheduleComplete = useCallback((ctx: {
    blockId: string | undefined;
    assignmentId: string | undefined;
    scheduledDate: string | undefined;
  }) => {
    if (!ctx.blockId) return;
    if (ctx.assignmentId && ctx.scheduledDate) {
      useScheduleStore.getState().completeOccurrence(ctx.assignmentId, ctx.scheduledDate);
      return;
    }
    const today = todayISO();
    const resolved = useScheduleStore.getState().resolveDate(today);
    const match = resolved.find((r) => r.blockId === ctx.blockId);
    if (match) {
      useScheduleStore.getState().completeOccurrence(match.assignmentId, today);
    }
  }, []);

  const handleFinish = useCallback(() => {
    const ctx = {
      blockId:        aw?.blockId,
      assignmentId:   aw?.assignmentId,
      scheduledDate:  aw?.scheduledDate,
    };
    const s = finishWorkout();
    if (s) {
      markScheduleComplete(ctx);
      setSummary(s);
    }
  }, [aw?.blockId, aw?.assignmentId, aw?.scheduledDate, finishWorkout, markScheduleComplete]);

  const handleCloseSummary = useCallback(() => {
    setSummary(null);
    nav.goBack();
  }, [nav]);

  const allCompleted = useMemo(() => {
    if (!aw) return false;
    for (const ex of aw.exercises) {
      for (const s of ex.sets) if (!s.completed) return false;
    }
    return true;
  }, [aw]);

  useEffect(() => {
    if (allCompleted && aw && !summary) {
      const ctx = {
        blockId:       aw.blockId,
        assignmentId:  aw.assignmentId,
        scheduledDate: aw.scheduledDate,
      };
      const s = finishWorkout();
      if (s) {
        markScheduleComplete(ctx);
        setSummary(s);
      }
    }
  }, [allCompleted, aw, summary, finishWorkout, markScheduleComplete]);

  const handleAddExercise = useCallback(
    (opts: { name: string; discipline: Discipline; fields?: FieldDefinition[] }) => {
      const newEx = createExerciseCard(blockId, aw?.exercises.length ?? 0, opts.discipline, {
        name: opts.name,
        fields: opts.fields,
      });
      appendActiveExercise(newEx);
    },
    [aw, blockId, appendActiveExercise],
  );

  // ===== swipe gesture =====
  const onSwipeLeft = useCallback(() => {
    if (!aw || !exercise) return;
    const isLastSet = aw.currentSetIndex >= exercise.sets.length - 1;
    if (isLastSet) nextExercise();
    else goToSet(aw.currentSetIndex + 1);
    Haptics.selectionAsync().catch(() => {});
  }, [aw, exercise, nextExercise, goToSet]);

  const onSwipeRight = useCallback(() => {
    if (!aw) return;
    if (aw.currentSetIndex > 0) goToSet(aw.currentSetIndex - 1);
    else previousExercise();
    Haptics.selectionAsync().catch(() => {});
  }, [aw, previousExercise, goToSet]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_THRESHOLD) runOnJS(onSwipeLeft)();
      else if (e.translationX >= SWIPE_THRESHOLD) runOnJS(onSwipeRight)();
    });

  // ===== render =====
  if (summary) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <WorkoutSummary entry={summary} history={workoutHistory} onClose={handleCloseSummary} />
      </View>
    );
  }

  if (!aw || !exercise || !currentSet) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>Preparando entrenamiento...</Text>
      </View>
    );
  }

  const restActive = aw.restTimer.active;

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
            {block?.name ?? 'Entrenamiento'}
          </Text>
        </View>
        {/* Timer — single gold indicator on this screen */}
        <View style={styles.headerBtn}>
          <Text style={styles.sessionTimer}>{fmtSessionTime(elapsedSec)}</Text>
        </View>
      </View>

      {/* Main */}
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.main, fadeStyle]}>
          {restActive ? (
            <RestTimer
              durationSec={aw.restTimer.duration}
              startTime={aw.restTimer.startTime}
              onSkip={skipRest}
              onComplete={skipRest}
            />
          ) : (
            <>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName} numberOfLines={2}>
                  {exercise.name}
                </Text>
                {/* Eyebrow meta line — spec §5.3 Type.eyebrow for labels */}
                <Text style={styles.exerciseMeta}>
                  {exercise.discipline.toUpperCase()} · {aw.currentExerciseIndex + 1}/{aw.exercises.length}
                </Text>
                {exercise.notes ? (
                  <Text style={styles.exerciseNotes} numberOfLines={2}>
                    {exercise.notes}
                  </Text>
                ) : null}
              </View>

              <View style={styles.setsRow}>
                {exercise.sets.map((s, i) => {
                  const isCurrent = i === aw.currentSetIndex;
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${i + 1}${s.completed ? ', completado' : isCurrent ? ', activo' : ''}`}
                      onPress={() => goToSet(i)}
                      style={[
                        styles.setPill,
                        s.completed && styles.setPillDone,
                        isCurrent && styles.setPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.setPillText,
                          (s.completed || isCurrent) && styles.setPillTextOn,
                        ]}
                      >
                        {i + 1}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Añadir ejercicio"
                  onPress={() => setShowAdd(true)}
                  style={styles.addExBtn}
                  hitSlop={6}
                >
                  <KIcon name="plus" size={16} color={Colors.gold.base} />
                </Pressable>
              </View>

              <SetInput
                fields={exercise.fields}
                values={draftValues}
                onChange={handleFieldChange}
                previousValues={previousValues}
              />
            </>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Footer */}
      {!restActive && (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Completar set"
            onPress={handleCompleteSet}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Completar set</Text>
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
      )}

      <AddExerciseSheet
        visible={showAdd}
        blockDiscipline={block?.discipline ?? 'general'}
        onAdd={handleAddExercise}
        onClose={() => setShowAdd(false)}
      />
    </View>
  );
}

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
    minWidth: 56,
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
  // Gold timer — single accent, justified as a live status indicator
  sessionTimer: {
    ...Type.numSmall,
    color: Colors.gold.base,
    letterSpacing: 1,
  },
  main: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  exerciseHeader: {
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  // Type.title equivalent (32px serif) for exercise name
  exerciseName: {
    ...Type.title,
    color: Colors.ink.primary,
  },
  // Type.eyebrow for discipline/progress meta
  exerciseMeta: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  exerciseNotes: {
    ...Type.body,
    color: Colors.ink.tertiary,
    marginTop: Spacing.xs,
  },
  setsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  setPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.surface,
  },
  setPillActive: {
    borderColor: Colors.gold.base,
    borderWidth: 1,
    backgroundColor: Colors.gold.glow,
  },
  setPillDone: {
    borderColor: Colors.semantic.success,
    backgroundColor: Colors.semantic.successMuted,
  },
  setPillText: {
    ...Type.numSmall,
    color: Colors.ink.muted,
  },
  setPillTextOn: {
    color: Colors.ink.primary,
  },
  addExBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.gold.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  // Gold CTA — "Completar set" is a moment action (spec §4.4)
  cta: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.cardWarm,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink.primary,
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
});
