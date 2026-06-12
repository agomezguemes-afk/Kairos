// KAIROS — CanvasGrid
// Home-canvas surface for blocks. Absolute positioning on a 4-col grid;
// long-press toggles "edit mode" where every block jiggles and can be
// dragged or resized via the corner badge. Layout is repacked on every
// drop so blocks never overlap.

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

import CanvasBlockCell from './CanvasBlockCell';
import { computeMetrics, layoutHeight, packLayout } from '../lib/canvasLayout';
import type { WorkoutBlock } from '../../../types/core';
import type { CanvasPosition, CanvasWidgetSize } from '../../../types/canvas';
import { Spacing } from '../../../theme/index';

interface CanvasGridProps {
  blocks: WorkoutBlock[];
  onOpenBlock: (block: WorkoutBlock) => void;
  onSetPosition: (blockId: string, position: CanvasPosition | null) => void;
  onSetSize: (blockId: string, size: CanvasWidgetSize) => void;
  bottomInset: number;
}

const NEXT_SIZE: Record<CanvasWidgetSize, CanvasWidgetSize> = {
  small: 'medium',
  medium: 'large',
  large: 'small',
};

const GRID_GAP = 12;
const GRID_PADDING = Spacing.screen.horizontal;

export default function CanvasGrid({
  blocks,
  onOpenBlock,
  onSetPosition,
  onSetSize,
  bottomInset,
}: CanvasGridProps) {
  const { width } = useWindowDimensions();
  const [editMode, setEditMode] = useState(false);

  const metrics = useMemo(() => computeMetrics(width, GRID_GAP, GRID_PADDING), [width]);

  // Pack layout deterministically. Sorted by sort_order so first-time
  // packing follows the user's original block order rather than insertion
  // randomness. Once any block has an explicit canvasPosition, that wins.
  const placed = useMemo(() => {
    const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
    return packLayout(
      sorted.map((b) => ({
        id: b.id,
        size: b.size as CanvasWidgetSize,
        canvasPosition: b.canvasPosition,
      })),
    ).map((p) => ({ ...p, block: blocks.find((b) => b.id === p.item.id)! }));
  }, [blocks]);

  const totalH = useMemo(() => layoutHeight(placed, metrics), [placed, metrics]);

  // Exit edit mode by tapping the background. Long-press anywhere on a
  // block enters it. Single source of truth for the toggle.
  const enterEditMode = useCallback(() => {
    if (editMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditMode(true);
  }, [editMode]);

  const exitEditMode = useCallback(() => {
    if (!editMode) return;
    Haptics.selectionAsync();
    setEditMode(false);
  }, [editMode]);

  const handleOpen = useCallback(
    (block: WorkoutBlock) => {
      if (editMode) {
        exitEditMode();
        return;
      }
      onOpenBlock(block);
    },
    [editMode, exitEditMode, onOpenBlock],
  );

  // Identity-stable handlers — CanvasBlockCell is memoized and calls these
  // with its own block/id, so cells skip re-rendering when siblings move.
  const handleDrop = useCallback(
    (blockId: string, next: CanvasPosition) => {
      onSetPosition(blockId, next);
    },
    [onSetPosition],
  );

  const handleCycleSize = useCallback(
    (block: WorkoutBlock) => {
      onSetSize(block.id, NEXT_SIZE[block.size as CanvasWidgetSize]);
    },
    [onSetSize],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
      showsVerticalScrollIndicator={false}
      // Disable inner scrolling while edit mode is on so PanGesture isn't
      // fighting the ScrollView for vertical drags. Trade-off: in edit
      // mode you can't scroll the canvas — acceptable for v1; future
      // refinement would auto-scroll near the screen edges.
      scrollEnabled={!editMode}
    >
      {/* Background tap-target to exit edit mode. Behind the canvas. */}
      {editMode && (
        <View
          style={StyleSheet.absoluteFill}
          // Press-through is fine; ScrollView's onTouchEnd will fire
          // when a tap reaches the empty area between blocks.
          onTouchEnd={exitEditMode}
        />
      )}

      <View style={[styles.canvas, { height: Math.max(totalH, metrics.cellSize * 4) }]}>
        {placed.map(({ block, position }) => (
          <CanvasBlockCell
            key={block.id}
            block={block}
            position={position}
            metrics={metrics}
            editMode={editMode}
            onOpen={handleOpen}
            onLongPress={enterEditMode}
            onDrop={handleDrop}
            onCycleSize={handleCycleSize}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  canvas: { position: 'relative' },
});
