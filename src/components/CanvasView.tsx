import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

import type { CanvasSettings } from '../types/core';
import { Colors } from '../theme/index';

interface CanvasViewProps {
  width: number;
  height: number;
  settings: CanvasSettings;
  zoom?: SharedValue<number>;
  onZoomChange?: (zoom: number) => void;
  children: React.ReactNode;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

export default function CanvasView({ width, height, settings, zoom, onZoomChange, children }: CanvasViewProps) {
  const fallback = useSharedValue(settings.zoom);
  const scale = zoom ?? fallback;
  const baseScale = useSharedValue(settings.zoom);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      baseScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, baseScale.value * e.scale));
      scale.value = next;
    })
    .onEnd(() => {
      scale.value = withTiming(scale.value, { duration: 120 });
      if (onZoomChange) runOnJS(onZoomChange)(scale.value);
    });

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const grid = useMemo(() => {
    if (!settings.showGrid) return null;
    const lines: React.ReactNode[] = [];
    const step = settings.gridSize;
    const cols = Math.ceil(width / step);
    const rows = Math.ceil(height / step);
    for (let i = 0; i <= cols; i++) {
      lines.push(
        <View
          key={`v-${i}`}
          style={[styles.gridLineV, { left: i * step, height }]}
        />,
      );
    }
    for (let j = 0; j <= rows; j++) {
      lines.push(
        <View
          key={`h-${j}`}
          style={[styles.gridLineH, { top: j * step, width }]}
        />,
      );
    }
    return lines;
  }, [settings.showGrid, settings.gridSize, width, height]);

  return (
    <ScrollView
      style={styles.scrollOuter}
      contentContainerStyle={{ width, height }}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bounces={false}
      directionalLockEnabled={false}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ width, height }}
      >
        <GestureDetector gesture={pinch}>
          <Animated.View style={[styles.canvas, { width, height }, canvasStyle]}>
            {grid}
            {children}
          </Animated.View>
        </GestureDetector>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollOuter: {
    flex: 1,
    backgroundColor: Colors.background.elevated,
  },
  canvas: {
    backgroundColor: Colors.background.elevated,
  },
  gridLineV: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
    opacity: 0.5,
  },
  gridLineH: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.light,
    opacity: 0.5,
  },
});
