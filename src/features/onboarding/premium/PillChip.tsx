// KAIROS — PillChip: pill-shaped selectable chip.
//
// The pill filter/selection control from Notis+/Senso. Unselected = hairline on
// surface; selected = gold fill with inverse text. Haptic on press. Token-driven.

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';
import PressableScale from './motion/PressableScale';

interface PillChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function PillChip({ label, selected, onPress }: PillChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      pressScale={0.93}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      <Text
        style={[styles.label, { color: selected ? Colors.ink.inverse : Colors.ink.secondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
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
