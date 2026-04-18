// KAIROS — OptionChip
// Tappable answer button for the onboarding chat.
// Supports single-select and multi-select modes.

import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, Radius, Shadows, Animation } from '../../theme/index';
import KairosIcon from '../KairosIcon';

interface OptionChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress: () => void;
  /** Stagger index for enter animation. */
  index?: number;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function OptionChip({
  label,
  icon,
  selected = false,
  onPress,
  index = 0,
  disabled = false,
}: OptionChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(80 + index * 60)
        .duration(350)
        .springify()
        .damping(14)}
    >
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.93, Animation.spring.tabIcon);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, Animation.spring.tabIcon);
        }}
        onPress={() => {
          if (disabled) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={[
          styles.chip,
          selected && styles.chipSelected,
          disabled && styles.chipDisabled,
          animatedStyle,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {icon ? <KairosIcon name={icon} size={18} color={selected ? Colors.text.inverse : Colors.text.secondary} /> : null}
        <Text
          style={[
            styles.label,
            selected && styles.labelSelected,
          ]}
        >
          {label}
        </Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    borderWidth: 1.5,
    borderColor: Colors.border.light,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  chipSelected: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },
  labelSelected: {
    color: Colors.text.inverse,
    fontWeight: Typography.weight.semibold,
  },
});
