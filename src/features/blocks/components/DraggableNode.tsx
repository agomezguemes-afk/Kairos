import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '../../../theme/index';

const SMOOTH = { duration: 250, easing: Easing.out(Easing.cubic) };
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) };
const GAP = 6;

interface DraggableNodeProps {
  children: React.ReactNode;
  index: number;
  totalCount: number;
  columnIndex: number;
  columnCount: number;
  columnWidth: number;
  sectionIndex: number;
  sectionId: string | null;
  activeDragIndex: SharedValue<number>;
  currentDropIndex: SharedValue<number>;
  dragItemHeight: SharedValue<number>;
  dragSourceColumn: SharedValue<number>;
  dragTargetColumn: SharedValue<number>;
  dragSectionIdx: SharedValue<number>;
  dragTargetSectionIdx: SharedValue<number>;
  onDrop: (fromIndex: number, toIndex: number, targetColumn: number, targetSectionIdx: number) => void;
  onTapHandle: () => void;
  onDragActiveChange: (active: boolean) => void;
}

function DraggableNode({
  children,
  index,
  totalCount,
  columnIndex,
  columnCount,
  columnWidth,
  sectionIndex,
  sectionId,
  activeDragIndex,
  currentDropIndex,
  dragItemHeight,
  dragSourceColumn,
  dragTargetColumn,
  dragSectionIdx,
  dragTargetSectionIdx,
  onDrop,
  onTapHandle,
  onDragActiveChange,
}: DraggableNodeProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIdx = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const measuredHeight = useSharedValue(60);

  const onLayout = useCallback((e: any) => {
    measuredHeight.value = e.nativeEvent.layout.height;
  }, [measuredHeight]);

  const shiftY = useDerivedValue(() => {
    if (activeDragIndex.value === -1 || isDragging.value) return 0;
    if (dragSectionIdx.value !== sectionIndex) return 0;
    const srcCol = dragSourceColumn.value;
    const tgtCol = dragTargetColumn.value;
    const tgtSection = dragTargetSectionIdx.value;
    const from = activeDragIndex.value;
    const to = currentDropIndex.value;
    const h = dragItemHeight.value + GAP;

    if (tgtSection !== sectionIndex) {
      if (columnIndex === srcCol && index > from) return -h;
      return 0;
    }

    if (srcCol === tgtCol) {
      if (columnIndex !== srcCol) return 0;
      if (from === to) return 0;
      if (from < to) {
        if (index > from && index <= to) return -h;
      } else {
        if (index >= to && index < from) return h;
      }
    } else {
      if (columnIndex === srcCol && index > from) return -h;
    }
    return 0;
  });

  const showDropLine = useDerivedValue(() => {
    if (activeDragIndex.value === -1 || isDragging.value) return false;
    if (dragTargetSectionIdx.value !== sectionIndex) return false;
    if (dragSourceColumn.value !== dragTargetColumn.value && dragSectionIdx.value === sectionIndex) return false;
    if (columnIndex !== dragTargetColumn.value) return false;
    return index === currentDropIndex.value && !(dragSectionIdx.value === sectionIndex && activeDragIndex.value === index);
  });

  const mainStyle = useAnimatedStyle(() => {
    const active = isDragging.value;
    return {
      transform: [
        { translateY: active ? translateY.value : withTiming(shiftY.value, SMOOTH) },
        { translateX: active ? translateX.value : 0 },
        { scale: active ? scale.value : withTiming(1, SMOOTH) },
      ],
      zIndex: zIdx.value,
    };
  });

  const cardStyle = useAnimatedStyle(() => {
    const active = isDragging.value;
    return {
      shadowOpacity: withTiming(active ? 0.2 : 0, { duration: 150 }),
      shadowRadius: withTiming(active ? 20 : 0, { duration: 150 }),
      elevation: active ? 16 : 0,
      borderWidth: withTiming(active ? 1.5 : 0, { duration: 120 }),
      borderColor: Colors.accent.light,
    };
  });

  const dropLineStyle = useAnimatedStyle(() => ({
    height: withTiming(showDropLine.value ? 3 : 0, { duration: 120 }),
    opacity: withTiming(showDropLine.value ? 1 : 0, { duration: 120 }),
    marginBottom: withTiming(showDropLine.value ? 4 : 0, { duration: 120 }),
  }));

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onTapHandle)();
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(200)
    .onStart(() => {
      isDragging.value = true;
      activeDragIndex.value = index;
      dragItemHeight.value = measuredHeight.value;
      currentDropIndex.value = index;
      dragSourceColumn.value = columnIndex;
      dragTargetColumn.value = columnIndex;
      dragSectionIdx.value = sectionIndex;
      dragTargetSectionIdx.value = sectionIndex;
      scale.value = withSpring(1.04, { damping: 15, stiffness: 200 });
      zIdx.value = 9999;
      runOnJS(onDragActiveChange)(true);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_, state) => {
      if (isDragging.value) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      translateX.value = e.translationX;

      if (columnCount > 1 && columnWidth > 0) {
        const tgtCol = Math.max(0, Math.min(columnCount - 1,
          columnIndex + Math.round(e.translationX / columnWidth)));
        if (tgtCol !== dragTargetColumn.value) {
          dragTargetColumn.value = tgtCol;
          runOnJS(Haptics.selectionAsync)();
        }
      }

      if (dragTargetColumn.value === columnIndex && dragTargetSectionIdx.value === sectionIndex) {
        const avgH = measuredHeight.value + GAP;
        const moved = Math.round(e.translationY / avgH);
        const newIdx = Math.max(0, Math.min(totalCount - 1, index + moved));
        if (newIdx !== currentDropIndex.value) {
          currentDropIndex.value = newIdx;
          runOnJS(Haptics.selectionAsync)();
        }
      } else {
        currentDropIndex.value = 0;
      }
    })
    .onEnd(() => {
      const from = index;
      const to = currentDropIndex.value;
      const targetCol = dragTargetColumn.value;
      const targetSection = dragTargetSectionIdx.value;

      translateY.value = withTiming(0, SETTLE);
      translateX.value = withTiming(0, SETTLE);
      scale.value = withTiming(1, SETTLE);

      runOnJS(onDragActiveChange)(false);

      const crossSection = targetSection !== sectionIndex;
      const crossColumn = targetCol !== columnIndex;
      const reordered = from !== to && to >= 0;

      if (crossSection || crossColumn || reordered) {
        runOnJS(onDrop)(from, to, targetCol, targetSection);
      }

      zIdx.value = 0;
      isDragging.value = false;
      activeDragIndex.value = -1;
      currentDropIndex.value = -1;
      dragSourceColumn.value = -1;
      dragTargetColumn.value = -1;
      dragSectionIdx.value = -1;
      dragTargetSectionIdx.value = -1;
    })
    .onFinalize(() => {
      translateY.value = withTiming(0, SETTLE);
      translateX.value = withTiming(0, SETTLE);
      scale.value = withTiming(1, SETTLE);
      zIdx.value = 0;
      isDragging.value = false;
      activeDragIndex.value = -1;
      currentDropIndex.value = -1;
      dragSourceColumn.value = -1;
      dragTargetColumn.value = -1;
      dragSectionIdx.value = -1;
      dragTargetSectionIdx.value = -1;
      runOnJS(onDragActiveChange)(false);
    });

  const composedGesture = Gesture.Exclusive(
    Gesture.Simultaneous(longPressGesture, panGesture),
    tapGesture,
  );

  return (
    <>
      <Animated.View style={[styles.dropLine, dropLineStyle]} />
      <Animated.View
        style={[styles.nodeWrapper, mainStyle]}
        onLayout={onLayout}
      >
        <Animated.View style={[styles.cardBase, cardStyle]}>
          <View style={styles.nodeRow}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={styles.handle}>
                <View style={styles.gripDots}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={styles.gripDot} />
                  ))}
                </View>
              </Animated.View>
            </GestureDetector>
            <View style={styles.nodeContent}>
              {children}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

export default React.memo(DraggableNode);

const styles = StyleSheet.create({
  nodeWrapper: {
    overflow: 'visible',
  },
  cardBase: {
    backgroundColor: Colors.background.void,
    borderRadius: 8,
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'visible',
  },
  dropLine: {
    backgroundColor: Colors.accent.primary,
    borderRadius: 1.5,
    marginHorizontal: 16,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  handle: {
    width: 20,
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  gripDots: {
    width: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 2.5,
  },
  gripDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: Colors.border.medium,
  },
  nodeContent: {
    flex: 1,
    minWidth: 0,
  },
});
