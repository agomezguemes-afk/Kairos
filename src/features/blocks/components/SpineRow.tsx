// SpineRow — one row of the spine: gold rail + station node + tile area.
//
// The rail wraps the station node in a Pressable with enlarged hitSlop so
// taps on or near the node reach >= 44pt touch target. Two gestures:
//   • Tap         → onTap (opens BlockActionSheet)
//   • Long-press  → drag()  (starts reorder via NestableDraggableFlatList)
// When `drag` is not provided, long-press falls back to onLongPress so the
// caller can still wire an action sheet without enabling reorder.
//
// Reanimated LinearTransition smooths reflow when rows insert/remove.
// While the row is the active drag target, the tile shows a subtle scale
// + shadow lift. Respects useReducedMotion().

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import StationNode from './StationNode';
import { Shadows } from '../../../theme/tokens';
import { springs } from '../../../theme/animations';
import type { SpineRow as SpineRowData } from '../lib/spineLayout';

export const SPINE_RAIL_WIDTH = 32;
export const SPINE_CENTER_X = 16;
export const SPINE_LINE_WIDTH = 2;
const RAIL_TOP_OFFSET = 8;

interface Props {
  row: SpineRowData;
  drag?: () => void;
  isActive?: boolean;
  onTap?: (row: SpineRowData) => void;
  onLongPress?: (row: SpineRowData) => void;
  /** Discipline colour forwarded to the completed station node. */
  accent?: string;
  children: React.ReactNode;
}

function SpineRowImpl({ row, drag, isActive, onTap, onLongPress, accent, children }: Props) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      lift.value = isActive ? 1 : 0;
      return;
    }
    lift.value = withSpring(isActive ? 1 : 0, springs.press);
  }, [isActive, reduceMotion, lift]);

  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + lift.value * 0.012 }],
    shadowOpacity: 0.06 + lift.value * 0.08,
  }));

  const handleLongPress = () => {
    if (drag) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      drag();
      return;
    }
    if (onLongPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onLongPress(row);
    }
  };

  const handleTap = () => {
    if (!onTap) return;
    onTap(row);
  };

  return (
    <Animated.View
      layout={
        reduceMotion ? undefined : LinearTransition.duration(280).easing(Easing.out(Easing.cubic))
      }
      entering={reduceMotion ? FadeIn.duration(120) : FadeIn.duration(220)}
      style={styles.row}
    >
      <Pressable
        onPress={onTap ? handleTap : undefined}
        onLongPress={drag || onLongPress ? handleLongPress : undefined}
        delayLongPress={300}
        hitSlop={20}
        accessibilityRole="button"
        accessibilityLabel="Estación del bloque"
        accessibilityHint={
          drag ? 'Toca para acciones, mantén pulsado para mover' : 'Mantén pulsado para acciones'
        }
        style={styles.rail}
      >
        <StationNode kind={row.kind} state={row.state} accent={accent} />
      </Pressable>
      <Animated.View style={[styles.tile, Shadows.subtle, tileStyle]}>{children}</Animated.View>
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
