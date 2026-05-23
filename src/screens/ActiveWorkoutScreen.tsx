// KAIROS — Active Workout Screen (swipe-to-navigate variant)
// Spec §5.6 — migrated from dark chrome to warm off-white palette.
// Gold tokens: Colors.gold.base (was Colors.gold[500]).
// Dark surfaces (#0D1117) replaced with bg.void / bg.surface.
// Alert.alert preserved for exit confirmation (terminal destructive action).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  useReducedMotion,
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
import type { ExerciseCard, ExerciseSet, FieldValue, FieldDefinition, Discipline } from '../types/core';
import { createExerciseCard } from '../types/core';
import { Colors, Type, Spacing, Radius, Shadows, Animation } from '../theme/tokens';
import {
  findPreviousReference,
  formatReference,
  type PreviousReference,
} from '../components/workout/lib/previousReference';

type Route = RouteProp<RootStackParamList, 'ActiveWorkout'>;

const SWIPE_THRESHOLD = 60;

function fmtSessionTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Inline summary for completed set rows ("60 kg · 8 reps"). Walks numeric
// fields in declared order, skips empties, appends unit when present.
function formatSetSummary(set: ExerciseSet, fields: FieldDefinition[]): string {
  const parts: string[] = [];
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  for (const f of sorted) {
    const v = set.values[f.id];
    if (v == null || v === '') continue;
    parts.push(f.unit ? `${v} ${f.unit}` : String(v));
  }
  return parts.join(' · ');
}

// "hace 3 días" / "hace 2 sem" / "hace 1 mes". Sober, Spanish, no fuzzy
// "hoy" — if the user just did it today, the reference came from the
// current session anyway and the date is suppressed by the caller.
function formatRelativeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return '';
  const day = 86_400_000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return 'hoy';
  if (days === 1) return 'hace 1 día';
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'hace 1 sem';
  if (weeks < 5) return `hace ${weeks} sem`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'hace 1 mes';
  return `hace ${months} meses`;
}

