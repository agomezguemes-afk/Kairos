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
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon from '../components/icons/KIcon';
import WorkoutSpineProgress from '../components/workout/WorkoutSpineProgress';
import RestTimer from '../components/workout/RestTimer';
import SetInput from '../components/workout/SetInput';
import WorkoutSummary from '../components/workout/WorkoutSummary';
import PlateCalculator from '../components/workout/PlateCalculator';
import SetActionSheet from '../components/workout/SetActionSheet';
import AddExerciseSheet from '../features/blocks/components/AddExerciseSheet';
import { useWorkoutStore, type WorkoutHistoryEntry } from '../store/workoutStore';
import { useScheduleStore } from '../store/scheduleStore';
import { todayISO } from '../features/planner/lib/dates';
import type { RootStackParamList } from '../types/navigation';
import type {
  ExerciseCard,
  ExerciseSet,
  FieldValue,
  FieldDefinition,
  Discipline,
} from '../types/core';
import { createExerciseCard } from '../types/core';
import { Colors, Type, Spacing, Radius, Shadows, Animation } from '../theme/tokens';
import {
  findPreviousReference,
  formatReference,
  type PreviousReference,
} from '../components/workout/lib/previousReference';
import {
  detectPR,
  formatPRDelta,
  PR_LABEL,
  type PRResult,
} from '../components/workout/lib/prDetection';

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

