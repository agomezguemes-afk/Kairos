// src/features/planner/components/DayCardShared.tsx
// Common card chrome used by every DayCard variant. Variants only fill the
// inside; this keeps spacing, radius, shadow and margins consistent across the
// 9 visual states without re-declaring them in each variant.

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius, Shadows } from '../../../theme/tokens';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

export function CardShell({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.lg,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadows.card,
  },
});
