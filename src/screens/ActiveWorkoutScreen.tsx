// KAIROS — Modo Sesión (scoreboard). Spec: docs/INWORKOUT_GLANCE_MODE.md.
// The screen is a glanceable marker, not a form: what to do NOW in giant type,
// one thumb-sized HECHO, rest-as-the-screen with auto-advance, and the fine
// editing (numpad + metadata) one layer down in SetCorrectionSheet.
// State routing lives in features/workout/scoreboard/machine.ts (pure, tested).
// Alert.alert preserved for exit confirmation (terminal destructive action).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, AccessibilityInfo } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon from '../components/icons/KIcon';
import PressableScale from '../components/PressableScale';
import WorkoutSpineProgress from '../components/workout/WorkoutSpineProgress';
import RestScoreboard from '../components/workout/RestScoreboard';
import GiantTarget from '../components/workout/GiantTarget';
import SetCorrectionSheet from '../components/workout/SetCorrectionSheet';
import SessionOverviewSheet from '../components/workout/SessionOverviewSheet';
import WorkoutSummary from '../components/workout/WorkoutSummary';
import PlateCalculator from '../components/workout/PlateCalculator';
import AddExerciseSheet from '../features/blocks/components/AddExerciseSheet';
import { useWorkoutStore, type WorkoutHistoryEntry } from '../store/workoutStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useLiveActivitySync } from '../lib/liveActivity/useLiveActivitySync';
import { useReadinessSnapshot } from '../lib/readiness/useReadinessSnapshot';
import { todayISO } from '../features/planner/lib/dates';
import type { RootStackParamList } from '../types/navigation';
import type { ExerciseCard, FieldValue, FieldDefinition, Discipline } from '../types/core';
import { createExerciseCard } from '../types/core';
import { Colors, Type, Spacing, Radius, FontFamily } from '../theme/tokens';
import PaperGrain from '../theme/Paper';
import { deriveScoreboardState, scoreboardStateKey } from '../features/workout/scoreboard/machine';
import {
  resolveJustCompleted,
  type JustCompletedRef,
} from '../features/workout/scoreboard/justCompleted';
import {
  formatScoreboardTarget,
  announceSetActive,
  announceRest,
  announceExerciseChange,
  announceFinished,
} from '../features/workout/scoreboard/format';
import {
  findPreviousReference,
  formatReference,
  type PreviousReference,
} from '../components/workout/lib/previousReference';
import { readExerciseHistory, suggestNextValues, inSessionWeightNudge } from '../lib/progression';
import { selectSuggestionCaption } from '../features/workout/scoreboard/selectCaption';
import {
  detectPR,
  formatPRDelta,
  PR_LABEL,
  type PRResult,
} from '../components/workout/lib/prDetection';

type Route = RouteProp<RootStackParamList, 'ActiveWorkout'>;

const SWIPE_THRESHOLD = 60;
const EMPTY_ENTERED: ReadonlySet<number> = new Set();

function fmtSessionTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// "hace 3 días" / "hace 2 sem" / "hace 1 mes". Sober, Spanish.
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

