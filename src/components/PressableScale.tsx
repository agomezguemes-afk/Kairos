import React, { useCallback } from 'react';
import { Pressable, StyleProp, ViewStyle, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { springs } from '../theme/animations';

type HapticLevel =
  | 'none'
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

interface PressableScaleProps extends Pick<
  PressableProps,
  | 'onPress'
  | 'onLongPress'
  | 'disabled'
  | 'hitSlop'
  | 'accessibilityRole'
  | 'accessibilityLabel'
  | 'accessibilityHint'
  | 'accessibilityState'
> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Escala en press-in. Default 0.96 (rango premium 0.95-0.98). */
  scaleTo?: number;
  /** Significancia de la acción → intensidad háptica. Default 'light'. */
  haptic?: HapticLevel;
}

function fireHaptic(level: HapticLevel) {
  switch (level) {
    case 'none':
      return;
    case 'selection':
      return void Haptics.selectionAsync().catch(() => {});
    case 'light':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    case 'medium':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    case 'heavy':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    case 'success':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    case 'warning':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
    case 'error':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
}

export default function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = 'light',
  disabled,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const onPressIn = useCallback(() => {
    if (disabled) return;
    // Háptico en press-IN → respuesta táctil <50ms (touch-psychology §3/§8).
    fireHaptic(haptic);
    if (!reduceMotion) scale.value = withSpring(scaleTo, springs.press);
  }, [disabled, haptic, reduceMotion, scale, scaleTo]);

  const onPressOut = useCallback(() => {
    if (!reduceMotion) scale.value = withSpring(1, springs.press);
  }, [reduceMotion, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled} {...rest}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
