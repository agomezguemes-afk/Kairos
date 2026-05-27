// Spine — vertical gold backbone that hosts a sequence of SpineRows.
//
// Backed by NestableDraggableFlatList so the spine is reorderable inside a
// scroll-only parent (BlockEditor wraps its content in NestableScrollContainer).
// The gold line renders as an absolute decorative layer behind the list.
//
// Each row provides its own `drag` callback to the station node so long-
// pressing the node lifts the row. Tap on the station opens the action
// sheet via `onRowTap` (move/duplicate/transform/delete) — drag is a
// separate gesture (long-press + ~10pt movement) to avoid conflicts.

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  NestableDraggableFlatList,
  type DragEndParams,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Colors } from '../../../theme/tokens';
import SpineRow, { SPINE_CENTER_X, SPINE_LINE_WIDTH } from './SpineRow';
import type { SpineRow as SpineRowData } from '../lib/spineLayout';

interface Props {
  rows: SpineRowData[];
  renderRow: (row: SpineRowData) => React.ReactNode;
  onRowTap?: (row: SpineRowData) => void;
  onRowLongPress?: (row: SpineRowData) => void;
  onReorder?: (orderedIds: string[]) => void;
}

function SpineImpl({ rows, renderRow, onRowTap, onRowLongPress, onReorder }: Props) {
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<SpineRowData>) => (
      <SpineRow
        row={item}
        drag={onReorder ? drag : undefined}
        isActive={isActive}
        onTap={onRowTap}
        onLongPress={onRowLongPress}
      >
        {renderRow(item)}
      </SpineRow>
    ),
    [renderRow, onRowTap, onRowLongPress, onReorder],
  );

  const handleDragEnd = useCallback(
    (params: DragEndParams<SpineRowData>) => {
      if (!onReorder) return;
      onReorder(params.data.map((r) => r.id));
    },
    [onReorder],
  );

  const keyExtractor = useCallback((item: SpineRowData) => item.id, []);

  return (
    <View style={styles.container}>
      {rows.length > 1 && <View style={styles.line} pointerEvents="none" />}
      <NestableDraggableFlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onDragEnd={handleDragEnd}
        activationDistance={10}
        dragItemOverflow
        contentContainerStyle={styles.rows}
      />
    </View>
  );
}

const Spine = React.memo(SpineImpl);
export default Spine;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: SPINE_CENTER_X - SPINE_LINE_WIDTH / 2,
    top: 14,
    bottom: 14,
    width: SPINE_LINE_WIDTH,
    // Structural rail — neutral so completion gold reads as signal,
    // not decoration. Gold lives on completed stations only.
    backgroundColor: Colors.hair.strong,
    borderRadius: 1,
  },
  rows: {
    gap: 12,
  },
});
