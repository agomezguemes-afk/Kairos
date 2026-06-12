// KAIROS — SoftCard: the premium surface primitive.
//
// The large soft-rounded card seen across best-in-class apps (Senso, Notis+):
// generous radius, a layered soft shadow, a hairline instead of a hard border,
// and a warm "premium zone" variant for hero moments. Selection lifts it with a
// gold ring + gold-tinted shadow. Token-driven; see docs/UIUX_STUDY_BEHANCE.md.

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '../../../theme/tokens';

interface SoftCardProps {
  children: React.ReactNode;
  /** "warm" uses the premium off-white ground for hero surfaces. */
  variant?: 'surface' | 'warm';
  /** Selected state: gold ring + gold-tinted shadow. */
  selected?: boolean;
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

function SoftCard({
  children,
  variant = 'surface',
  selected = false,
  onPress,
  padded = true,
  style,
  accessibilityLabel,
}: SoftCardProps) {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    variant === 'warm' ? styles.warm : styles.surface,
    selected ? styles.selected : styles.unselected,
    padded && styles.padded,
    selected ? Shadows.cardWarm : Shadows.card,
    style,
  ];

  if (!onPress) {
    return (
      <View style={base} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: { padding: Spacing.xl },
  surface: { backgroundColor: Colors.bg.surface },
  warm: { backgroundColor: Colors.bg.warm },
  unselected: { borderColor: Colors.hair.base },
  selected: { borderColor: Colors.gold.base, borderWidth: 1.5 },
  pressed: { opacity: 0.96, transform: [{ scale: 0.99 }] },
});

export default React.memo(SoftCard);
