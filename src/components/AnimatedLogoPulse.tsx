import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import KIcon, { type KIconName } from './icons/KIcon';
import { Colors } from '../theme/tokens';

interface Props {
  size?: number;
  iconSize?: number;
  iconName?: KIconName;
  color?: string;
  shimmer?: boolean;
  breathing?: boolean;
  initialFade?: boolean;
}

export default function AnimatedLogoPulse({
  size = 120,
  iconSize,
  iconName = 'barbell',
  color = Colors.gold.base,
  shimmer = false,
  breathing = true,
  initialFade = true,
}: Props) {
  const ringOp = useSharedValue(initialFade ? 0 : 1);
  const ringScale = useSharedValue(initialFade ? 0.8 : 1);
  const breathScale = useSharedValue(1);
  const shimmerOp = useSharedValue(0.8);
  const iconOp = useSharedValue(initialFade ? 0 : 1);

  useEffect(() => {
    if (initialFade) {
      ringOp.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
      ringScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.exp) });
      iconOp.value = withDelay(
        140,
        withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [initialFade, ringOp, ringScale, iconOp]);

  useEffect(() => {
    if (breathing) {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [breathing, breathScale]);

  useEffect(() => {
    if (shimmer) {
      shimmerOp.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [shimmer, shimmerOp]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOp.value * (shimmer ? shimmerOp.value : 1),
    transform: [{ scale: ringScale.value * breathScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOp.value,
    transform: [{ scale: breathScale.value }],
  }));

  const innerSize = iconSize ?? Math.round(size * 0.42);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        ringStyle,
      ]}
    >
      <Animated.View style={iconStyle}>
        <KIcon name={iconName} size={innerSize} color={color} strokeWidth={1.5} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
