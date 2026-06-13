// KAIROS — AmbientBackground: subtle depth behind premium screens.
//
// The best-in-class apps aren't flat: a soft vertical gradient ground plus a
// faint warm glow gives the canvas dimension without breaking the white+gold
// minimalism. Gold stays a *halo* here (very low opacity), never a fill.

import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../../../theme/tokens';

interface AmbientBackgroundProps {
  /** Vertical position of the glow centre (0 top … 1 bottom). */
  glowY?: number;
}

function AmbientBackground({ glowY = 0.2 }: AmbientBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  // The glow is alive at rest: a slow, organic drift + breath so the canvas
  // never feels static. Two desynced timers (different periods) keep the path
  // from looking like a clean loop — it wanders. Off under reduce-motion.
  const drift = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    drift.value = withRepeat(
      withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    breath.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, drift, breath]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (drift.value - 0.5) * 26 },
      { translateY: (breath.value - 0.5) * 20 },
      { scale: 1 + breath.value * 0.06 },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Warm-off-white → white → faint warm foot: a soft vertical ground that
          grounds the frame instead of reading as flat white. */}
      <LinearGradient
        colors={[
          Colors.bg.warm2,
          Colors.bg.warm,
          Colors.bg.void,
          Colors.bg.surface,
          Colors.bg.warm,
        ]}
        locations={[0, 0.22, 0.55, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Gold halo near the hero — a glow, not a fill. Drifts + breathes so the
          screen feels alive even when nothing is happening. */}
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="kairosGlow" cx="50%" cy={`${glowY * 100}%`} r="80%">
              <Stop offset="0" stopColor={Colors.gold.base} stopOpacity={0.28} />
              <Stop offset="0.4" stopColor={Colors.gold.base} stopOpacity={0.1} />
              <Stop offset="1" stopColor={Colors.gold.base} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="url(#kairosGlow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default React.memo(AmbientBackground);
