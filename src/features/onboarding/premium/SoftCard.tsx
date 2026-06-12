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
  /** Selected state: accent ring + accent-tinted glow. */
  selected?: boolean;
  /** Accent color for the selected ring/glow. Defaults to gold. */
  accentColor?: string;
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

function SoftCard({
  children,
  variant = 'surface',
  selected = false,
  accentColor,
  onPress,
  padded = true,
  style,
  accessibilityLabel,
}: SoftCardProps) {
  const accent = accentColor ?? Colors.gold.base;
  // Accent-tinted glow when selected — vivid but soft (the "aesthetic" lift).
  const selectedGlow: ViewStyle = {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  };
  const base: StyleProp<ViewStyle> = [
    styles.card,
    variant === 'warm' ? styles.warm : styles.surface,
    padded && styles.padded,
    selected
      ? [{ borderColor: accent, borderWidth: 1.5 }, selectedGlow]
      : [styles.unselected, Shadows.card],
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
