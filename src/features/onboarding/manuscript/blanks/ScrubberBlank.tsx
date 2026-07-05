// KAIROS — ScrubberBlank: the days-per-week numeral as a maker's instrument.
// A big Fraunces numeral you DRAG horizontally (haptic detent per step), with
// chevron taps as the non-gesture alternative and an explicit confirm word.
// Accessibility: adjustable role (increment/decrement) so VoiceOver users get
// the same control without the gesture.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import { Fonts } from '../../../../theme/fonts';
import { MAX_DAYS_PER_WEEK, MIN_DAYS_PER_WEEK } from '../../flow/onboardingFlow';

/** Horizontal px of drag per one-day detent. */
const PX_PER_STEP = 36;

interface ScrubberBlankProps {
  value: number;
  onChange: (v: number) => void;
  onConfirm: () => void;
  skipLabel: string;
  onSkip: () => void;
}

export default function ScrubberBlank({
  value,
  onChange,
  onConfirm,
  skipLabel,
  onSkip,
}: ScrubberBlankProps) {
  const startValue = useSharedValue(value);
  const nudge = useSharedValue(0);

  const setClamped = useCallback(
    (v: number) => {
      const clamped = Math.min(MAX_DAYS_PER_WEEK, Math.max(MIN_DAYS_PER_WEEK, v));
      if (clamped !== value) {
        Haptics.selectionAsync().catch(() => {});
        onChange(clamped);
      }
    },
    [value, onChange],
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      startValue.value = value;
    })
    .onUpdate((e) => {
      const next = Math.round(startValue.value + e.translationX / PX_PER_STEP);
      nudge.value = (e.translationX % PX_PER_STEP) / PX_PER_STEP;
      runOnJS(setClamped)(next);
    })
    .onEnd(() => {
      nudge.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const numeralStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value * 6 }],
  }));

  return (
    <View>
      <View style={styles.instrument}>
        <Pressable
          onPress={() => setClamped(value - 1)}
          accessibilityRole="button"
          accessibilityLabel="Un día menos"
          style={styles.chevron}
          hitSlop={8}
        >
          <Text style={[styles.chevronText, value <= MIN_DAYS_PER_WEEK && styles.chevronOff]}>
            ‹
          </Text>
        </Pressable>

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.numeralWrap, numeralStyle]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Días a la semana"
            accessibilityValue={{ min: MIN_DAYS_PER_WEEK, max: MAX_DAYS_PER_WEEK, now: value }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment') setClamped(value + 1);
              if (e.nativeEvent.actionName === 'decrement') setClamped(value - 1);
            }}
          >
            <Text style={styles.numeral}>{value}</Text>
            <Text style={styles.dragHint}>arrastra</Text>
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={() => setClamped(value + 1)}
          accessibilityRole="button"
          accessibilityLabel="Un día más"
          style={styles.chevron}
          hitSlop={8}
        >
          <Text style={[styles.chevronText, value >= MAX_DAYS_PER_WEEK && styles.chevronOff]}>
            ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onConfirm();
          }}
          accessibilityRole="button"
          accessibilityLabel="Confirmar días"
          style={styles.action}
          hitSlop={4}
        >
          <Text style={styles.confirm}>así</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          style={styles.action}
          hitSlop={4}
        >
          <Text style={styles.skip}>{skipLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  instrument: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.xl,
  },
  numeralWrap: { alignItems: 'center', minWidth: 88, paddingVertical: 2 },
  numeral: {
    fontFamily: Fonts.serifMedium,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -2,
    color: Colors.ink.primary,
  },
  dragHint: { ...Type.micro, color: Colors.ink.muted, marginTop: -4 },
  chevron: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    fontFamily: Fonts.serifMedium,
    fontSize: 34,
    color: Colors.gold.deep,
    lineHeight: 40,
  },
  chevronOff: { opacity: 0.25 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.xl,
    marginTop: Spacing.xs,
  },
  action: { paddingVertical: 10 },
  confirm: {
    fontFamily: Fonts.serifSemiBoldItalic,
    fontSize: 21,
    color: Colors.gold.base,
  },
  skip: { ...Type.caption, color: Colors.ink.muted },
});
