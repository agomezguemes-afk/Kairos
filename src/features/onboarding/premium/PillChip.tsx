// KAIROS — PillChip: pill-shaped selectable chip.
//
// The pill filter/selection control from Notis+/Senso. Unselected = hairline on
// surface; selected = gold fill with inverse text. Haptic on press. Token-driven.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';

interface PillChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function PillChip({ label, selected, onPress }: PillChipProps) {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.label, { color: selected ? Colors.ink.inverse : Colors.ink.secondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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
  pressed: { opacity: 0.9 },
  label: { ...Type.bodyEmph },
});

export default React.memo(PillChip);
