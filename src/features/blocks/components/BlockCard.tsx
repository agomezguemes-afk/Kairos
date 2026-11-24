import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats } from '../../../types/core';
import { Brut, Colors, Spacing } from '../../../theme/tokens';
import { BPress, BText } from '../../coach/ui/brut';

interface BlockCardProps {
  block: WorkoutBlock;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
  isHighlighted?: boolean;
}

const DISCIPLINE_CODE: Record<string, string> = {
  strength: 'FZA',
  weightlifting: 'HLT',
  running: 'RUN',
  calisthenics: 'CAL',
  mobility: 'MOV',
  cycling: 'BCI',
  swimming: 'NAD',
  team_sport: 'EQP',
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'COMPLETADO',
  in_progress: 'EN PROGRESO',
  partial: 'PARCIAL',
};

function BlockCardInner({ block, index, onPress, onLongPress, isHighlighted }: BlockCardProps) {
  const highlightOpacity = useSharedValue(0);
  const stats = React.useMemo(() => calculateBlockStats(block), [block]);

  React.useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withRepeat(
        withSequence(withTiming(0.25, { duration: 400 }), withTiming(0, { duration: 400 })),
        3,
        false,
      );
    }
  }, [isHighlighted, highlightOpacity]);

  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlightOpacity.value }));

  const pct = stats.completion_percentage;
  const hasExercises = stats.total_exercises > 0;
  const disciplineColor = block.color || Brut.accent;
  const code = DISCIPLINE_CODE[block.icon ?? ''] ?? DISCIPLINE_CODE[block.discipline] ?? 'GEN';
  const status = STATUS_LABEL[block.status];

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(Brut.motion.reveal)}
      style={styles.cardWrapper}
    >
      <BPress
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onLongPress();
        }}
        delayLongPress={400}
        shadow={Brut.shadow.md}
        radius={Brut.radius.md}
        contentStyle={styles.card}
        accessibilityRole="button"
        accessibilityLabel={block.name}
      >
        <Animated.View style={[styles.highlightOverlay, highlightStyle]} pointerEvents="none" />

        <View style={styles.cardHeader}>
          <View style={[styles.code, { backgroundColor: disciplineColor }]}>
            <BText variant="monoBold" size={10} color={Brut.ink}>
              {code}
            </BText>
          </View>
          {block.is_favorite && <Feather name="star" size={14} color={Brut.ink} />}
        </View>

        <BText variant="bodyBold" size={15} numberOfLines={2} style={{ marginTop: Spacing.sm }}>
          {block.name}
        </BText>

        {hasExercises ? (
          <BText variant="mono" size={10} color={Brut.muted} style={{ marginTop: 4 }}>
            {stats.total_exercises} EJ · {stats.total_sets} SERIES
            {stats.estimated_duration > 0 ? ` · ~${stats.estimated_duration}′` : ''}
          </BText>
        ) : (
          <BText variant="mono" size={10} color={Brut.muted} style={{ marginTop: 4 }}>
            SIN EJERCICIOS
          </BText>
        )}

        <View style={{ flex: 1 }} />

        {hasExercises && stats.total_sets > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${pct}%` as `${number}%`,
                  backgroundColor: pct === 100 ? Colors.semantic.success : Brut.accent,
                },
              ]}
            />
          </View>
        )}

        {status && (
          <View
            style={[
              styles.statusBadge,
              block.status === 'completed' && { backgroundColor: Brut.accent },
            ]}
          >
            <BText variant="monoBold" size={9}>
              {status}
            </BText>
          </View>
        )}
      </BPress>
    </Animated.View>
  );
}

export default React.memo(BlockCardInner);

const styles = StyleSheet.create({
  cardWrapper: { flex: 1, padding: Spacing.gap.cards / 2 },
  card: { padding: Spacing.md, minHeight: 150, overflow: 'hidden' },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brut.accent,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
  },
  progressTrack: {
    height: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Brut.ink,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  progressFill: { height: '100%' },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Brut.ink,
  },
});
