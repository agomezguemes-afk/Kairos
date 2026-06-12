// KAIROS — GoldProgressBar: a slim animated progress indicator.
//
// Premium onboarding wants a calm, legible sense of progress, not chunky dots.
// A thin track with a gold fill that eases between values, reduce-motion aware.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../../theme/tokens';
import { useMotionPlan } from '../flow/useReducedMotion';

interface GoldProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function GoldProgressBar({ progress, height = 4 }: GoldProgressBarProps) {
  const plan = useMotionPlan();
  const value = useSharedValue(clamp01(progress));

  useEffect(() => {
    value.value = withTiming(clamp01(progress), {
      duration: plan.durations.standard,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, plan.durations.standard, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamp01(progress) * 100), min: 0, max: 100 }}
      style={[styles.track, { height, borderRadius: height }]}
    >
      <Animated.View style={[styles.fill, { borderRadius: height }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: Colors.hair.base, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.gold.base },
});

export default React.memo(GoldProgressBar);
