// Spine — vertical gold backbone that hosts a sequence of SpineRows.
//
// Renders an absolute-positioned gold line behind the rows; each row places
// its station node centered on the line. The line is purely decorative
// (pointerEvents="none") so it never blocks touches on tiles or station
// nodes.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../../theme/tokens';
import SpineRow, {
  SPINE_CENTER_X,
  SPINE_LINE_WIDTH,
} from './SpineRow';
import type { SpineRow as SpineRowData } from '../lib/spineLayout';

interface Props {
  rows: SpineRowData[];
  renderRow: (row: SpineRowData) => React.ReactNode;
  onRowLongPress?: (row: SpineRowData) => void;
}

function SpineImpl({ rows, renderRow, onRowLongPress }: Props) {
  return (
    <View style={styles.container}>
      {rows.length > 1 && <View style={styles.line} pointerEvents="none" />}
      <View style={styles.rows}>
        {rows.map((row) => (
          <SpineRow key={row.id} row={row} onLongPress={onRowLongPress}>
            {renderRow(row)}
          </SpineRow>
        ))}
      </View>
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
    backgroundColor: Colors.gold.base,
    opacity: 0.32,
    borderRadius: 1,
  },
  rows: {
    gap: 12,
  },
});
