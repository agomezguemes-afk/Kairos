// DashboardNode — inline metric widget for a WorkoutBlock.
//
// Two scopes:
//   • Block scope — reads `calculateBlockStats(block)`. Shows total
//     volume / sets / exercises / completion / duration for the current
//     block. Default behavior.
//   • Exercise scope — reads `workoutHistory` filtered by the bound
//     exerciseId/libraryId across a lookback window (session/4w/12w/all).
//     Surfaces personal-record progression for one lift.
//
// Four visualizations: counter, progress, list, sparkline. The counter
// uses Type.numHero serif for the headline figure; sparkline uses the
// shared component from M7e. All numeric computation is delegated to
// computeDashboardValue — this component only renders.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type {
  DashboardContentNode,
  DashboardMetric,
  DashboardViz,
  DashboardLookback,
} from '../../../types/content';
import {
  EXERCISE_SCOPED_METRICS,
  isExerciseScopedMetric,
  DASHBOARD_METRIC_LABELS,
} from '../../../types/content';
import type { WorkoutBlock, ExerciseCard } from '../../../types/core';
import { useWorkoutStore } from '../../../store/workoutStore';
import { computeDashboardValue } from '../../../lib/history/dashboardValue';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';
import { Type } from '../../../theme/tokens';
import Sparkline from './tiles/Sparkline';

interface DashboardNodeProps {
  node: DashboardContentNode;
  block: WorkoutBlock;
  onUpdate: (nodeId: string, data: DashboardContentNode['data']) => void;
  onDelete: (nodeId: string) => void;
  compact?: boolean;
}

const BLOCK_METRICS: DashboardMetric[] = [
  'total_volume',
  'completed_sets',
  'total_exercises',
  'completion_pct',
  'estimated_duration',
];

const METRIC_ICONS: Record<DashboardMetric, keyof typeof Feather.glyphMap> = {
  total_volume: 'bar-chart-2',
  completed_sets: 'check-circle',
  total_exercises: 'activity',
  completion_pct: 'percent',
  estimated_duration: 'clock',
  exercise_max_weight: 'award',
  exercise_volume: 'trending-up',
  exercise_estimated_1rm: 'zap',
  exercise_freq: 'calendar',
  exercise_last_top: 'crosshair',
};

const VIZ_OPTIONS: { id: DashboardViz; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'counter',   label: 'Contador',  icon: 'hash' },
  { id: 'progress',  label: 'Progreso',  icon: 'pie-chart' },
  { id: 'list',      label: 'Lista',     icon: 'list' },
  { id: 'sparkline', label: 'Tendencia', icon: 'trending-up' },
];

const LOOKBACK_OPTIONS: { id: DashboardLookback; label: string }[] = [
  { id: 'session', label: 'Última' },
  { id: '4w',      label: '4 semanas' },
  { id: '12w',     label: '12 semanas' },
  { id: 'all',     label: 'Todo' },
];

const TIMING_IN = { duration: 280, easing: Easing.out(Easing.cubic) };