// Sober "Última · 60 kg × 8 · hace 4 días" pill — the reference the user
// glances at to decide confirm-or-correct. Hidden when no prior data exists.
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
  const reduceMotion = useReducedMotion();

  const aw = useWorkoutStore((s) => s.activeWorkout);
  const workoutHistory = useWorkoutStore((s) => s.workoutHistory);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const editCompletedSetValues = useWorkoutStore((s) => s.editCompletedSetValues);
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
  const readinessSnapshot = useReadinessSnapshot();

  // ===== bootstrap =====
  useEffect(() => {
    if (!aw || aw.blockId !== blockId) {
      startWorkout(blockId, { assignmentId, scheduledDate, source });
    }
  }, [aw, blockId, assignmentId, scheduledDate, source, startWorkout]);

  // ===== session timer =====
  // Keyed on startTime alone — keying on `aw` would tear the interval down
  // on every store mutation (each set completion).
  const sessionStartTime = aw?.startTime;
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (sessionStartTime == null) return;
    setElapsedSec(Math.floor((Date.now() - sessionStartTime) / 1000));
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStartTime]);

  // ===== layers =====
  const [summary, setSummary] = useState<WorkoutHistoryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  // Rest-state correction of the JUST-completed set (BRIEF-03). Its own draft
  // and its own sheet instance — mutually exclusive with the set-active sheet,
  // so the two modals can never coexist.
  const [restCorrection, setRestCorrection] = useState<{
    exerciseId: string;
    setId: string;
  } | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, FieldValue>>({});
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState(60);

  // Exercises the user explicitly entered (tapped "Empezar" on the change
  // interstitial). Scoped to the session by stamping startTime into the state
  // value itself — a new session simply makes the old set unreachable, so no
  // reset effect (and no setState-in-effect) is needed.
  const [enteredMark, setEnteredMark] = useState<{
    start: number | undefined;
    ids: ReadonlySet<number>;
  }>(() => ({ start: undefined, ids: EMPTY_ENTERED }));
  const entered: ReadonlySet<number> =
    enteredMark.start === sessionStartTime ? enteredMark.ids : EMPTY_ENTERED;

  // ===== current state =====
  const exercise: ExerciseCard | null = useMemo(() => {
    if (!aw) return null;
    return aw.exercises[aw.currentExerciseIndex] ?? null;
  }, [aw]);

  const currentSet = useMemo(() => {
    if (!aw || !exercise) return null;
    return exercise.sets[aw.currentSetIndex] ?? null;
  }, [aw, exercise]);

  // Previous values for the correction sheet's "Repetir anterior" affordance:
  // nearest completed earlier set in-session, else last performance in history.
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

  // The intra-session advisor's signal: the nearest completed earlier set of
  // the CURRENT exercise (same walk as `previousValues`, but keeping weight+rpe
  // instead of the values map). Never crosses an exercise boundary — the first
  // set of each exercise has no prior and therefore no nudge.
  const priorCompletedSet = useMemo<{
    weight: number | null;
    rpe: number | null | undefined;
  } | null>(() => {
    if (!aw || !exercise) return null;
    for (let i = aw.currentSetIndex - 1; i >= 0; i--) {
      const s = exercise.sets[i];
      if (s.completed) {
        const w = s.values['weight'];
        return { weight: typeof w === 'number' ? w : null, rpe: s.rpe };
      }
    }
    return null;
  }, [aw, exercise]);

  // "La serie anterior fue fácil → +2.5" — the BETWEEN-sessions heuristic
  // replayed WITHIN the session. null = no actionable signal (no RPE, in-range
  // RPE, no weight, or not a strength movement) → zero surprise.
  const inSessionNudge = useMemo(
    () =>
      exercise && priorCompletedSet
        ? inSessionWeightNudge(
            exercise.fields,
            priorCompletedSet,
            readinessSnapshot.adaptation ?? undefined,
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exercise keyed by identity; fields don't change mid-session
    [exercise?.id, priorCompletedSet, readinessSnapshot.adaptation],
  );

  // Draft values — start as the progression prefill; the correction sheet
  // writes over them. HECHO commits whatever is here (confirm-or-correct).
  // When the advisor has a nudge, the SEED carries the adjusted weight — the
  // giant target shows it and HECHO confirms it, without touching the store.
  const [draftValues, setDraftValues] = useState<Record<string, FieldValue>>({});
  useEffect(() => {
    if (!currentSet) {
      setDraftValues({});
      return;
    }
    if (inSessionNudge != null && typeof currentSet.values['weight'] === 'number') {
      setDraftValues({ ...currentSet.values, weight: inSessionNudge.nextWeight });
    } else {
      setDraftValues({ ...currentSet.values });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on set IDENTITY only; reacting to currentSet.values would clobber in-progress edits
  }, [currentSet?.id]);

  const allCompleted = useMemo(() => {
    if (!aw) return false;
    for (const ex of aw.exercises) {
      for (const s of ex.sets) if (!s.completed) return false;
    }
    return true;
  }, [aw]);

  // ===== scoreboard state (pure machine) =====
  const currentExerciseIndex = aw?.currentExerciseIndex ?? 0;
  const currentSetIndex = aw?.currentSetIndex ?? 0;
  const sbState = deriveScoreboardState({
    hasActiveWorkout: !!aw && !!exercise && !!currentSet,
    allCompleted,
    restActive: aw?.restTimer.active ?? false,
    currentExerciseIndex,
    currentSetIndex,
    hasEnteredCurrentExercise: entered.has(currentExerciseIndex),
  });
  const stateKey = scoreboardStateKey(sbState, { currentExerciseIndex, currentSetIndex });
  const resting = sbState.kind === 'resting';
  // Computed here (before the caption memo) so the precedence rule can consume
  // it: in exercise-change there is no caption. Also read in the render below.
  const changing = sbState.kind === 'exercise-change';

  // The set the user JUST finished — derived (most recent completed_at), never
  // stored, so it survives exercise boundaries and needs no migration.
  const awExercises = aw?.exercises;
  const jc = useMemo(
    () => (resting && awExercises ? resolveJustCompleted(awExercises) : null),
    [resting, awExercises],
  );

  // Kind of the just-completed set — the rest headline says WHY it's short
  // ("Descanso · calentamiento") when the finished set was a warmup (BRIEF-07).
  const jcKind =
    resting && jc && awExercises
      ? awExercises.find((e) => e.id === jc.exerciseId)?.sets.find((s) => s.id === jc.setId)?.kind
      : undefined;
  const restLabel = jcKind === 'warmup' ? 'Descanso · calentamiento' : 'Descanso';

  // Mirror the session onto the lock screen / Dynamic Island. Same machine, same
  // formatter — the phone face-up on the bench IS the scoreboard.
  useLiveActivitySync({ hasEnteredCurrentExercise: entered.has(currentExerciseIndex) });

  // The scoreboard's giant value — draft-aware so a correction shows instantly.
  const target = useMemo(() => {
    if (!exercise || !currentSet) return null;
    return formatScoreboardTarget(exercise.fields, { ...currentSet.values, ...draftValues });
  }, [exercise, currentSet, draftValues]);

  // The real progression engine's suggestion for this exercise — same source
  // as the prefilled giant number, so number and caption can never disagree.
  const suggestion = useMemo(() => {
    if (!exercise) return null;
    const hist = readExerciseHistory(workoutHistory, {
      name: exercise.name,
      libraryId: exercise.libraryId,
    });
    return suggestNextValues(exercise.fields, hist, readinessSnapshot.adaptation ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, workoutHistory.length, completedInSession, readinessSnapshot.adaptation]);

  // "Sugerido +2.5 kg · la serie anterior fue fácil" — the advisor's caption
  // wins over the between-sessions one (fresher signal). Draft-aware: the
  // moment the user edits the target, the line disappears (never call the
  // user's own number a suggestion). Precedence + the exercise-change guard now
  // live in one pure, tested place (selectCaption.ts).
  const suggestionCaption = useMemo(
    () =>
      selectSuggestionCaption({
        changing,
        inSessionNudge,
        suggestion,
        currentValues: currentSet ? { ...currentSet.values, ...draftValues } : {},
      }),
    [changing, inSessionNudge, suggestion, currentSet, draftValues],
  );

  // ===== VoiceOver: announce each state change exactly once =====
  const lastAnnouncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!aw || !exercise || !currentSet) return;
    if (lastAnnouncedRef.current === stateKey) return;
    lastAnnouncedRef.current = stateKey;
    let msg: string | null = null;
    if (sbState.kind === 'set-active') {
      msg = announceSetActive({
        setIndex: currentSetIndex + 1,
        setTotal: exercise.sets.length,
        exerciseName: exercise.name,
        target,
      });
    } else if (sbState.kind === 'resting') {
      msg = announceRest(exercise.name);
    } else if (sbState.kind === 'exercise-change') {
      msg = announceExerciseChange(exercise.name, target);
    }
    if (msg) AccessibilityInfo.announceForAccessibility(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire per stateKey transition only
  }, [stateKey]);

  useEffect(() => {
    if (summary) AccessibilityInfo.announceForAccessibility(announceFinished());
  }, [summary]);

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

  // ===== PR detection (M4-UI — preserved verbatim) =====
  const [recentPR, setRecentPR] = useState<{ setId: string; pr: PRResult } | null>(null);
  const prTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (prTimerRef.current) clearTimeout(prTimerRef.current);
    };
  }, []);

  // HECHO — one thumb. Commits the pre-filled/corrected draft as-is.
  const handleCompleteSet = useCallback(() => {
    if (!aw || !exercise || !currentSet) return;
    // impactLight on snaps per motion spec — notificationSuccess is reserved
    // for the PR milestone below.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const completedValues = { ...currentSet.values, ...draftValues };
    const pr = detectPR({
      exercise: {
        id: exercise.id,
        name: exercise.name,
        libraryId: exercise.libraryId,
        fields: exercise.fields,
      },
      values: completedValues,
      history: workoutHistory,
    });

    completeSet(exercise.id, currentSet.id, draftValues);

    if (pr) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRecentPR({ setId: currentSet.id, pr });
      AccessibilityInfo.announceForAccessibility(
        `Récord. ${PR_LABEL[pr.kind]}, ${formatPRDelta(pr)}.`,
      );
      if (prTimerRef.current) clearTimeout(prTimerRef.current);
      prTimerRef.current = setTimeout(() => setRecentPR(null), 2500);
    }
  }, [aw, exercise, currentSet, draftValues, completeSet, workoutHistory]);

  // "Empezar" on the exercise-change interstitial — Medium = confirmation.
  const handleEnterExercise = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEnteredMark((prev) => {
      const ids = new Set(prev.start === sessionStartTime ? prev.ids : EMPTY_ENTERED);
      ids.add(currentExerciseIndex);
      return { start: sessionStartTime, ids };
    });
  }, [currentExerciseIndex, sessionStartTime]);

  const openCorrection = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCorrectionOpen(true);
  }, []);

  // ===== rest-state correction of the just-completed set =====
  const openRestCorrection = useCallback((ref: JustCompletedRef) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setEditDraft({ ...ref.values });
    setRestCorrection({ exerciseId: ref.exerciseId, setId: ref.setId });
  }, []);

  const handleEditDraftChange = useCallback((fieldId: string, value: FieldValue) => {
    setEditDraft((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const closeRestCorrection = useCallback(() => {
    setRestCorrection(null);
  }, []);

  // Patch ONLY the values of the target set — completed/completed_at stay put,
  // the rest countdown keeps running and the pointer doesn't move.
  const commitRestCorrection = useCallback(() => {
    if (!restCorrection) return;
    editCompletedSetValues(restCorrection.exerciseId, restCorrection.setId, editDraft);
    setRestCorrection(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [restCorrection, editDraft, editCompletedSetValues]);

  const openOverview = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setOverviewOpen(true);
  }, []);

  // Mark the matching schedule occurrence as completed. Capture context BEFORE
  // finishWorkout() runs because that call clears activeWorkout.
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

  const handleCloseSummary = useCallback(() => {
    setSummary(null);
    nav.goBack();
  }, [nav]);

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

  // ===== swipe navigation (preserved) =====
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

  // Live lookups for the rest-correction sheet — resolved from the store copy
  // so the numpad + metadata target the exercise the ref points at, even when
  // the pointer already moved to the next exercise.
  const restCorrectionExercise = restCorrection
    ? (aw.exercises.find((e) => e.id === restCorrection.exerciseId) ?? null)
    : null;
  const restCorrectionSetIndex = restCorrectionExercise
    ? restCorrectionExercise.sets.findIndex((s) => s.id === restCorrection?.setId)
    : -1;

  // "Siguiente" peek during rest — indices already point at what comes next.
  const nextLabel =
    currentSetIndex > 0
      ? `${exercise.name} — set ${currentSetIndex + 1} de ${exercise.sets.length}`
      : exercise.name;

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

      {/* Spine progress — tap opens the full session list (one tap away). */}
      <Pressable
        onPress={openOverview}
        accessibilityRole="button"
        accessibilityLabel={`Progreso: ejercicio ${currentExerciseIndex + 1} de ${aw.exercises.length}`}
        accessibilityHint="Toca para ver la lista completa de la sesión"
        style={({ pressed }) => [styles.spineWrap, pressed && { opacity: 0.7 }]}
      >
        <WorkoutSpineProgress exercises={aw.exercises} currentIndex={currentExerciseIndex} />
      </Pressable>

      {/* Main scoreboard — crossfade between states (kept under reduce-motion). */}
      <GestureDetector gesture={swipe}>
        <View style={styles.main}>
          {resting ? (
            <Animated.View
              key={stateKey}
              entering={FadeIn.duration(180).easing(Easing.out(Easing.cubic))}
              style={styles.stateFill}
            >
              <RestScoreboard
                label={restLabel}
                durationSec={aw.restTimer.duration}
                startTime={aw.restTimer.startTime}
                onSkip={skipRest}
                onComplete={skipRest}
                onExtend={extendRest}
                nextLabel={nextLabel}
                nextTarget={target}
                currentRestSeconds={exercise.rest_seconds}
                onChangeRestSeconds={setExerciseRestForCurrent}
                justCompleted={
                  jc
                    ? {
                        label: jc.exerciseName,
                        target: formatScoreboardTarget(jc.fields, jc.values),
                        onCorrect: () => openRestCorrection(jc),
                      }
                    : undefined
                }
              />
            </Animated.View>
          ) : (
            <Animated.View
              key={stateKey}
              entering={FadeIn.duration(180).easing(Easing.out(Easing.cubic))}
              style={styles.stateFill}
            >
              <View style={styles.scoreboard}>
                <Text style={styles.eyebrow} maxFontSizeMultiplier={1.6}>
                  {changing
                    ? 'Siguiente ejercicio'
                    : `Set ${currentSetIndex + 1} de ${exercise.sets.length}`}
                </Text>
                <Text
                  style={styles.exerciseName}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={1.4}
                >
                  {exercise.name}
                </Text>
                {previousRef ? <PreviousRefPill reference={previousRef} /> : null}
                {suggestionCaption ? (
                  <Text
                    style={styles.suggested}
                    accessibilityLabel={suggestionCaption.spoken}
                    maxFontSizeMultiplier={1.6}
                  >
                    {suggestionCaption.text}
                  </Text>
                ) : null}
                <View style={styles.targetZone}>
                  <GiantTarget
                    target={target}
                    onPress={changing ? undefined : openCorrection}
                    spokenLabel={target ? target.spoken : 'sin objetivo'}
                  />
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      {/* Footer — the lower half belongs to ONE action. */}
      {!resting ? (
        <View style={styles.footer}>
          {recentPR ? (
            <Animated.View
              key={recentPR.setId}
              entering={
                reduceMotion ? undefined : FadeIn.duration(200).easing(Easing.out(Easing.cubic))
              }
              exiting={reduceMotion ? undefined : FadeOut.duration(200)}
              style={styles.prBadge}
              accessibilityRole="text"
              accessibilityLabel={`Récord: ${PR_LABEL[recentPR.pr.kind]} ${formatPRDelta(recentPR.pr)}`}
            >
              <Text style={styles.prBadgeLabel}>{PR_LABEL[recentPR.pr.kind]}</Text>
              <Text style={styles.prBadgeDot}>·</Text>
              <Text style={styles.prBadgeDelta}>{formatPRDelta(recentPR.pr)}</Text>
            </Animated.View>
          ) : null}
          {changing ? (
            <>
              {/* Cosmetic-only migration: PressableScale adds press-depth spring.
                  haptic='none' — handleEnterExercise already owns its haptic
                  (Medium); the Modo Sesión feel is unchanged. */}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Empezar ${exercise.name}`}
                onPress={handleEnterExercise}
                haptic="none"
                style={styles.heroBtn}
              >
                <Text style={styles.heroBtnText} maxFontSizeMultiplier={1.3}>
                  Empezar
                </Text>
              </PressableScale>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver lista de la sesión"
                onPress={openOverview}
                style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.ghostBtnText} maxFontSizeMultiplier={1.5}>
                  Ver sesión
                </Text>
              </Pressable>
            </>
          ) : (
            /* Cosmetic-only: press-depth spring on HECHO. haptic='none' because
               handleCompleteSet already owns its haptic (Light on commit,
               Success on PR) — no double-buzz, Modo Sesión behavior intact. */
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Hecho: completar set ${currentSetIndex + 1} de ${exercise.sets.length}`}
              accessibilityHint="Registra el set con el objetivo mostrado"
              onPress={handleCompleteSet}
              haptic="none"
              style={styles.heroBtn}
            >
              <Text style={styles.heroBtnText} maxFontSizeMultiplier={1.3}>
                HECHO
              </Text>
            </PressableScale>
          )}
        </View>
      ) : null}

      {/* Paper fibre. Modo Sesión is presented as a fullScreenModal — iOS gives it
          its own view controller ABOVE the navigator's PaperRoot, so it needs its
          own grain or it would be the one screen printed on glass. Sheets render
          after this node, so they stay crisp. */}
      <PaperGrain />

      {/* ── Layers ── */}
      <SetCorrectionSheet
        visible={correctionOpen}
        exerciseId={exercise.id}
        setId={currentSet.id}
        setIndex={currentSetIndex}
        fields={exercise.fields}
        values={draftValues}
        onChange={handleFieldChange}
        previousValues={previousValues}
        onLongPressField={handleLongPressField}
        accent={Colors.discipline[exercise.discipline] ?? Colors.ink.primary}
        tint={Colors.tint[exercise.discipline] ?? Colors.bg.elevated}
        onClose={() => setCorrectionOpen(false)}
        onCommit={() => {
          // Same commit path as the scoreboard HECHO — merge, PR, rest.
          handleCompleteSet();
          setCorrectionOpen(false);
          setCalcOpen(false);
        }}
      >
        <PlateCalculator
          visible={calcOpen}
          initialTarget={calcTarget}
          onConfirm={handleCalcConfirm}
          onClose={() => setCalcOpen(false)}
        />
      </SetCorrectionSheet>

      {/* Second, dedicated correction sheet — patches the JUST-completed set
          during rest via editCompletedSetValues (no completed_at, no restTimer,
          no pointer moves). Mutually exclusive with the sheet above, so iOS
          never sees two sibling modals. No PlateCalculator in this flow. */}
      <SetCorrectionSheet
        visible={restCorrection != null}
        exerciseId={restCorrection?.exerciseId ?? ''}
        setId={restCorrection?.setId ?? ''}
        setIndex={Math.max(0, restCorrectionSetIndex)}
        fields={restCorrectionExercise?.fields ?? []}
        values={editDraft}
        onChange={handleEditDraftChange}
        accent={
          restCorrectionExercise
            ? (Colors.discipline[restCorrectionExercise.discipline] ?? Colors.ink.primary)
            : Colors.ink.primary
        }
        tint={
          restCorrectionExercise
            ? (Colors.tint[restCorrectionExercise.discipline] ?? Colors.bg.elevated)
            : Colors.bg.elevated
        }
        onClose={closeRestCorrection}
        onCommit={commitRestCorrection}
      />

      <SessionOverviewSheet
        visible={overviewOpen}
        exercises={aw.exercises}
        currentExerciseIndex={currentExerciseIndex}
        onAddExercise={() => {
          setOverviewOpen(false);
          setShowAdd(true);
        }}
        onClose={() => setOverviewOpen(false)}
      />

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
  // Warm paper, not lab white — and still legible at 2 m: the grain costs 0.1%
  // of luminance, ink.primary on paper.base is 15.5:1 (§5.3).
  screen: {
    flex: 1,
    backgroundColor: Colors.paper.base,
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
  sessionTimer: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    letterSpacing: 0.5,
  },
  spineWrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    minHeight: 44, // HIG tap target — the strip is now a button
    justifyContent: 'center',
  },
  main: {
    flex: 1,
  },
  stateFill: {
    flex: 1,
  },
  // The scoreboard proper — everything centered, generous air, zero scroll.
  scoreboard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.tertiary,
  },
  // Fraunces headline — the exercise is the content, the content is the title.
  exerciseName: {
    ...Type.title,
    color: Colors.ink.primary,
    textAlign: 'center',
  },
  targetZone: {
    marginTop: Spacing.lg,
  },
  // "Sugerido · +2.5 kg" — sober memory caption. Deliberately NO gold: the
  // moat whispers; tertiary ink keeps the giant target as the only hero.
  suggested: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  refPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.gap.inline - 2,
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
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.gap.inline - 2,
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
  // HECHO / Empezar — ink pill (Design v2 primary; gold stays with Kai + PR),
  // sized so a shaking post-set thumb cannot miss it.
  heroBtn: {
    minHeight: 112,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.ink.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.ink.inverse,
  },
  ghostBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
});
