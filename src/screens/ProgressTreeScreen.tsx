// KAIROS — Progress Tree Screen
// Displays the user's tree, progress bar, stats, and tree type selector.

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import ProgressTree from '../components/ProgressTree';
import { useTree } from '../context/TreeContext';
import type { TreeType } from '../types/tree';
import { TREE_CONFIGS } from '../types/tree';
import { getMetricValue } from '../services/treeService';
import { Colors, Typography, Spacing, Radius, Shadows, Animation } from '../theme/index';

const LEVEL_LABELS = ['Semilla', 'Brote', 'Arbusto', 'Árbol joven', 'Árbol maduro', 'Árbol legendario'];

export default function ProgressTreeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { treeType, metrics, progress, selectTreeType } = useTree();
  const [showPicker, setShowPicker] = useState(treeType === null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Ripple animation on tree tap
  const rippleScale   = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  const treeScale     = useSharedValue(1);

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  const treeScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: treeScale.value }],
  }));

  const handleTreeTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Ripple
    rippleScale.value = 0;
    rippleOpacity.value = 0.5;
    rippleScale.value   = withTiming(2.2, { duration: 700 });
    rippleOpacity.value = withTiming(0,   { duration: 700 });
    // Tree bounce
    treeScale.value = withSequence(
      withSpring(1.07, { damping: 8, stiffness: 260 }),
      withSpring(1,    { damping: 12, stiffness: 180 }),
    );
    // Tooltip
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2200);
  };

  if (showPicker || treeType === null) {
    return (
      <TreeTypePicker
        current={treeType}
        onSelect={async (type) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await selectTreeType(type);
          setShowPicker(false);
        }}
        insets={insets}
      />
    );
  }

  const config = TREE_CONFIGS[treeType];
  const metricValue = getMetricValue(treeType, metrics);
  const level = progress?.level ?? 0;
  const pct = progress?.percentToNext ?? 0;
  const nextThreshold = progress?.nextThreshold;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Tu Árbol</Text>
        <Pressable onPress={() => setShowPicker(true)} hitSlop={12}>
          <Feather name="refresh-cw" size={18} color={Colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Tree type badge */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.typeBadge}>
        <Text style={styles.typeBadgeEmoji}>{config.emoji}</Text>
        <View>
          <Text style={styles.typeBadgeName}>{config.name}</Text>
          <Text style={styles.typeBadgeSymbol}>{config.symbol}</Text>
        </View>
      </Animated.View>

      {/* Tree SVG — tappable with ripple */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.treeContainer}>
        <Pressable onPress={handleTreeTap} style={styles.treeTouchTarget}>
          {/* Ripple ring */}
          <Animated.View
            style={[
              styles.ripple,
              rippleStyle,
              { backgroundColor: Colors.accent.glow },
            ]}
          />

          {/* Tooltip */}
          {showTooltip && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.tooltip}>
              <Text style={styles.tooltipText}>{Math.round(pct)}% al siguiente nivel</Text>
            </Animated.View>
          )}

          <Animated.View style={treeScaleStyle}>
            <ProgressTree type={treeType} level={level} size={260} />
          </Animated.View>
        </Pressable>
        <Text style={styles.levelLabel}>{LEVEL_LABELS[level]}</Text>
      </Animated.View>

      {/* Progress bar */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Nivel {level}/5</Text>
          {nextThreshold != null ? (
            <Text style={styles.progressSub}>
              {formatNumber(metricValue)} / {formatNumber(nextThreshold)} {config.metricUnit}
            </Text>
          ) : (
            <Text style={styles.progressSub}>Nivel máximo alcanzado</Text>
          )}
        </View>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${pct}%` as `${number}%` },
              level >= 5 && { backgroundColor: Colors.accent.primary },
            ]}
          />
        </View>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.statsCard}>
        <Text style={styles.statsTitle}>Estadísticas</Text>
        <View style={styles.statsGrid}>
          <StatItem label="Volumen" value={formatNumber(metrics.totalVolume)} unit="kg" />
          <StatItem label="Distancia" value={formatNumber(metrics.totalDistance)} unit="km" />
          <StatItem label="Días activos" value={String(metrics.totalActiveDays)} unit="" />
          <StatItem label="Récords" value={String(metrics.totalPRs)} unit="PRs" />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ======================== TREE PICKER ========================

function TreeTypePicker({
  current,
  onSelect,
  insets,
}: {
  current: TreeType | null;
  onSelect: (t: TreeType) => void;
  insets: { top: number; bottom: number };
}) {
  const types: TreeType[] = ['oak', 'palm', 'bamboo', 'cactus'];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.pickerContent}>
        <Text style={styles.pickerTitle}>Elige tu árbol</Text>
        <Text style={styles.pickerSub}>
          Cada árbol representa un aspecto de tu progreso. ¡Crece con tus entrenamientos!
        </Text>

        <View style={styles.pickerGrid}>
          {types.map((type, i) => {
            const config = TREE_CONFIGS[type];
            const selected = current === type;
            return (
              <Animated.View key={type} entering={FadeInUp.delay(100 + i * 80).duration(350)}>
                <Pressable
                  onPress={() => onSelect(type)}
                  style={({ pressed }) => [
                    styles.pickerCard,
                    selected && styles.pickerCardSelected,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text style={styles.pickerEmoji}>{config.emoji}</Text>
                  <Text style={[styles.pickerName, selected && styles.pickerNameSelected]}>
                    {config.name}
                  </Text>
                  <Text style={styles.pickerSymbol}>{config.symbol}</Text>
                  <Text style={styles.pickerMetric}>
                    Crece con: {config.metricLabel.toLowerCase()}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ======================== STAT ITEM ========================

function StatItem({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ======================== HELPERS ========================

function formatNumber(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n * 10) / 10);
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backBtn: {
    marginRight: Spacing.md,
  },
  title: {
    flex: 1,
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },

  // Type badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.muted,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
  },
  typeBadgeEmoji: {
    fontSize: 20,
  },
  typeBadgeName: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
  },
  typeBadgeSymbol: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },

  // Tree area
  treeContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  treeTouchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  tooltip: {
    position: 'absolute',
    top: -36,
    backgroundColor: Colors.text.primary,
    borderRadius: Radius.sm,
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  tooltipText: {
    fontSize: Typography.size.micro,
    color: Colors.text.inverse,
    fontWeight: Typography.weight.semibold,
  },
  levelLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },

  // Progress
  progressCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.subtle,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  progressTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  progressSub: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.background.elevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.semantic.success,
    borderRadius: 4,
  },

  // Stats
  statsCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadows.subtle,
  },
  statsTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.accent.primary,
  },
  statUnit: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  statLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },

  // Tree picker
  pickerContent: {
    flex: 1,
    paddingHorizontal: Spacing.screen.horizontal,
    justifyContent: 'center',
  },
  pickerTitle: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  pickerSub: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
  },
  pickerGrid: {
    gap: Spacing.md,
  },
  pickerCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.subtle,
  },
  pickerCardSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.dim,
  },
  pickerEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  pickerName: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  pickerNameSelected: {
    color: Colors.accent.primary,
  },
  pickerSymbol: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  pickerMetric: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
  },
});
