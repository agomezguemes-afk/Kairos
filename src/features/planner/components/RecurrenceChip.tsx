// src/features/planner/components/RecurrenceChip.tsx
// Pill that surfaces an RRULE summary and opens the series editor on tap.

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import { summarizeRule } from '../lib/rrule';

interface Props {
  rrule: string;
  onPress: () => void;
}

export default function RecurrenceChip({ rrule, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Editar serie"
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.text}>{`↻  ${summarizeRule(rrule)}  ›`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  text: {
    ...Type.micro,
    color: Colors.gold.deep,
  },
});
