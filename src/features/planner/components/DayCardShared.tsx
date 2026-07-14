// src/features/planner/components/DayCardShared.tsx
// Common card chrome used by every DayCard variant. Variants only fill the
// inside; this keeps spacing, radius, shadow and margins consistent across the
// 9 visual states without re-declaring them in each variant.
//
// Two new props:
// - stripeColor → renders a 4pt left stripe (the new dominant signal for
//   assigned/in-progress/future variants).
// - tint        → optional warm background (e.g., completed sessions).
// - dim         → opacity 0.6 for past/skipped states that should recede.

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius, Shadows } from '../../../theme/tokens';
import type { Discipline } from '../../../types/core';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
  stripeColor?: string;
  tint?: 'warm';
  /**
   * Design v2 "tarjeta tintada sin borde": fills the card with the discipline
   * tint and drops the shadow so hierarchy comes from the soft colour, not
   * elevation. Wins over `tint="warm"` when both are set.
   */
  tintDiscipline?: Discipline;
  dim?: boolean;
}

export function CardShell({ children, style, stripeColor, tint, tintDiscipline, dim }: Props) {
  const tinted = tintDiscipline !== undefined;
  return (
    <View
      style={[
        styles.card,
        tint === 'warm' && { backgroundColor: Colors.bg.warm },
        tinted && styles.cardTinted,
        tinted && { backgroundColor: Colors.tint[tintDiscipline] },
        dim && { opacity: 0.6 },
        style,
      ]}
    >
      {stripeColor && <View style={[styles.stripe, { backgroundColor: stripeColor }]} />}
      <View style={stripeColor ? styles.contentWithStripe : null}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.lg,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    overflow: 'hidden',
    ...Shadows.card,
  },
  // Borderless tinted hero card: generous radius, no shadow — the fill carries
  // the weight. Radius['2xl'] matches the iOS sheet corner (tokens §3.4).
  cardTinted: {
    borderRadius: Radius['2xl'],
    ...Shadows.none,
  },
  // WHY: 4pt stripe glued to left inside the rounded card. Apple Mail uses
  // a 3pt accent stripe for VIP threads — 4pt reads better with our radius.
  stripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  // WHY: when the stripe is present we need a small inset on the left so
  // text doesn't crash into it. Stripe is 4pt + we want ~Spacing.sm of air.
  contentWithStripe: {
    paddingLeft: Spacing.sm,
  },
});
