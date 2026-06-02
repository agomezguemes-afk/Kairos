// KAIROS — CanvasWidget
// Visual for a single block as a home-canvas widget. Three size variants
// (small/medium/large) with a unified language but different content
// density. Pure presentation — no gestures, no edit-mode logic.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats } from '../../../types/core';
import type { CanvasWidgetSize } from '../../../types/canvas';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface CanvasWidgetProps {
  block: WorkoutBlock;
  size: CanvasWidgetSize;
}

const ICON_FOR: Record<string, string> = {
  strength: '\u{1F4AA}',
  weightlifting: '\u{1F4AA}',
  running: '\u{1F3C3}',
  calisthenics: '\u{1F938}',
  mobility: '\u{1F9D8}',
  cycling: '\u{1F6B4}',
  swimming: '\u{1F3CA}',
  team_sport: '\u{26BD}',
};

function CanvasWidgetInner({ block, size }: CanvasWidgetProps) {
  const stats = React.useMemo(() => calculateBlockStats(block), [block]);
  const disciplineColor = block.color || Colors.accent.primary;
  const icon = ICON_FOR[block.icon] ?? '\u{1F3CB}';
  const hasExercises = stats.total_exercises > 0;
  const pct = stats.completion_percentage;

  return (
    <View style={[styles.shell, sizeStyles[size]]}>
      {/* Discipline strip — top edge */}
      <View style={[styles.strip, { backgroundColor: disciplineColor }]} />

      {size === 'small' ? (
        <View style={styles.smallBody}>
          <View style={[styles.iconCircle, { backgroundColor: disciplineColor + '18' }]}>
            <Text style={styles.iconEmoji}>{icon}</Text>
          </View>
          <Text style={styles.smallTitle} numberOfLines={2}>
            {block.name}
          </Text>
          {hasExercises ? (
            <Text style={styles.smallMeta}>{stats.total_exercises} ej</Text>
          ) : (
            <Text style={styles.smallMetaMuted}>Sin ejercicios</Text>
          )}
        </View>
      ) : size === 'medium' ? (
        <View style={styles.mediumBody}>
          <View style={[styles.iconCircle, { backgroundColor: disciplineColor + '18' }]}>
            <Text style={styles.iconEmoji}>{icon}</Text>
          </View>
          <View style={styles.mediumContent}>
            <Text style={styles.mediumTitle} numberOfLines={1}>
              {block.name}
            </Text>
            {hasExercises ? (
              <Text style={styles.mediumMeta} numberOfLines={1}>
                {stats.total_exercises} ej · {stats.total_sets} series
                {stats.estimated_duration > 0 ? ` · ${stats.estimated_duration}m` : ''}
              </Text>
            ) : (
              <Text style={styles.smallMetaMuted}>Sin ejercicios</Text>
            )}
            {hasExercises && stats.total_sets > 0 && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%` as `${number}%`,
                      backgroundColor: pct === 100 ? Colors.semantic.success : disciplineColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
          {block.is_favorite && <Feather name="star" size={14} color={Colors.accent.primary} />}
        </View>
      ) : (
        // large
        <View style={styles.largeBody}>
          <View style={styles.largeHeader}>
            <View style={[styles.iconCircleLg, { backgroundColor: disciplineColor + '18' }]}>
              <Text style={styles.iconEmojiLg}>{icon}</Text>
            </View>
            {block.is_favorite && <Feather name="star" size={16} color={Colors.accent.primary} />}
          </View>
          <Text style={styles.largeTitle} numberOfLines={2}>
            {block.name}
          </Text>
          {hasExercises ? (
            <>
              <Text style={styles.largeMeta}>
                {stats.total_exercises} ejercicios · {stats.total_sets} series
              </Text>
              {stats.estimated_duration > 0 && (
                <Text style={styles.largeMetaMuted}>~{stats.estimated_duration} min</Text>
              )}
              {stats.total_sets > 0 && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%` as `${number}%`,
                        backgroundColor: pct === 100 ? Colors.semantic.success : disciplineColor,
                      },
                    ]}
                  />
                </View>
              )}
            </>
          ) : (
            <Text style={styles.largeMetaMuted}>Sin ejercicios — toca para configurar</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(CanvasWidgetInner);

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.hair.base,
    overflow: 'hidden',
    ...Shadows.card,
  },
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 16 },
  iconCircleLg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmojiLg: { fontSize: 20 },

  // small (2×2): vertical stack, compact
  smallBody: {
    flex: 1,
    padding: Spacing.md,
    paddingTop: Spacing.md + 4,
    gap: 6,
  },
  smallTitle: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.ink.primary,
    lineHeight: Typography.size.caption * 1.25,
  },
  smallMeta: {
    fontSize: Typography.size.micro,
    color: Colors.ink.tertiary,
  },
  smallMetaMuted: {
    fontSize: Typography.size.micro,
    color: Colors.ink.muted,
    fontStyle: 'italic',
  },

  // medium (4×2): horizontal layout
  mediumBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    paddingTop: Spacing.md + 4,
  },
  mediumContent: { flex: 1, gap: 4 },
  mediumTitle: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.ink.primary,
  },
  mediumMeta: {
    fontSize: Typography.size.micro,
    color: Colors.ink.tertiary,
  },

  // large (4×4): full content
  largeBody: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.lg + 2,
    gap: Spacing.sm,
  },
  largeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  largeTitle: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.ink.primary,
    letterSpacing: -0.2,
  },
  largeMeta: {
    fontSize: Typography.size.caption,
    color: Colors.ink.secondary,
  },
  largeMetaMuted: {
    fontSize: Typography.size.caption,
    color: Colors.ink.muted,
  },

  progressTrack: {
    marginTop: Spacing.sm,
    height: 4,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

// Per-size shell overrides — only the corner radii hint at the size
// difference; the rest is determined by absolute positioning at the
// canvas level. Kept separate so renderer can map size → shellStyle
// without re-creating the StyleSheet.
const sizeStyles: Record<CanvasWidgetSize, object> = {
  small: { borderRadius: Radius.lg },
  medium: { borderRadius: Radius.lg },
  large: { borderRadius: Radius.lg + 2 },
};
