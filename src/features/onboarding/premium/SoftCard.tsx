// KAIROS — SoftCard: the premium surface primitive.
//
// The large soft-rounded card seen across best-in-class apps (Senso, Notis+):
// generous radius, a layered soft shadow, a hairline instead of a hard border,
// and a warm "premium zone" variant for hero moments. Selection lifts it with a
// gold ring + gold-tinted shadow. Token-driven; see docs/UIUX_STUDY_BEHANCE.md.

import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Colors, Radius, Shadows, Spacing } from '../../../theme/tokens';
import { useTactile } from './motion/useTactile';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  // Selection reads from the crisp accent ring (below); the shadow is just a
  // tight accent-tinted lift — not a soft glow halo.
  const selectedGlow: ViewStyle = {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
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
    <PressableCard
      base={base}
      selected={selected}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </PressableCard>
  );
}

// Split out so hooks live in their own component (hooks can't run conditionally).
// One tactile language: press compression (cards are large → 0.98) + a soft pop
// the moment it becomes selected, so choosing feels physical, not a colour swap.
function PressableCard({
  base,
  selected,
  onPress,
  accessibilityLabel,
  children,
}: {
  base: StyleProp<ViewStyle>;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = useTactile({ selected, pressTo: 0.98 });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={[base, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
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
});

export default React.memo(SoftCard);