// Inline micro-badges for set metadata (kind/RPE/note). Rendered next to the
// values text inside the set row — kept compact so the row stays one line.
// We deliberately use single-letter pills (W/D/F) for set kind because the
// user already knows what they tagged; full labels live in the action sheet.
function SetMetadataBadges({ set }: { set: ExerciseSet }) {
  const kind = set.kind ?? 'working';
  const hasNote = !!(set.notes && set.notes.length > 0);
  const hasRpe = set.rpe != null;
  if (kind === 'working' && !hasNote && !hasRpe) return null;
  return (
    <View style={styles.badgeRow}>
      {kind === 'warmup' ? (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: Colors.semantic.info }]}>W</Text>
        </View>
      ) : null}
      {kind === 'drop' ? (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: Colors.semantic.warning }]}>D</Text>
        </View>
      ) : null}
      {kind === 'failure' ? (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: Colors.semantic.error }]}>F</Text>
        </View>
      ) : null}
      {hasRpe ? (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { color: Colors.gold.deep }]}>RPE {set.rpe}</Text>
        </View>
      ) : null}
      {hasNote ? (
        <View style={[styles.badge, styles.badgeIcon]}>
          <KIcon name="note" size={11} color={Colors.ink.tertiary} />
        </View>
      ) : null}
    </View>
  );
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
    <View
      style={styles.refPill}
      accessibilityLabel={`Última vez: ${formatted}${date ? `, ${date}` : ''}`}
    >
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
  const route = useRoute<Route>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { blockId, assignmentId, scheduledDate, source } = route.params;

  const aw = useWorkoutStore((s) => s.activeWorkout);
  const workoutHistory = useWorkoutStore((s) => s.workoutHistory);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const skipRest = useWorkoutStore((s) => s.skipRest);
  const extendRest = useWorkoutStore((s) => s.extendRest);
  const setExerciseRestForCurrent = useWorkoutStore((s) => s.setExerciseRestForCurrent);
  const nextExercise = useWorkoutStore((s) => s.nextExercise);
  const previousExercise = useWorkoutStore((s) => s.previousExercise);
  const goToSet = useWorkoutStore((s) => s.goToSet);
  const finishWorkout = useWorkoutStore((s) => s.finishWorkout);
  const cancelWorkout = useWorkoutStore((s) => s.cancelWorkout);
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

  // ===== plate calculator =====
  // Opened by long-press on the weight chip in SetInput. Confirms back into
  // draftValues['weight'] so the regular Complete Set flow handles persistence.
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState(60);

  // ===== per-set action sheet (kind/RPE/notes) =====
  // Opened by long-press on any set row. Targets a specific (exerciseId, setId).
  const [actionTarget, setActionTarget] = useState<{ exerciseId: string; setId: string } | null>(
    null,
  );

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
  //   2. the most recent performance of the same movement anywhere in history
  //      (id > libraryId > normalized name — cross-block ghosting).
  const previousValues = useMemo<Record<string, FieldValue> | undefined>(() => {
    if (!aw || !exercise) return undefined;
    const idx = aw.currentSetIndex;
    for (let i = idx - 1; i >= 0; i--) {
      if (exercise.sets[i].completed) return exercise.sets[i].values;
    }
    const ref = findPreviousReference({
      exerciseId: exercise.id,
      libraryId: exercise.libraryId,
      exerciseName: exercise.name,
      active: null,
      history: workoutHistory,
    });
    if (ref && (ref.weight != null || ref.reps != null)) {
      return {
        ...(ref.weight != null ? { weight: ref.weight } : {}),
        ...(ref.reps != null ? { reps: ref.reps } : {}),
      };
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
      libraryId: exercise.libraryId,
      exerciseName: exercise.name,
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
  const fade = useSharedValue(1);
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
    Alert.alert('Salir de la sesión', 'El progreso no se guardará.', [
      { text: 'Continuar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          cancelWorkout();
          nav.goBack();
        },
      },
    ]);
  }, [cancelWorkout, nav]);

  const handleFieldChange = useCallback((fieldId: string, value: FieldValue) => {
    setDraftValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  // Long-press on a numeric chip — open plate calculator if the field is
  // a kg-based weight field. Gated upstream of the modal so non-weight
  // fields silently ignore the gesture rather than opening an irrelevant UI.
  const handleLongPressField = useCallback((field: FieldDefinition, currentValue: number) => {
    const isWeightLike = field.id === 'weight' || field.unit === 'kg';
    if (!isWeightLike) return;
    setCalcTarget(currentValue > 0 ? currentValue : 60);
    setCalcOpen(true);
  }, []);

  const handleCalcConfirm = useCallback(
    (newTarget: number) => {
      handleFieldChange('weight', newTarget);
    },
    [handleFieldChange],
  );

  // ===== PR detection state =====
  // Floats the PR badge above the bottom CTA for 2.5s after a qualifying set.
  // setId stamp prevents an old timer dismissing a freshly-detected PR.
  const [recentPR, setRecentPR] = useState<{ setId: string; pr: PRResult } | null>(null);
  const prTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (prTimerRef.current) clearTimeout(prTimerRef.current);
    };
  }, []);

  const handleCompleteSet = useCallback(() => {
    if (!aw || !exercise || !currentSet) return;
    // impactLight on snaps per motion spec — notificationSuccess is reserved
    // for the PR milestone below.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Resolve weight/reps from the live draft (preferred) with fallback to the
    // set's persisted values — preloaded goal weights and the "Repetir anterior"
    // affordance both flow through values, so a user who taps "Complete" without
    // touching the keypad still gets PR detection.
    const w =
      typeof draftValues['weight'] === 'number'
        ? (draftValues['weight'] as number)
        : typeof currentSet.values['weight'] === 'number'
          ? (currentSet.values['weight'] as number)
          : null;
    const r =
      typeof draftValues['reps'] === 'number'
        ? (draftValues['reps'] as number)
        : typeof currentSet.values['reps'] === 'number'
          ? (currentSet.values['reps'] as number)
          : null;

    const pr = detectPR({
      exerciseId: exercise.id,
      set: { weight: w, reps: r },
      history: workoutHistory,
    });

    completeSet(exercise.id, currentSet.id, draftValues);

    if (pr) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRecentPR({ setId: currentSet.id, pr });
      if (prTimerRef.current) clearTimeout(prTimerRef.current);
      prTimerRef.current = setTimeout(() => setRecentPR(null), 2500);
    }
  }, [aw, exercise, currentSet, draftValues, completeSet, workoutHistory]);

  // Mark the matching schedule occurrence as completed. Capture context BEFORE
  // finishWorkout() runs because that call clears activeWorkout.
  // Prefer the assignment context the session was started with (precise);
  // only fall back to the today/blockId search when started "free".
  const markScheduleComplete = useCallback(
    (ctx: {
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
    },
    [],
  );

  const handleFinish = useCallback(() => {
    const ctx = {
      blockId: aw?.blockId,
      assignmentId: aw?.assignmentId,
      scheduledDate: aw?.scheduledDate,
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

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (allCompleted && aw && !summary) {
      const ctx = {
        blockId: aw.blockId,
        assignmentId: aw.assignmentId,
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

      {/* Spine progress strip — horizontal variant of the editor's vertical
          spine. Completed exercises fill solid gold, current pulses, future
          stay hollow. Replaces the prior 1px hairline progress bar. */}
      <View style={styles.spineWrap}>
        <WorkoutSpineProgress exercises={aw.exercises} currentIndex={aw.currentExerciseIndex} />
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
              onExtend={extendRest}
              currentRestSeconds={exercise.rest_seconds}
              onChangeRestSeconds={setExerciseRestForCurrent}
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
                  active row mounts the input panel beneath. Long-press opens
                  the per-set action sheet (kind / RPE / note). */}
              <View style={styles.setList}>
                {exercise.sets.map((s, i) => {
                  const isCurrent = i === aw.currentSetIndex;
                  const summary = s.completed ? formatSetSummary(s, exercise.fields) : '';
                  const kind = s.kind ?? 'working';
                  const a11yMeta =
                    (kind !== 'working' ? `, tipo ${kind}` : '') +
                    (s.rpe != null ? `, RPE ${s.rpe}` : '') +
                    (s.notes ? ', con nota' : '');
                  const a11y =
                    `Set ${i + 1}` +
                    (s.completed
                      ? `, completado${summary ? `, ${summary}` : ''}`
                      : isCurrent
                        ? ', activo'
                        : '') +
                    a11yMeta;
                  const handleSetLongPress = () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setActionTarget({ exerciseId: exercise.id, setId: s.id });
                  };
                  return (
                    <View key={s.id}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={a11y}
                        accessibilityHint="Mantén pulsado para añadir nota, RPE o tipo de set"
                        onPress={() => goToSet(i)}
                        onLongPress={handleSetLongPress}
                        delayLongPress={350}
                        style={({ pressed }) => [
                          styles.setRow,
                          isCurrent && styles.setRowActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <View
                          style={[
                            styles.setDot,
                            s.completed && styles.setDotDone,
                            !s.completed && isCurrent && styles.setDotActive,
                          ]}
                        />
                        <Text
                          style={[styles.setIndex, (s.completed || isCurrent) && styles.setIndexOn]}
                        >
                          {i + 1}
                        </Text>
                        {s.completed && summary ? (
                          <Text style={styles.setSummary} numberOfLines={1}>
                            {summary}
                          </Text>
                        ) : null}
                        <SetMetadataBadges set={s} />
                      </Pressable>
                      {isCurrent && !s.completed && (
                        <View style={styles.inputAttached}>
                          <SetInput
                            fields={exercise.fields}
                            values={draftValues}
                            onChange={handleFieldChange}
                            previousValues={previousValues}
                            onLongPressField={handleLongPressField}
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
          {recentPR ? (
            <Animated.View
              key={recentPR.setId}
              entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
              exiting={FadeOut.duration(200)}
              style={styles.prBadge}
              accessibilityRole="text"
              accessibilityLabel={`Récord: ${PR_LABEL[recentPR.pr.kind]} ${formatPRDelta(recentPR.pr)}`}
            >
              <Text style={styles.prBadgeLabel}>{PR_LABEL[recentPR.pr.kind]}</Text>
              <Text style={styles.prBadgeDot}>·</Text>
              <Text style={styles.prBadgeDelta}>{formatPRDelta(recentPR.pr)}</Text>
            </Animated.View>
          ) : null}
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

      <PlateCalculator
        visible={calcOpen}
        initialTarget={calcTarget}
        onConfirm={handleCalcConfirm}
        onClose={() => setCalcOpen(false)}
      />

      {actionTarget ? (
        <SetActionSheet
          visible
          exerciseId={actionTarget.exerciseId}
          setId={actionTarget.setId}
          onClose={() => setActionTarget(null)}
        />
      ) : null}
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
  // Spine progress strip — horizontal variant of the editor's vertical spine.
  spineWrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
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
  // Inline metadata badges row inside a set row (W/D/F pills, RPE chip, note
  // icon). Sits to the right of the values summary — micro-sized so the set
  // row stays a single visual line.
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  badge: {
    minHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  badgeText: {
    ...Type.micro,
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 12,
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
  // PR badge floats above the CTA after a qualifying set; auto-dismisses
  // after 2.5s. Sober gold-on-warm, never any exclamation marks.
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  prBadgeLabel: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
  prBadgeDelta: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  prBadgeDot: {
    ...Type.micro,
    color: Colors.gold.deep,
    opacity: 0.6,
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
