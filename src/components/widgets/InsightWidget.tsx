import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import KIcon from '../icons/KIcon';
import { useWorkoutStore } from '../../store/workoutStore';
import { useTheme } from '../../theme/ThemeContext';
import { Typography, Spacing, Radius, Shadows } from '../../theme/tokens';

export default function InsightWidget() {
  const insights = useWorkoutStore((s) => s.activeInsights);
  const clearInsight = useWorkoutStore((s) => s.clearInsight);
  const { colors } = useTheme();

  const handleClose = useCallback((idx: number) => clearInsight(idx), [clearInsight]);

  if (insights.length === 0) return null;

  return (
    <View style={styles.stack} pointerEvents="box-none">
      {insights.map((text, idx) => (
        <View
          key={`${idx}-${text.slice(0, 12)}`}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.gold[500], shadowOpacity: colors.shadowOpacity },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: 'rgba(212,175,55,0.18)' }]}>
            <KIcon name="zap" size={18} color={colors.gold[500]} />
          </View>
          <Text style={[styles.text, { color: colors.text.primary }]} numberOfLines={4}>
            {text}
          </Text>
          <Pressable onPress={() => handleClose(idx)} hitSlop={10} style={styles.close}>
            <KIcon name="x" size={14} color={colors.text.muted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    ...Shadows.subtle,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
    lineHeight: Typography.body.lineHeight,
  },
  close: {
    padding: 2,
  },
});
