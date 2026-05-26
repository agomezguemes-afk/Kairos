// KAIROS — Block completion celebration (editorial summary)
//
// Apple Fitness-style post-session moment. Replaces the older
// "trophy ring + generic encouragement" card with a warm editorial
// surface that shows:
//   • Eyebrow + block name
//   • Hero numeral (volumen total) in numHero serif
//   • Stats row: sets done, exercises, duration estimate
//   • Δ vs previous session of the same block (semantic-colored)
//   • PR list — auto-detected via detectPr against history
//   • Contextual closing line tuned to PRs / delta / first-ever
//   • Gold CTA "Continuar"
//
// Pure presentation; reads workoutHistory via the M7a indexed selectors
// so multiple-exercise PR detection is fast even with long histories.

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import ConfettiBurst, { type ConfettiRef } from './ConfettiParticles';
import type { WorkoutBlock, ExerciseCard } from '../types/core';
import { getBlockExercises } from '../types/core';
import { useWorkoutStore } from '../store/workoutStore';
import {
  estimateOneRepMax,
  detectPr,
  type ExerciseSessionPoint,
  type PrResult,
} from '../lib/history/exerciseHistory';
import { useExerciseHistoryIndex } from '../lib/history/useExerciseHistoryIndex';
import { lookupExerciseHistory } from '../lib/history/exerciseHistory';
import { formatVolume } from '../lib/stats/weekStats';
import { Colors, Type, Typography, Spacing, Radius, Shadows } from '../theme/index';
import { springs } from '../theme/animations';

interface Props {
  block: WorkoutBlock | null;
  onDismiss: () => void;
}

interface ExercisePrEntry {
  name: string;
  delta: number;
  kind: PrResult['kind'];
}

export default function CompletionCelebration({ block, onDismiss }: Props) {
  const confettiRef = useRef<ConfettiRef | null>(null);
  const cardScale   = useSharedValue(0.86);
  const cardOpacity = useSharedValue(0);

  const workoutHistory = useWorkoutStore(s => s.workoutHistory);
  const historyIndex   = useExerciseHistoryIndex();

  const summary = useMemo(() => block ? summarize(block, workoutHistory, historyIndex) : null,
    [block, workoutHistory, historyIndex]);

  useEffect(() => {
    if (!block) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    cardScale.value   = withSpring(1, springs.bouncy);
    cardOpacity.value = withTiming(1, { duration: 280 });
    const t = setTimeout(() => confettiRef.current?.burst(), 180);
    return () => clearTimeout(t);
  }, [block]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity:   cardOpacity.value,
  }));

  if (!block || !summary) return null;
  const { volume, sets, exercises, durationMin, volumeDelta, prs, closing } = summary;

  return (
    <Modal
      visible={!!block}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <ConfettiBurst confettiRef={confettiRef} />

        <Animated.View style={[styles.card, cardStyle]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>Sesión completada</Text>
            <Text style={styles.blockName} numberOfLines={2}>{block.name}</Text>

            {/* Hero volume */}
            <Animated.View entering={FadeIn.delay(180).duration(320)} style={styles.heroRow}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroValue}>
                  {volume > 0 ? formatVolume(volume) : '—'}
                </Text>
                {volume > 0 && <Text style={styles.heroUnit}>kg</Text>}
              </View>
              <Text style={styles.heroLabel}>volumen total</Text>
            </Animated.View>

            {/* Stat row */}
            <Animated.View entering={FadeIn.delay(260).duration(320)} style={styles.statRow}>
              <StatBlock value={String(sets)} label={sets === 1 ? 'serie' : 'series'} />
              <StatDivider />
              <StatBlock value={String(exercises)} label={exercises === 1 ? 'ejercicio' : 'ejercicios'} />
              <StatDivider />
              <StatBlock value={`${durationMin}`} label="min" />
            </Animated.View>

            {/* Delta vs previous */}
            {volumeDelta != null && (
              <Animated.View entering={FadeIn.delay(340).duration(320)} style={styles.deltaPill}>
                <Feather
                  name={volumeDelta >= 0 ? 'trending-up' : 'trending-down'}
                  size={13}
                  color={volumeDelta >= 0 ? Colors.semantic.success : Colors.semantic.error}
                />
                <Text style={[
                  styles.deltaText,
                  { color: volumeDelta >= 0 ? Colors.semantic.success : Colors.semantic.error },
                ]}>
                  {volumeDelta >= 0 ? '+' : '−'}{formatVolume(Math.abs(volumeDelta))} kg vs anterior
                </Text>
              </Animated.View>
            )}

            {/* PRs */}
            {prs.length > 0 && (
              <Animated.View entering={FadeIn.delay(420).duration(320)} style={styles.prSection}>
                <View style={styles.prHeader}>
                  <View style={styles.prBadge}>
                    <Feather name="award" size={11} color={Colors.gold.deep} />
                  </View>
                  <Text style={styles.prTitle}>
                    {prs.length === 1 ? 'Nuevo récord personal' : `${prs.length} récords personales`}
                  </Text>
                </View>
                {prs.slice(0, 4).map((pr, i) => (
                  <View key={pr.name + i} style={styles.prRow}>
                    <Text style={styles.prName} numberOfLines={1}>{pr.name}</Text>
                    <Text style={styles.prDelta}>{prDeltaLabel(pr)}</Text>
                  </View>
                ))}
                {prs.length > 4 && (
                  <Text style={styles.prMore}>+{prs.length - 4} más</Text>
                )}
              </Animated.View>
            )}

            {/* Closing line */}
            <Text style={styles.closing}>{closing}</Text>
          </ScrollView>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
          >
            <Text style={styles.ctaText}>Continuar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
}

