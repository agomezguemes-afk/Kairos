import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export const GUIDE_GOLD = '#FFD700';
export const MAX_GUIDES = 8;

export type GuideSlot = { value: number; visible: number };

export const emptyGuides = (): GuideSlot[] =>
  Array.from({ length: MAX_GUIDES }, () => ({ value: 0, visible: 0 }));

interface VLineProps {
  idx: number;
  sv: SharedValue<GuideSlot[]>;
  height: number;
}
function VLine({ idx, sv, height }: VLineProps) {
  const style = useAnimatedStyle(() => {
    const slot = sv.value[idx];
    return {
      transform: [{ translateX: slot ? slot.value : 0 }],
      opacity: slot ? slot.visible : 0,
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.vLine, { height }, style]} />;
}

interface HLineProps {
  idx: number;
  sv: SharedValue<GuideSlot[]>;
  width: number;
}
function HLine({ idx, sv, width }: HLineProps) {
  const style = useAnimatedStyle(() => {
    const slot = sv.value[idx];
    return {
      transform: [{ translateY: slot ? slot.value : 0 }],
      opacity: slot ? slot.visible : 0,
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.hLine, { width }, style]} />;
}

interface Props {
  guideV: SharedValue<GuideSlot[]>;
  guideH: SharedValue<GuideSlot[]>;
  width: number;
  height: number;
}

export default function GuideLines({ guideV, guideH, width, height }: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      {Array.from({ length: MAX_GUIDES }).map((_, i) => (
        <VLine key={`v${i}`} idx={i} sv={guideV} height={height} />
      ))}
      {Array.from({ length: MAX_GUIDES }).map((_, i) => (
        <HLine key={`h${i}`} idx={i} sv={guideH} width={width} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    backgroundColor: GUIDE_GOLD,
    opacity: 0,
  },
  hLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 1,
    backgroundColor: GUIDE_GOLD,
    opacity: 0,
  },
});
