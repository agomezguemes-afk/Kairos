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
import type { RootStackParamList } from '../types/navigation';
import type { ExerciseCard, FieldValue, FieldDefinition, Discipline } from '../types/core';
import { createExerciseCard } from '../types/core';
import { Colors } from '../theme/tokens';

type Route = RouteProp<RootStackParamList, 'ActiveWorkout'>;

const BG = '#0D1117';
const TEXT_PRIMARY = Colors.text_v2.primary.dark;
const TEXT_SECONDARY = 'rgba(245,240,232,0.6)';
const TEXT_MUTED = 'rgba(245,240,232,0.4)';
const SWIPE_THRESHOLD = 60;

function fmtSessionTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutScreen() {
  const route = useRoute<Route>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { blockId } = route.params;

  const aw = useWorkoutStore((s) => s.activeWorkout);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const completeSet = useWorkoutStore((s) => s.completeSet);
  const skipRest = useWorkoutStore((s) => s.skipRest);
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
      startWorkout(blockId);
    }
  }, [aw, blockId, startWorkout]);

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

  const handleFinish = useCallback(() => {
    const s = finishWorkout();
    if (s) setSummary(s);
  }, [finishWorkout]);

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
      // auto-finish when all sets done
      const s = finishWorkout();
      if (s) setSummary(s);
    }
  }, [allCompleted, aw, summary, finishWorkout]);

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
        <WorkoutSummary entry={summary} onClose={handleCloseSummary} />
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
        <Pressable onPress={handleExit} hitSlop={10} style={styles.headerBtn}>
          <KIcon name="x" size={20} color={TEXT_PRIMARY} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {block?.name ?? 'Entrenamiento'}
          </Text>
        </View>
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
                <Pressable onPress={() => setShowAdd(true)} style={styles.addExBtn} hitSlop={6}>
                  <KIcon name="plus" size={16} color={Colors.gold[500]} />
                </Pressable>
              </View>

              <SetInput
                fields={exercise.fields}
                values={draftValues}
                onChange={handleFieldChange}
              />
            </>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Footer */}
      {!restActive && (
        <View style={styles.footer}>
          <Pressable onPress={handleCompleteSet} style={styles.cta}>
            <Text style={styles.ctaText}>Completar set</Text>
          </Pressable>
          {allCompleted && (
            <Pressable onPress={handleFinish} style={styles.finishBtn}>
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
    backgroundColor: BG,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
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
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sessionTimer: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gold[500],
    fontVariant: ['tabular-nums'],
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  exerciseHeader: {
    paddingVertical: 16,
    gap: 4,
  },
  exerciseName: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    color: TEXT_PRIMARY,
  },
  exerciseMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold[500],
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  exerciseNotes: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 4,
    lineHeight: 20,
  },
  setsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  setPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,240,232,0.03)',
  },
  setPillActive: {
    borderColor: Colors.gold[500],
    borderWidth: 1,
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  setPillDone: {
    borderColor: 'rgba(45,106,79,0.6)',
    backgroundColor: 'rgba(45,106,79,0.18)',
  },
  setPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  setPillTextOn: {
    color: TEXT_PRIMARY,
  },
  addExBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.gold[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  finishBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
});
