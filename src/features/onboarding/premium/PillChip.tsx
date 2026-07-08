// KAIROS — PillChip: pill-shaped selectable chip.
//
// The pill filter/selection control from Notis+/Senso. Unselected = hairline on
// surface; selected = gold fill with inverse text. Shares the tactile language
// (press compression + a soft pop on select) + haptic. Token-driven.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';
import { useTactile } from './motion/useTactile';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PillChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function PillChip({ label, selected, onPress }: PillChipProps) {
  const { animatedStyle, onPressIn, onPressOut } = useTactile({ selected, pressTo: 0.93 });

  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected ? styles.selected : styles.unselected, animatedStyle]}
    >
      <Text
        style={[styles.label, { color: selected ? Colors.ink.inverse : Colors.ink.secondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    minHeight: 38,
    justifyContent: 'center',
  },
  selected: { backgroundColor: Colors.gold.base, borderColor: Colors.gold.base },
  unselected: { backgroundColor: Colors.bg.surface, borderColor: Colors.hair.strong },
  label: { ...Type.bodyEmph },
});

export default React.memo(PillChip);
