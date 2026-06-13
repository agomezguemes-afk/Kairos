// KAIROS — KaiOrb: the AI copilot's living presence.
//
// Kai isn't a static logo — it's a small gold orb that breathes (calm pulse) at
// rest and quickens when "thinking". A layered build: a soft outer halo that
// scales/fades + an inner metallic gold sphere with a top highlight. Reduce-
// motion: holds a steady state. Used in the coach prompt and the building step.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../../../theme/tokens';

interface KaiOrbProps {
  size?: number;
  /** "thinking" pulses faster + brighter (the building moment). */
  thinking?: boolean;
}

const SHEEN = ['#EAD3A0', '#CFAC6E', Colors.gold.base, '#B68C49'] as const;

function KaiOrb({ size = 96, thinking = false }: KaiOrbProps) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      pulse.value = 0.5;
      return;
    }
    const period = thinking ? 1100 : 2600;
    pulse.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, thinking, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * (thinking ? 0.5 : 0.3),
    transform: [{ scale: 1 + pulse.value * (thinking ? 0.22 : 0.12) }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.98 + pulse.value * (thinking ? 0.06 : 0.03) }],
  }));

  const halo = size * 1.5;

  return (
    <View style={[styles.wrap, { width: halo, height: halo }]}>
      <Animated.View
        style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2 }, haloStyle]}
      />
      <Animated.View style={coreStyle}>
        <LinearGradient
          colors={SHEEN}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.core, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View style={[styles.highlight, { width: size * 0.34, height: size * 0.34 }]} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: Colors.gold.glow },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.cardWarm,
  },
  highlight: {
    position: 'absolute',
    top: '16%',
    left: '18%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

export default React.memo(KaiOrb);