function prDeltaLabel(pr: ExercisePrEntry): string {
  const sign = pr.delta > 0 ? '+' : '';
  switch (pr.kind) {
    case 'weight': return `${sign}${formatVolume(Math.abs(pr.delta))} kg`;
    case 'oneRm':  return `${sign}${formatVolume(Math.abs(pr.delta))} kg 1RM`;
    case 'volume': return `${sign}${formatVolume(Math.abs(pr.delta))} kg vol.`;
    default:       return '';
  }
}

interface Summary {
  volume: number;
  sets: number;
  exercises: number;
  durationMin: number;
  volumeDelta: number | null;
  prs: ExercisePrEntry[];
  closing: string;
}

function summarize(
  block: WorkoutBlock,
  workoutHistory: ReturnType<typeof useWorkoutStore.getState>['workoutHistory'],
  historyIndex: ReturnType<typeof useExerciseHistoryIndex>,
): Summary {
  const exercises = getBlockExercises(block);
  let totalVolume = 0;
  let completedSets = 0;
  let totalDurationEstimateMin = 0;
  const prs: ExercisePrEntry[] = [];

  for (const ex of exercises) {
    const { exVolume, exTopWeight, exTopReps } = currentSessionFor(ex);
    totalVolume += exVolume;
    completedSets += ex.sets.filter(s => s.completed).length;
    totalDurationEstimateMin += Math.round(
      (ex.sets.length * 45 + Math.max(0, ex.sets.length - 1) * ex.rest_seconds) / 60,
    );

    // PR detection against persistent history (exclude current — current
    // hasn't been written to workoutHistory yet, but defensive filter
    // inside detectPr handles the at-collision case too).
    const candidate: ExerciseSessionPoint = {
      at: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      topWeight: exTopWeight,
      topReps:   exTopReps,
      volume:    exVolume,
      setsCompleted: ex.sets.filter(s => s.completed).length,
      estimatedOneRm: estimateOneRepMax(exTopWeight, exTopReps),
      libraryId: ex.libraryId,
    };
    const history = lookupExerciseHistory(ex, historyIndex);
    if (history.length === 0 && exTopWeight == null) continue; // nothing to celebrate
    const pr = detectPr(candidate, history);
    if (pr.isPr && pr.kind && pr.delta > 0) {
      prs.push({ name: ex.name, delta: pr.delta, kind: pr.kind });
    }
  }

  // Δ vs previous session of the same block (from persisted history).
  const blockHistory = workoutHistory
    .filter(h => h.blockId === block.id)
    .sort((a, b) => b.endedAt - a.endedAt);
  const previous = blockHistory[0]; // top item — most recent persisted before this celebration
  const volumeDelta = previous && totalVolume > 0
    ? totalVolume - previous.totalVolume
    : null;

  // Closing line — contextual.
  let closing = '¡Un paso más en tu progresión!';
  if (prs.length >= 2)         closing = '¡Sesión histórica! Múltiples récords batidos.';
  else if (prs.length === 1)   closing = 'Hoy levantaste por encima de tu marca anterior.';
  else if (volumeDelta != null && volumeDelta > 0) closing = 'Volumen al alza. La constancia se nota.';
  else if (volumeDelta != null && volumeDelta < 0) closing = 'Sesión completada. El descanso también es entrenamiento.';
  else if (!previous)          closing = 'Primera sesión registrada. Esto es solo el principio.';

  return {
    volume:       Math.round(totalVolume),
    sets:         completedSets,
    exercises:    exercises.length,
    durationMin:  totalDurationEstimateMin || 0,
    volumeDelta:  volumeDelta != null ? Math.round(volumeDelta) : null,
    prs,
    closing,
  };
}

