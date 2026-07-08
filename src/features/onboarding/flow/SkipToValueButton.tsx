// KAIROS — "skip to value" CTA for onboarding.
//
// One tap drops the user into a ready, personalized space (the screen applies
// skipToValue() from onboardingFlow — smart defaults, no required typing).
// Central to the <2-minute-to-usable goal. Additive: lives in the onboarding
// flow namespace and does not touch the screens the night-run is evolving.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../theme/ThemeContext';
import { Typography } from '../../../theme/tokens';

interface SkipToValueButtonProps {
  /** Fired when the user taps to skip straight into a ready space. */
  onSkip: () => void;
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

function SkipToValueButton({
  onSkip,
  label = 'Empezar ahora',
  hint = 'Listo en 30 segundos',
  style,
}: SkipToValueButtonProps) {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSkip();
  }, [onSkip]);

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={hint}
        accessibilityLabel={label}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.gold[500], opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <Text style={styles.ctaText}>{label}</Text>
      </Pressable>
      <Text style={[styles.hint, { color: colors.text.muted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 8 },
  cta: {
    width: '85%',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hint: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
  },
});

export default React.memo(SkipToValueButton);