function DashboardNodeInner({ node, block, onUpdate, onDelete, compact }: DashboardNodeProps) {
  const [showConfig, setShowConfig] = useState(false);
  const workoutHistory = useWorkoutStore(s => s.workoutHistory);

  const value = useMemo(
    () => computeDashboardValue(node.data, block, workoutHistory),
    [node.data, block, workoutHistory],
  );

  const configTranslateY = useSharedValue(400);
  const configBackdropOp = useSharedValue(0);

  useEffect(() => {
    if (showConfig) {
      configBackdropOp.value = withTiming(1, TIMING_IN);
      configTranslateY.value = withTiming(0, TIMING_IN);
    }
  }, [showConfig, configBackdropOp, configTranslateY]);

  const dismissConfig = (cb?: () => void) => {
    configBackdropOp.value = withTiming(0, { duration: 200 });
    configTranslateY.value = withTiming(400, { duration: 220, easing: Easing.in(Easing.cubic) }, () => {
      if (cb) runOnJS(cb)();
    });
  };

  const handleCloseConfig = () => {
    dismissConfig(() => setShowConfig(false));
  };

  const configSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: configTranslateY.value }],
  }));

  const configBackdropStyle = useAnimatedStyle(() => ({
    opacity: configBackdropOp.value,
  }));

  const isExerciseScoped = isExerciseScopedMetric(node.data.metric);
  const blockExercises: ExerciseCard[] = useMemo(
    () => block.content
      .filter((n): n is Extract<typeof n, { type: 'exercise' }> => n.type === 'exercise')
      .sort((a, b) => a.order - b.order)
      .map(n => n.data.exercise),
    [block.content],
  );

  const handleSelectMetric = (metric: DashboardMetric) => {
    // When switching scope, drop the unrelated binding so the data model stays clean.
    const wasExercise = isExerciseScopedMetric(node.data.metric);
    const nowExercise = isExerciseScopedMetric(metric);
    const label = DASHBOARD_METRIC_LABELS[metric];
    const patch: DashboardContentNode['data'] = { ...node.data, metric, label };
    if (wasExercise && !nowExercise) {
      patch.exerciseId = undefined;
      patch.libraryId = undefined;
      patch.exerciseName = undefined;
    }
    if (nowExercise && patch.lookback == null) {
      patch.lookback = '4w';
    }
    onUpdate(node.id, patch);
  };

  const handleSelectExercise = (ex: ExerciseCard) => {
    onUpdate(node.id, {
      ...node.data,
      exerciseId: ex.id,
      libraryId: ex.libraryId,
      exerciseName: ex.name,
    });
  };

  const handleSelectLookback = (l: DashboardLookback) => {
    onUpdate(node.id, { ...node.data, lookback: l });
  };

  const handleSelectViz = (viz: DashboardViz) => {
    onUpdate(node.id, { ...node.data, viz });
  };

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowConfig(true);
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete(node.id);
        }}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        {renderViz(node.data, value, METRIC_ICONS[node.data.metric], blockExercises, !!compact)}
      </Pressable>

      {/* Config modal */}
      <Modal visible={showConfig} transparent animationType="none" onRequestClose={handleCloseConfig}>
        <View style={styles.configBackdrop}>
          <Animated.View style={[styles.configBackdropOverlay, configBackdropStyle]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseConfig} />
          <Animated.View style={[styles.configSheet, configSheetStyle]}>
            <View style={styles.configHandle} />
            <Text style={styles.configTitle}>Configurar widget</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.configSection}>Métrica del bloque</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configScroll}>
                {BLOCK_METRICS.map(metric => {
                  const active = node.data.metric === metric;
                  return (
                    <Pressable
                      key={metric}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleSelectMetric(metric);
                      }}
                      style={[styles.configChip, active && styles.configChipActive]}
                    >
                      <Feather name={METRIC_ICONS[metric]} size={13} color={active ? Colors.ink.primary : Colors.ink.tertiary} />
                      <Text style={[styles.configChipText, active && styles.configChipTextActive]}>
                        {DASHBOARD_METRIC_LABELS[metric]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.configSection}>Métrica por ejercicio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configScroll}>
                {EXERCISE_SCOPED_METRICS.map(metric => {
                  const active = node.data.metric === metric;
                  return (
                    <Pressable
                      key={metric}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleSelectMetric(metric);
                      }}
                      style={[styles.configChip, active && styles.configChipActive]}
                    >
                      <Feather name={METRIC_ICONS[metric]} size={13} color={active ? Colors.ink.primary : Colors.ink.tertiary} />
                      <Text style={[styles.configChipText, active && styles.configChipTextActive]}>
                        {DASHBOARD_METRIC_LABELS[metric]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {isExerciseScoped && (
                <>
                  <Text style={styles.configSection}>Ejercicio</Text>
                  {blockExercises.length === 0 ? (
                    <Text style={styles.configEmpty}>
                      Añade ejercicios al bloque para vincularlos
                    </Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configScroll}>
                      {blockExercises.map(ex => {
                        const active = node.data.exerciseId === ex.id;
                        return (
                          <Pressable
                            key={ex.id}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              handleSelectExercise(ex);
                            }}
                            style={[styles.configChip, active && styles.configChipActive]}
                          >
                            <Text
                              style={[styles.configChipText, active && styles.configChipTextActive]}
                              numberOfLines={1}
                            >
                              {ex.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  <Text style={styles.configSection}>Ventana</Text>
                  <View style={styles.lookbackRow}>
                    {LOOKBACK_OPTIONS.map(opt => {
                      const active = (node.data.lookback ?? '4w') === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleSelectLookback(opt.id);
                          }}
                          style={[styles.lookbackBtn, active && styles.lookbackBtnActive]}
                        >
                          <Text style={[styles.lookbackText, active && styles.lookbackTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.configSection}>Visualización</Text>
              <View style={styles.vizRow}>
                {VIZ_OPTIONS.map(opt => {
                  const active = node.data.viz === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleSelectViz(opt.id);
                      }}
                      style={[styles.vizOption, active && styles.vizOptionActive]}
                    >
                      <Feather name={opt.icon} size={18} color={active ? Colors.ink.primary : Colors.ink.tertiary} />
                      <Text style={[styles.vizLabel, active && styles.vizLabelActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable
              onPress={handleCloseConfig}
              style={styles.configDone}
            >
              <Text style={styles.configDoneText}>Listo</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Visualizations

function renderViz(
  data: DashboardContentNode['data'],
  v: ReturnType<typeof computeDashboardValue>,
  icon: keyof typeof Feather.glyphMap,
  blockExercises: ExerciseCard[],
  compact: boolean,
) {
  const accent = data.color;

  if (data.viz === 'sparkline') {
    return (
      <View style={styles.sparkLayout}>
        <View style={styles.sparkHeader}>
          <Text style={styles.sparkLabel}>{data.label}</Text>
          <Feather name={icon} size={compact ? 12 : 14} color={Colors.ink.tertiary} />
        </View>
        <View style={styles.sparkValueRow}>
          <Text style={[styles.sparkValue, compact && styles.sparkValueCompact]}>{v.formatted}</Text>
          {v.unit ? <Text style={styles.sparkUnit}>{v.unit}</Text> : null}
        </View>
        <View style={styles.sparkChart}>
          {v.sparkline.length >= 3 ? (
            <Sparkline
              data={v.sparkline}
              width={compact ? 120 : 160}
              height={compact ? 24 : 32}
            />
          ) : (
            <Text style={styles.captionFallback}>{v.caption ?? 'Sin datos suficientes'}</Text>
          )}
        </View>
        {v.caption && v.sparkline.length >= 3 ? (
          <Text style={styles.sparkCaption}>{v.caption}</Text>
        ) : null}
      </View>
    );
  }

  if (data.viz === 'progress') {
    const pct = v.progressPct ?? (v.value != null ? Math.round(v.value) : 0);
    return (
      <View style={styles.progressLayout}>
        <Text style={styles.progressLabel}>{data.label}</Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: accent }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressPct, { color: accent }]}>{pct}%</Text>
          {v.caption ? <Text style={styles.progressSub}>{v.caption}</Text> : null}
        </View>
      </View>
    );
  }

  if (data.viz === 'list') {
    return (
      <View style={styles.listLayout}>
        <Text style={styles.listTitle}>{data.label}</Text>
        {blockExercises.length === 0 ? (
          <Text style={styles.listEmpty}>Sin ejercicios</Text>
        ) : (
          blockExercises.slice(0, 5).map(ex => {
            const done = ex.sets.filter(s => s.completed).length;
            return (
              <View key={ex.id} style={styles.listRow}>
                <View style={[styles.listDot, { backgroundColor: ex.color }]} />
                <Text style={styles.listName} numberOfLines={1}>{ex.name}</Text>
                <Text style={styles.listStat}>{done}/{ex.sets.length}</Text>
              </View>
            );
          })
        )}
      </View>
    );
  }

  // counter (default)
  return (
    <View style={[styles.counterLayout, compact && styles.counterLayoutCompact]}>
      <View style={[
        styles.metricIconBg,
        compact && styles.metricIconBgCompact,
        { backgroundColor: accent + '18' },
      ]}>
        <Feather name={icon} size={compact ? 14 : 18} color={accent} />
      </View>
      <View style={styles.counterText}>
        <Text style={[styles.counterValueSerif, compact && styles.counterValueSerifCompact]}>
          {v.formatted}
        </Text>
        {v.unit ? <Text style={styles.counterUnit}>{v.unit}</Text> : null}
      </View>
      <Text style={styles.counterLabel} numberOfLines={1}>{data.label}</Text>
      {v.caption ? (
        <Text style={styles.counterCaption} numberOfLines={1}>{v.caption}</Text>
      ) : null}
    </View>
  );
}

export default React.memo(DashboardNodeInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    padding: Spacing.md,
    minWidth: 0,
    overflow: 'hidden',
    ...Shadows.subtle,
  },

  // Counter
  counterLayout: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  counterLayoutCompact: {
    paddingVertical: 2,
    gap: 4,
  },
  metricIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconBgCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  counterText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  counterValueSerif: {
    ...Type.numHero,
    fontSize: 44,
    lineHeight: 48,
    color: Colors.ink.primary,
  },
  counterValueSerifCompact: {
    fontSize: 30,
    lineHeight: 34,
  },
  counterUnit: {
    fontSize: Typography.size.caption,
    color: Colors.ink.tertiary,
    fontWeight: Typography.weight.medium,
  },
  counterLabel: {
    fontSize: Typography.size.micro,
    color: Colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  counterCaption: {
    ...Type.micro,
    color: Colors.ink.muted,
    marginTop: 2,
  },

  // Sparkline
  sparkLayout: {
    gap: 6,
  },
  sparkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkLabel: {
    ...Type.caption,
    color: Colors.ink.secondary,
    fontWeight: '600',
  },
  sparkValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sparkValue: {
    ...Type.numLarge,
    color: Colors.ink.primary,
  },
  sparkValueCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
  sparkUnit: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  sparkChart: {
    minHeight: 32,
    justifyContent: 'center',
  },
  sparkCaption: {
    ...Type.micro,
    color: Colors.ink.muted,
  },
  captionFallback: {
    ...Type.caption,
    color: Colors.ink.muted,
    fontStyle: 'italic',
  },

  // List viz
  listLayout: {
    gap: Spacing.xs,
  },
  listTitle: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.ink.secondary,
    marginBottom: Spacing.xs,
  },
  listEmpty: {
    fontSize: Typography.size.caption,
    color: Colors.ink.muted,
    fontStyle: 'italic',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  listDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listName: {
    flex: 1,
    fontSize: Typography.size.caption,
    color: Colors.ink.primary,
  },
  listStat: {
    fontSize: Typography.size.micro,
    color: Colors.ink.tertiary,
    fontWeight: Typography.weight.medium,
  },

  // Progress
  progressLayout: {
    gap: Spacing.sm,
  },
  progressLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.ink.secondary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressPct: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
  },
  progressSub: {
    fontSize: Typography.size.micro,
    color: Colors.ink.tertiary,
  },

  // Config modal
  configBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  configBackdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  configSheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'] + 20,
    paddingTop: Spacing.md,
    maxHeight: '80%',
    ...Shadows.modal,
  },
  configHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  configTitle: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.ink.primary,
    marginBottom: Spacing.sm,
  },
  configSection: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.bold,
    color: Colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  configScroll: {
    flexGrow: 0,
  },
  configChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    marginRight: Spacing.sm,
    maxWidth: 240,
  },
  configChipActive: {
    borderColor: Colors.ink.primary,
    backgroundColor: Colors.bg.elevated,
  },
  configChipText: {
    fontSize: Typography.size.caption,
    color: Colors.ink.tertiary,
  },
  configChipTextActive: {
    color: Colors.ink.primary,
    fontWeight: Typography.weight.semibold,
  },
  configEmpty: {
    fontSize: Typography.size.caption,
    color: Colors.ink.muted,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  lookbackRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  lookbackBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.hair.base,
  },
  lookbackBtnActive: {
    borderColor: Colors.ink.primary,
    backgroundColor: Colors.bg.elevated,
  },
  lookbackText: {
    fontSize: Typography.size.caption,
    color: Colors.ink.tertiary,
  },
  lookbackTextActive: {
    color: Colors.ink.primary,
    fontWeight: Typography.weight.semibold,
  },
  vizRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  vizOption: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair.base,
  },
  vizOptionActive: {
    borderColor: Colors.ink.primary,
    backgroundColor: Colors.bg.elevated,
  },
  vizLabel: {
    fontSize: Typography.size.micro,
    color: Colors.ink.tertiary,
  },
  vizLabelActive: {
    color: Colors.ink.primary,
    fontWeight: Typography.weight.semibold,
  },
  configDone: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.gold.base,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  configDoneText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.bold,
    color: Colors.ink.inverse,
  },
});