// Sober "Última · 60 kg × 8 · hace 4 días" pill.
// Hidden when no prior reference is available — never render a hollow shell.
function PreviousRefPill({ reference }: { reference: PreviousReference }) {
  const formatted = formatReference(reference);
  if (!formatted) return null;
  const date =
    reference.source === 'history' && reference.performedAt
      ? formatRelativeAgo(reference.performedAt)
      : null;
  return (
    <View style={styles.refPill} accessibilityLabel={`Última vez: ${formatted}${date ? `, ${date}` : ''}`}>
      <Text style={styles.refPillLabel}>Última</Text>
      <Text style={styles.refPillDot}>·</Text>
      <Text style={styles.refPillValue}>{formatted}</Text>
      {date ? (
        <>
          <Text style={styles.refPillDot}>·</Text>
          <Text style={styles.refPillDate}>{date}</Text>
        </>
      ) : null}
    </View>
  );
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

  // "Last time you did this exercise" reference shown beneath the heading.
  // Memo key tracks history length + completed-set count so the pill refreshes
  // when a set is completed in-session without rebuilding on every keystroke.
  const completedInSession = useMemo(() => {
    if (!exercise) return 0;
    let n = 0;
    for (const s of exercise.sets) if (s.completed) n++;
    return n;
  }, [exercise]);

  const previousRef = useMemo<PreviousReference | null>(() => {
    if (!exercise) return null;
    return findPreviousReference({
      exerciseId: exercise.id,
      active: aw,
      history: workoutHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, workoutHistory.length, completedInSession]);

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
      'Salir de la sesión',
      'El progreso no se guardará.',
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

  // Total set completion across the whole workout — used by the header
  // progress bar so the user has a single, ambient sense of "how far in".
  const progressPct = useMemo(() => {
    if (!aw) return 0;
    let total = 0;
    let done = 0;
    for (const ex of aw.exercises) {
      total += ex.sets.length;
      for (const s of ex.sets) if (s.completed) done++;
    }
    return total > 0 ? done / total : 0;
  }, [aw]);

  const reducedMotion = useReducedMotion();
  const progressShared = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      progressShared.value = progressPct;
      return;
    }
    progressShared.value = withTiming(progressPct, {
      duration: Animation.duration.normal,
      easing: Easing.out(Easing.cubic),
    });
  }, [progressPct, progressShared, reducedMotion]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progressShared.value)) * 100}%`,
  }));

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
        <Text style={styles.empty}>Preparando sesión.</Text>
      </View>
    );
  }

  const restActive = aw.restTimer.active;

  const accentColor = Colors.discipline[exercise.discipline] ?? Colors.gold.base;
  const ctaLabel = allCompleted ? 'Finalizar sesión' : 'Completar set';
  const ctaOnPress = allCompleted ? handleFinish : handleCompleteSet;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header: exit · block name · elapsed timer */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salir de la sesión"
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
        </View>
        <View style={styles.headerBtn}>
          <Text
            style={styles.sessionTimer}
            accessibilityLabel={`Tiempo transcurrido ${fmtSessionTime(elapsedSec)}`}
          >
            {fmtSessionTime(elapsedSec)}
          </Text>
        </View>
      </View>

      {/* Global progress bar — 1px hairline showing total set ratio */}
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 1, now: progressPct }}
      >
        <Animated.View style={[styles.progressFill, progressBarStyle]} />
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
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Exercise heading — left-border accent in discipline color */}
              <View style={[styles.exerciseHeader, { borderLeftColor: accentColor }]}>
                <Text style={styles.exerciseMeta}>
                  Ejercicio {aw.currentExerciseIndex + 1} de {aw.exercises.length}
                </Text>
                <Text style={styles.exerciseName} numberOfLines={2}>
                  {exercise.name}
                </Text>
                {previousRef ? <PreviousRefPill reference={previousRef} /> : null}
                {exercise.notes ? (
                  <Text style={styles.exerciseNotes} numberOfLines={2}>
                    {exercise.notes}
                  </Text>
                ) : null}
              </View>

              {/* Set rows — leading dot + index, completed shows inline values,
                  active row mounts the input panel beneath. */}
              <View style={styles.setList}>
                {exercise.sets.map((s, i) => {
                  const isCurrent = i === aw.currentSetIndex;
                  const summary = s.completed
                    ? formatSetSummary(s, exercise.fields)
                    : '';
                  const a11y =
                    `Set ${i + 1}` +
                    (s.completed ? `, completado${summary ? `, ${summary}` : ''}` :
                     isCurrent  ? ', activo' : '');
                  return (
                    <View key={s.id}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={a11y}
                        onPress={() => goToSet(i)}
                        style={({ pressed }) => [
                          styles.setRow,
                          isCurrent && styles.setRowActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <View style={[
                          styles.setDot,
                          s.completed && styles.setDotDone,
                          !s.completed && isCurrent && styles.setDotActive,
                        ]} />
                        <Text style={[
                          styles.setIndex,
                          (s.completed || isCurrent) && styles.setIndexOn,
                        ]}>
                          {i + 1}
                        </Text>
                        {s.completed && summary ? (
                          <Text style={styles.setSummary} numberOfLines={1}>
                            {summary}
                          </Text>
                        ) : null}
                      </Pressable>
                      {isCurrent && !s.completed && (
                        <View style={styles.inputAttached}>
                          <SetInput
                            fields={exercise.fields}
                            values={draftValues}
                            onChange={handleFieldChange}
                            previousValues={previousValues}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Añadir ejercicio"
                  onPress={() => setShowAdd(true)}
                  style={({ pressed }) => [styles.addExRow, pressed && { opacity: 0.6 }]}
                  hitSlop={6}
                >
                  <KIcon name="plus" size={14} color={Colors.gold.deep} />
                  <Text style={styles.addExText}>Añadir ejercicio</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Footer — single primary CTA that morphs when allCompleted */}
      {!restActive && (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={ctaOnPress}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
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
  // Tabular session time — sober monospace cadence, ink primary (no gold).
  sessionTimer: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    letterSpacing: 0.5,
  },
  // Hairline progress under header — single ambient indicator of total ratio.
  progressTrack: {
    height: 1,
    backgroundColor: Colors.hair.base,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 1,
    backgroundColor: Colors.gold.base,
  },
  main: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  // 3px discipline-color stripe on the left, generous vertical padding.
  exerciseHeader: {
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    borderLeftWidth: 3,
    gap: Spacing.xs,
  },
  exerciseMeta: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  exerciseName: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
  exerciseNotes: {
    ...Type.body,
    color: Colors.ink.tertiary,
    marginTop: Spacing.xs,
  },
  // Sober "Última · 60 kg × 8 · hace 4 días" pill anchored under the
  // exercise name. Background is elevated warm-tinted so it reads as
  // reference material, not interactive UI.
  refPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginTop: Spacing.xs,
    gap: 6,
  },
  refPillLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
  refPillValue: {
    ...Type.micro,
    color: Colors.ink.secondary,
    fontVariant: ['tabular-nums'],
  },
  refPillDate: {
    ...Type.micro,
    color: Colors.ink.muted,
  },
  refPillDot: {
    ...Type.micro,
    color: Colors.ink.muted,
  },
  // Vertical list of set rows. Each row = leading dot + index + summary.
  setList: {
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  setRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.md,
  },
  setRowActive: {
    backgroundColor: Colors.bg.warm,
  },
  setDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
    backgroundColor: 'transparent',
  },
  setDotActive: {
    borderColor: Colors.gold.base,
    borderWidth: 2,
  },
  setDotDone: {
    backgroundColor: Colors.semantic.success,
    borderColor: Colors.semantic.success,
  },
  setIndex: {
    ...Type.numSmall,
    color: Colors.ink.muted,
    minWidth: 20,
  },
  setIndexOn: {
    color: Colors.ink.primary,
  },
  setSummary: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    flex: 1,
  },
  // Input panel attaches to the active set row only — no longer a separate
  // section below the pills.
  inputAttached: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  // Quiet "+" affordance, sober label.
  addExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addExText: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  // Single gold CTA — morphs label between "Completar set" and "Finalizar sesión".
  cta: {
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.cardWarm,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
});
