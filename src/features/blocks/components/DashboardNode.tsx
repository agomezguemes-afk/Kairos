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

import type { DashboardContentNode, DashboardMetric, DashboardViz } from '../../../types/content';
import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats } from '../../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface DashboardNodeProps {
  node: DashboardContentNode;
  block: WorkoutBlock;
  onUpdate: (nodeId: string, data: DashboardContentNode['data']) => void;
  onDelete: (nodeId: string) => void;
  compact?: boolean;
}

const METRIC_OPTIONS: { id: DashboardMetric; label: string; icon: keyof typeof Feather.glyphMap; unit: string }[] = [
  { id: 'total_volume', label: 'Volumen total', icon: 'bar-chart-2', unit: 'kg' },
  { id: 'completed_sets', label: 'Series completadas', icon: 'check-circle', unit: '' },
  { id: 'total_exercises', label: 'Ejercicios', icon: 'activity', unit: '' },
  { id: 'completion_pct', label: 'Progreso', icon: 'percent', unit: '%' },
  { id: 'estimated_duration', label: 'Duración estimada', icon: 'clock', unit: 'min' },
];

const VIZ_OPTIONS: { id: DashboardViz; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'counter', label: 'Contador', icon: 'hash' },
  { id: 'progress', label: 'Progreso', icon: 'pie-chart' },
  { id: 'list', label: 'Lista', icon: 'list' },
];

const TIMING_IN = { duration: 280, easing: Easing.out(Easing.cubic) };

function DashboardNodeInner({ node, block, onUpdate, onDelete, compact }: DashboardNodeProps) {
  const [showConfig, setShowConfig] = useState(false);
  const stats = useMemo(() => calculateBlockStats(block), [block]);

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

  const metricInfo = METRIC_OPTIONS.find(m => m.id === node.data.metric) ?? METRIC_OPTIONS[0];

  const value = useMemo(() => {
    switch (node.data.metric) {
      case 'total_volume': return stats.total_volume;
      case 'completed_sets': return stats.completed_sets;
      case 'total_exercises': return stats.total_exercises;
      case 'completion_pct': return stats.completion_percentage;
      case 'estimated_duration': return stats.estimated_duration;
      default: return 0;
    }
  }, [node.data.metric, stats]);

  const formattedValue = node.data.metric === 'total_volume' && value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : String(value);

  const handleSelectMetric = (metric: DashboardMetric) => {
    const label = METRIC_OPTIONS.find(m => m.id === metric)?.label ?? node.data.label;
    onUpdate(node.id, { ...node.data, metric, label });
  };

  const handleSelectViz = (viz: DashboardViz) => {
    onUpdate(node.id, { ...node.data, viz });
  };

  const renderContent = () => {
    const { viz } = node.data;
    const color = node.data.color;

    if (viz === 'counter') {
      return (
        <View style={styles.counterLayout}>
          <View style={[styles.metricIconBg, { backgroundColor: color + '18' }]}>
            <Feather name={metricInfo.icon} size={20} color={color} />
          </View>
          <View style={styles.counterText}>
            <Text style={[styles.counterValue, { color }]}>{formattedValue}</Text>
            <Text style={styles.counterUnit}>{metricInfo.unit}</Text>
          </View>
          <Text style={styles.counterLabel}>{node.data.label}</Text>
        </View>
      );
    }

    if (viz === 'progress') {
      const pct = node.data.metric === 'completion_pct' ? value : (stats.total_sets > 0 ? Math.round((stats.completed_sets / stats.total_sets) * 100) : 0);
      return (
        <View style={styles.progressLayout}>
          <Text style={styles.progressLabel}>{node.data.label}</Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
          </View>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressPct, { color }]}>{pct}%</Text>
            <Text style={styles.progressSub}>{stats.completed_sets}/{stats.total_sets} series</Text>
          </View>
        </View>
      );
    }

    // list viz
    const exercises = block.content
      .filter((n): n is Extract<typeof n, { type: 'exercise' }> => n.type === 'exercise')
      .sort((a, b) => a.order - b.order)
      .map(n => n.data.exercise);

    return (
      <View style={styles.listLayout}>
        <Text style={styles.listTitle}>{node.data.label}</Text>
        {exercises.length === 0 ? (
          <Text style={styles.listEmpty}>Sin ejercicios</Text>
        ) : (
          exercises.slice(0, 5).map(ex => {
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
        {renderContent()}
      </Pressable>

      {/* Config modal */}
      <Modal visible={showConfig} transparent animationType="none" onRequestClose={handleCloseConfig}>
        <View style={styles.configBackdrop}>
          <Animated.View style={[styles.configBackdropOverlay, configBackdropStyle]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseConfig} />
          <Animated.View style={[styles.configSheet, configSheetStyle]}>
            <View style={styles.configHandle} />
            <Text style={styles.configTitle}>Configurar widget</Text>

            <Text style={styles.configSection}>Métrica</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.configScroll}>
              {METRIC_OPTIONS.map(opt => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleSelectMetric(opt.id);
                  }}
                  style={[styles.configChip, node.data.metric === opt.id && styles.configChipActive]}
                >
                  <Feather name={opt.icon} size={14} color={node.data.metric === opt.id ? Colors.accent.primary : Colors.text.tertiary} />
                  <Text style={[styles.configChipText, node.data.metric === opt.id && styles.configChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.configSection}>Visualización</Text>
            <View style={styles.vizRow}>
              {VIZ_OPTIONS.map(opt => (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleSelectViz(opt.id);
                  }}
                  style={[styles.vizOption, node.data.viz === opt.id && styles.vizOptionActive]}
                >
                  <Feather name={opt.icon} size={20} color={node.data.viz === opt.id ? Colors.accent.primary : Colors.text.tertiary} />
                  <Text style={[styles.vizLabel, node.data.viz === opt.id && styles.vizLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

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

export default React.memo(DashboardNodeInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.warm,
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
  metricIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  counterValue: {
    fontSize: 28,
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.tracking.tight,
  },
  counterUnit: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    fontWeight: Typography.weight.medium,
  },
  counterLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Progress
  progressLayout: {
    gap: Spacing.sm,
  },
  progressLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.background.elevated,
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
    color: Colors.text.tertiary,
  },

  // List
  listLayout: {
    gap: Spacing.xs,
  },
  listTitle: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  listEmpty: {
    fontSize: Typography.size.caption,
    color: Colors.text.disabled,
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
    color: Colors.text.primary,
  },
  listStat: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    fontWeight: Typography.weight.medium,
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
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'] + 20,
    paddingTop: Spacing.md,
    ...Shadows.modal,
  },
  configHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  configTitle: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  configSection: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.bold,
    color: Colors.text.tertiary,
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
    borderColor: Colors.border.light,
    marginRight: Spacing.sm,
  },
  configChipActive: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.dim,
  },
  configChipText: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
  },
  configChipTextActive: {
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  vizRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  vizOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  vizOptionActive: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.dim,
  },
  vizLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
  vizLabelActive: {
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  configDone: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  configDoneText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.bold,
    color: Colors.text.inverse,
  },
});
