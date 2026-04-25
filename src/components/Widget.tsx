import React, { useCallback } from 'react';
import { StyleSheet, Pressable, View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import NodeRenderer from '../features/blocks/components/NodeRenderer';
import type { WidgetData } from '../types/core';
import { useWorkoutStore } from '../store/workoutStore';
import { Colors, Radius, Shadows, Spacing, Typography } from '../theme/index';

interface WidgetProps {
  blockId: string;
  widget: WidgetData;
}

const MIN_W = 120;
const MIN_H = 80;
const MAX_W = 1200;
const MAX_H = 1600;

function WidgetInner({ blockId, widget }: WidgetProps) {
  const updatePosition = useWorkoutStore((s) => s.updateWidgetPosition);
  const updateSize = useWorkoutStore((s) => s.updateWidgetSize);
  const toggleFreeze = useWorkoutStore((s) => s.toggleWidgetFreeze);
  const removeWidget = useWorkoutStore((s) => s.removeWidget);

  const x = useSharedValue(widget.position.x);
  const y = useSharedValue(widget.position.y);
  const w = useSharedValue(widget.size.w);
  const h = useSharedValue(widget.size.h);

  React.useEffect(() => {
    x.value = widget.position.x;
    y.value = widget.position.y;
    w.value = widget.size.w;
    h.value = widget.size.h;
  }, [widget.position.x, widget.position.y, widget.size.w, widget.size.h, x, y, w, h]);

  const persistPosition = useCallback(
    (nx: number, ny: number) => updatePosition(blockId, widget.id, { x: nx, y: ny }),
    [blockId, widget.id, updatePosition],
  );
  const persistSize = useCallback(
    (nw: number, nh: number) => updateSize(blockId, widget.id, { w: nw, h: nh }),
    [blockId, widget.id, updateSize],
  );

  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const dragGesture = Gesture.Pan()
    .enabled(!widget.frozen)
    .onStart(() => {
      dragStartX.value = x.value;
      dragStartY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = dragStartX.value + e.translationX;
      y.value = dragStartY.value + e.translationY;
    })
    .onEnd(() => {
      const finalX = Math.max(0, x.value);
      const finalY = Math.max(0, y.value);
      x.value = withSpring(finalX, { damping: 20 });
      y.value = withSpring(finalY, { damping: 20 });
      runOnJS(persistPosition)(finalX, finalY);
    });

  const resizeStartW = useSharedValue(0);
  const resizeStartH = useSharedValue(0);

  const resizeGesture = Gesture.Pan()
    .enabled(!widget.frozen)
    .onStart(() => {
      resizeStartW.value = w.value;
      resizeStartH.value = h.value;
    })
    .onUpdate((e) => {
      w.value = Math.max(MIN_W, Math.min(MAX_W, resizeStartW.value + e.translationX));
      h.value = Math.max(MIN_H, Math.min(MAX_H, resizeStartH.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(persistSize)(w.value, h.value);
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    width: w.value,
    height: h.value,
    zIndex: widget.zIndex,
  }));

  const handleFreeze = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFreeze(blockId, widget.id);
  }, [blockId, widget.id, toggleFreeze]);

  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeWidget(blockId, widget.id);
  }, [blockId, widget.id, removeWidget]);

  return (
    <Animated.View style={[styles.widget, containerStyle, widget.frozen && styles.widgetFrozen]}>
      <GestureDetector gesture={dragGesture}>
        <View style={styles.handle}>
          <Feather
            name={widget.frozen ? 'lock' : 'move'}
            size={11}
            color={widget.frozen ? Colors.accent.primary : Colors.text.tertiary}
          />
          <Text style={styles.handleText} numberOfLines={1}>
            {widget.frozen ? 'Bloqueado' : 'Mover'}
          </Text>
          <View style={styles.handleActions}>
            <Pressable onPress={handleFreeze} hitSlop={8} style={styles.iconBtn}>
              <Feather
                name={widget.frozen ? 'unlock' : 'lock'}
                size={12}
                color={Colors.text.secondary}
              />
            </Pressable>
            <Pressable onPress={handleRemove} hitSlop={8} style={styles.iconBtn}>
              <Feather name="x" size={12} color={Colors.semantic.error} />
            </Pressable>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.content} pointerEvents={widget.frozen ? 'auto' : 'auto'}>
        <NodeRenderer blockId={blockId} nodeId={widget.contentNodeId} />
      </View>

      {!widget.frozen && (
        <GestureDetector gesture={resizeGesture}>
          <View style={styles.resizeHandle}>
            <Feather name="maximize-2" size={10} color={Colors.text.tertiary} />
          </View>
        </GestureDetector>
      )}
    </Animated.View>
  );
}

export default React.memo(WidgetInner);

const styles = StyleSheet.create({
  widget: {
    position: 'absolute',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.warm,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  widgetFrozen: {
    borderColor: Colors.accent.primary,
    borderWidth: 1,
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.elevated,
  },
  handleText: {
    flex: 1,
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    fontWeight: Typography.weight.medium,
  },
  handleActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: 2,
  },
  content: {
    flex: 1,
    padding: Spacing.sm,
  },
  resizeHandle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.elevated,
    borderTopLeftRadius: Radius.sm,
  },
});
