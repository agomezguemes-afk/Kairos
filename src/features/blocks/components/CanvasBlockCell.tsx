// KAIROS — CanvasBlockCell
// Absolutely-positioned widget on the home canvas. Handles long-press to
// enter edit mode, drag-to-move while in edit mode, and the corner badge
// that cycles widget size.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import CanvasWidget from './CanvasWidget';
import type { WorkoutBlock } from '../../../types/core';
import type { CanvasPosition, CanvasWidgetSize } from '../../../types/canvas';
import type { GridMetrics } from '../lib/canvasLayout';
import { cellToPx, pxToCell, getSpan, spanToPx } from '../lib/canvasLayout';
import { Colors, Radius } from '../../../theme/index';
import { springs } from '../../../theme/animations';

// Handlers receive the cell's own block/id so the parent can pass
// identity-stable callbacks and the React.memo below actually holds.
interface CanvasBlockCellProps {
  block: WorkoutBlock;
  position: CanvasPosition;
  metrics: GridMetrics;
  editMode: boolean;
  onOpen: (block: WorkoutBlock) => void;
  onLongPress: () => void;
  /** Called on drag release with the snapped cell coords. */
  onDrop: (blockId: string, next: CanvasPosition) => void;
  /** Called on size-badge tap to cycle small→medium→large→small. */
  onCycleSize: (block: WorkoutBlock) => void;
}

const NEXT_SIZE: Record<CanvasWidgetSize, CanvasWidgetSize> = {
  small: 'medium',
  medium: 'large',
  large: 'small',
};

function CanvasBlockCellInner({
  block,
  position,
  metrics,
  editMode,
  onOpen,
  onLongPress,
  onDrop,
  onCycleSize,
}: CanvasBlockCellProps) {
  const span = getSpan(block.size as CanvasWidgetSize);
  const { x, y } = cellToPx(position.col, position.row, metrics);
  const { width, height } = spanToPx(span, metrics);

  const translateX = useSharedValue(x);
  const translateY = useSharedValue(y);
  const widthSv = useSharedValue(width);
  const heightSv = useSharedValue(height);
  const dragging = useSharedValue(0); // 0 idle, 1 dragging
  const jiggle = useSharedValue(0); // rotation in deg
  const scale = useSharedValue(1);

  // Reflow when packed position or size changes (and we're not dragging).
  useEffect(() => {
    if (dragging.value === 1) return;
    translateX.value = withSpring(x, springs.gentle);
    translateY.value = withSpring(y, springs.gentle);
    widthSv.value = withTiming(width, { duration: 220 });
    heightSv.value = withTiming(height, { duration: 220 });
  }, [x, y, width, height, dragging, translateX, translateY, widthSv, heightSv]);

  // Jiggle while in edit mode (iOS home-screen feel). Halts in reduced-
  // motion users will still see the badge, just no oscillation.
  useEffect(() => {
    if (editMode) {
      jiggle.value = withRepeat(
        withSequence(withTiming(-0.6, { duration: 140 }), withTiming(0.6, { duration: 140 })),
        -1,
        true,
      );
    } else {
      cancelAnimation(jiggle);
      jiggle.value = withTiming(0, { duration: 120 });
    }
  }, [editMode, jiggle]);

  const longPress = Gesture.LongPress()
    .minDuration(380)
    .onStart(() => {
      runOnJS(onLongPress)();
    });

  const pan = Gesture.Pan()
    .enabled(editMode)
    .activateAfterLongPress(120)
    .onStart(() => {
      dragging.value = 1;
      cancelAnimation(jiggle);
      jiggle.value = withTiming(0, { duration: 80 });
      scale.value = withSpring(1.05, springs.bouncy);
    })
    .onUpdate((e) => {
      translateX.value = x + e.translationX;
      translateY.value = y + e.translationY;
    })
    .onEnd(() => {
      const snapped = pxToCell(translateX.value, translateY.value, span, metrics);
      dragging.value = 0;
      scale.value = withSpring(1, springs.gentle);
      runOnJS(onDrop)(block.id, snapped);
    });

  const composed = Gesture.Simultaneous(longPress, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${jiggle.value}deg` },
      { scale: scale.value },
    ],
    width: widthSv.value,
    height: heightSv.value,
    zIndex: dragging.value === 1 ? 10 : 1,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.absolute, animatedStyle]}>
        <Pressable
          onPress={editMode ? undefined : () => onOpen(block)}
          onPressIn={() => {
            if (!editMode) scale.value = withSpring(0.97, springs.tap);
          }}
          onPressOut={() => {
            if (!editMode) scale.value = withSpring(1, springs.bouncy);
          }}
          style={styles.fill}
          android_disableSound
        >
          <CanvasWidget block={block} size={block.size as CanvasWidgetSize} />

          {editMode && (
            <Pressable
              hitSlop={10}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCycleSize(block);
              }}
              style={styles.sizeBadge}
            >
              <Feather name="maximize-2" size={11} color={Colors.ink.inverse} />
              <Text style={styles.sizeBadgeText}>
                {block.size === 'small' ? 'S' : block.size === 'medium' ? 'M' : 'L'}
              </Text>
            </Pressable>
          )}

          {editMode && (
            <View style={styles.editHint} pointerEvents="none">
              <Text style={styles.editHintText}>
                Mantén pulsado para mover · toca {NEXT_SIZE[block.size as CanvasWidgetSize]}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

// Value-compare `position` (packLayout returns fresh objects every pass) so
// dragging one block doesn't re-render every sibling cell. Block objects keep
// identity in the store for untouched blocks, so reference equality is right
// for everything else.
export default React.memo(
  CanvasBlockCellInner,
  (prev, next) =>
    prev.block === next.block &&
    prev.editMode === next.editMode &&
    prev.metrics === next.metrics &&
    prev.position.col === next.position.col &&
    prev.position.row === next.position.row &&
    prev.onOpen === next.onOpen &&
    prev.onLongPress === next.onLongPress &&
    prev.onDrop === next.onDrop &&
    prev.onCycleSize === next.onCycleSize,
);

const styles = StyleSheet.create({
  absolute: { position: 'absolute', left: 0, top: 0 },
  fill: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  sizeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(28,28,30,0.78)',
  },
  sizeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.ink.inverse,
    letterSpacing: 0.3,
  },
  editHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 0.5,
    borderTopColor: Colors.hair.base,
  },
  editHintText: {
    fontSize: 9,
    textAlign: 'center',
    color: Colors.ink.muted,
    fontWeight: '500',
  },
});
