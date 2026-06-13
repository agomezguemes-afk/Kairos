// KAIROS — PressableScale: a Pressable that physically compresses on touch.
//
// Drop-in replacement for Pressable when you want the press to feel alive.
// Combines usePressSpring (physics) with optional haptics. Use everywhere a
// surface is tappable so the whole app shares one tactile language.

import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { usePressSpring } from './usePressSpring';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HapticKind = 'light' | 'medium' | 'selection' | 'none';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  onPress?: () => void;
  /** Scale at full press (default 0.96; bigger surfaces use ~0.98). */
  pressScale?: number;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}

function fireHaptic(kind: HapticKind) {
  switch (kind) {
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      break;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      break;
    case 'selection':
      Haptics.selectionAsync().catch(() => {});
      break;
    case 'none':
      break;
  }
}

function PressableScale({
  children,
  onPress,
  pressScale,
  haptic = 'light',
  style,
  ...rest
}: PressableScaleProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressSpring({ to: pressScale });

  const handlePress = useCallback(() => {
    fireHaptic(haptic);
    onPress?.();
  }, [haptic, onPress]);

  return (
    <AnimatedPressable
      {...rest}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default React.memo(PressableScale);
