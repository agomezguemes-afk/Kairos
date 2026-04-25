// KAIROS — BlockAppIcon
// iPhone-style app icon for the blocks grid.
// Long-press triggers drag. All animations driven by the library's
// useOnCellActiveAnimation so they are perfectly in sync with the gesture.

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  interpolateColor,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { useOnCellActiveAnimation } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import type { WorkoutBlock } from '../types/core';
import { getBlockExercises } from '../types/core';
import { Colors, Typography } from '../theme/index';
import KairosIcon from './KairosIcon';

interface BlockAppIconProps {
  block: WorkoutBlock;
  size: number;
  onPress: (block: WorkoutBlock) => void;
  drag: () => void;
  isHighlighted?: boolean;
}

// iOS-feeling drag spring — snappy settle, imperceptible wobble.
const DRAG_SPRING: WithSpringConfig = {
  damping: 18,
  stiffness: 320,
  mass: 0.65,
};

const BlockAppIcon: React.FC<BlockAppIconProps> = ({
  block,
  size,
  onPress,
  drag,
  isHighlighted = false,
}) => {
  // Provided by the library's CellProvider — animates 0 → 1 while dragging.
  const { onActiveAnim } = useOnCellActiveAnimation({
    animationConfig: DRAG_SPRING,
  });

  // Separate shared value for tap press feedback.
  const pressScale = useSharedValue(1);

  // Highlight glow animation (0 → 1 → 0)
  const glowProgress = useSharedValue(0);

  useEffect(() => {
    if (!isHighlighted) {
      glowProgress.value = withTiming(0, { duration: 300 });
      return;
    }
    glowProgress.value = withSequence(
      withTiming(1, { duration: 350 }),
      withDelay(1000, withTiming(0, { duration: 600 })),
    );
  }, [isHighlighted]);

  // Highlight animated style — composites on top of existing styles
  const highlightStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      glowProgress.value,
      [0, 1],
      ['transparent', Colors.accent.primary],
    );
    const glowScale = interpolate(glowProgress.value, [0, 0.5, 1], [1, 1.025, 1.025]);

    return {
      borderWidth: 1.5,
      borderColor,
      shadowColor: Colors.accent.primary,
      shadowOpacity: interpolate(glowProgress.value, [0, 1], [0, 0.5]),
      shadowRadius: interpolate(glowProgress.value, [0, 1], [0, 12]),
      shadowOffset: { width: 0, height: 0 },
      elevation: interpolate(glowProgress.value, [0, 1], [0, 8]),
      transform: [{ scale: glowScale }],
    };
  });

  // Combined wrapper animation: scale + slight tilt while dragging.
  const wrapperStyle = useAnimatedStyle(() => {
    const dragScale = interpolate(onActiveAnim.value, [0, 1], [1, 1.06]);
    const rotateDeg = interpolate(onActiveAnim.value, [0, 1], [0, -1.5]);
    return {
      transform: [
        { scale: pressScale.value * dragScale },
        { rotate: `${rotateDeg}deg` },
      ],
    };
  });

  // Shadow on the icon box (needs backgroundColor to work on iOS).
  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(onActiveAnim.value, [0, 1], [0.10, 0.32]),
    shadowRadius: interpolate(onActiveAnim.value, [0, 1], [5, 20]),
  }));

  const iconSize = size - 16;
  const cornerRadius = Math.round(iconSize * 0.22);
  const emojiSize = Math.round(iconSize * 0.44);

  const { completedSets, totalSets } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of getBlockExercises(block)) {
      for (const s of ex.sets) {
        total += 1;
        if (s.completed) done += 1;
      }
    }
    return { completedSets: done, totalSets: total };
  }, [getBlockExercises(block)]);

  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  return (
    <Pressable
      onPress={() => onPress(block)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        drag();
      }}
      delayLongPress={250}
      onPressIn={() => {
        pressScale.value = withSpring(0.94, { damping: 18, stiffness: 380 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { damping: 16, stiffness: 280 });
      }}
      style={[styles.wrapper, { width: size }]}
      accessibilityLabel={block.name}
      accessibilityRole="button"
    >
      <Animated.View style={wrapperStyle}>
        {/* Icon box */}
        <Animated.View
          style={[
            styles.iconBox,
            {
              width: iconSize,
              height: iconSize,
              backgroundColor: block.color,
              borderRadius: cornerRadius,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
            },
            shadowStyle,
            highlightStyle,
          ]}
        >
          <KairosIcon name={block.icon} size={emojiSize} color="#fff" />

          {/* Progress strip at the bottom of the icon */}
          {pct > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%` as `${number}%`,
                    backgroundColor:
                      pct >= 100
                        ? Colors.semantic.success
                        : 'rgba(255,255,255,0.88)',
                  },
                ]}
              />
            </View>
          )}

          {/* Exercise-count badge */}
          {getBlockExercises(block).length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getBlockExercises(block).length}</Text>
            </View>
          )}
        </Animated.View>

        {/* Label */}
        <Text style={styles.label} numberOfLines={2}>
          {block.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    lineHeight: undefined,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  progressFill: {
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.semantic.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.background.void,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: Typography.weight.bold,
    color: Colors.text.inverse,
    lineHeight: 12,
  },
  label: {
    marginTop: 6,
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 2,
  },
});

export default React.memo(BlockAppIcon);
