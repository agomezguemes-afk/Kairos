// SpineRow — one row of the spine: gold rail + station node + tile area.
//
// The rail wraps the station node in a Pressable with enlarged hitSlop so a
// long-press anywhere near the node opens the action sheet (>= 44pt touch
// target per Apple HIG / Material). The tile takes the rest of the row.
//
// Reanimated LinearTransition keeps reflow smooth when rows are inserted /
// removed / reordered. Respects useReducedMotion().

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import StationNode from './StationNode';
import type { SpineRow as SpineRowData } from '../lib/spineLayout';

export const SPINE_RAIL_WIDTH = 32;
export const SPINE_CENTER_X = 16;
export const SPINE_LINE_WIDTH = 2;
const RAIL_TOP_OFFSET = 8;

interface Props {
  row: SpineRowData;
  onLongPress?: (row: SpineRowData) => void;
  children: React.ReactNode;
}

function SpineRowImpl({ row, onLongPress, children }: Props) {
  const reduceMotion = useReducedMotion();

  const handleLongPress = () => {
    if (!onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLongPress(row);
  };

  return (
    <Animated.View
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.duration(280).easing(Easing.out(Easing.cubic))
      }
      entering={reduceMotion ? FadeIn.duration(120) : FadeIn.duration(220)}
      style={styles.row}
    >
      <Pressable
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={320}
        hitSlop={20}
        accessibilityRole="button"
        accessibilityLabel="Acciones de estación"
        accessibilityHint="Mantén pulsado para mover, duplicar o eliminar"
        style={styles.rail}
      >
        <StationNode kind={row.kind} state={row.state} />
      </Pressable>
      <View style={styles.tile}>{children}</View>
    </Animated.View>
  );
}

const SpineRow = React.memo(SpineRowImpl);
export default SpineRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 28,
  },
  rail: {
    width: SPINE_RAIL_WIDTH,
    paddingTop: RAIL_TOP_OFFSET,
    alignItems: 'center',
  },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
});