function currentSessionFor(ex: ExerciseCard): {
  exVolume: number;
  exTopWeight: number | null;
  exTopReps: number | null;
} {
  let exVolume = 0;
  let exTopWeight: number | null = null;
  let exTopReps: number | null = null;
  for (const set of ex.sets) {
    if (!set.completed) continue;
    const w = typeof set.values['weight'] === 'number' ? (set.values['weight'] as number) : null;
    const r = typeof set.values['reps']   === 'number' ? (set.values['reps']   as number) : null;
    if (w != null && r != null) exVolume += w * r;
    if (w != null && (exTopWeight == null || w > exTopWeight)) {
      exTopWeight = w;
      exTopReps   = r;
    }
  }
  return { exVolume, exTopWeight, exTopReps };
}

// ── styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: Dimensions.get('window').width - 40,
    maxHeight: Dimensions.get('window').height - 100,
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    ...Shadows.modal,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
    marginBottom: 6,
  },
  blockName: {
    ...Type.heading,
    color: Colors.ink.primary,
    marginBottom: Spacing.lg,
  },

  // Hero
  heroRow: {
    marginBottom: Spacing.lg,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroValue: {
    ...Type.numHero,
    fontSize: 64,
    lineHeight: 68,
    color: Colors.ink.primary,
  },
  heroUnit: {
    ...Type.subheading,
    color: Colors.ink.tertiary,
  },
  heroLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginTop: 2,
  },

  // Stats row
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...Type.numLarge,
    color: Colors.ink.primary,
  },
  statLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair.base,
    alignSelf: 'stretch',
    marginVertical: 6,
  },

  // Delta
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.bg.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    marginBottom: Spacing.md,
  },
  deltaText: {
    ...Type.caption,
    fontWeight: '700',
  },

  // PRs
  prSection: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold.base,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  prBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prTitle: {
    ...Type.caption,
    color: Colors.gold.deep,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: Spacing.md,
  },
  prName: {
    ...Type.body,
    color: Colors.ink.primary,
    flex: 1,
    minWidth: 0,
  },
  prDelta: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
  },
  prMore: {
    ...Type.micro,
    color: Colors.ink.muted,
    marginTop: 4,
  },

  // Closing
  closing: {
    ...Type.body,
    color: Colors.ink.secondary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },

  // CTA
  cta: {
    backgroundColor: Colors.gold.base,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  ctaText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.bold,
    color: Colors.ink.inverse,
    letterSpacing: 0.3,
  },
});
