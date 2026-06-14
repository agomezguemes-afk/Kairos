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
import { Colors } from '../../../theme/tokens';

interface KaiOrbProps {
  size?: number;
  /** "thinking" pulses faster + brighter (the building moment). */
  thinking?: boolean;
}

// Warm vertical gold — top a touch lighter, base deeper. A soft disc, not a
// glossy 3D bauble (the generic "AI orb" tell). Personality comes from the
// crafted seal edge + a restrained sheen, not metallic shine.
const CORE = ['#DCC089', '#BE9B57'] as const;

function KaiOrb({ size = 96, thinking = false }: KaiOrbProps) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  const float = useSharedValue(0);

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
    // A gentle hover so Kai feels like a living, floating companion at rest.
    float.value = withRepeat(
      withTiming(1, { duration: thinking ? 2200 : 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, thinking, pulse, float]);

  // The whole orb bobs softly (idle life, not a slide).
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (float.value - 0.5) * 5 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * (thinking ? 0.5 : 0.3),
    transform: [{ scale: 1 + pulse.value * (thinking ? 0.22 : 0.12) }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.98 + pulse.value * (thinking ? 0.06 : 0.03) }],
  }));

  const halo = size * 1.5;

  return (
    <Animated.View style={[styles.wrap, { width: halo, height: halo }, floatStyle]}>
      <Animated.View
        style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2 }, haloStyle]}
      />
      <Animated.View style={coreStyle}>
        <LinearGradient
          colors={CORE}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.core, { width: size, height: size, borderRadius: size / 2 }]}
        >
          {/* Soft top sheen (a lit edge, not a bauble dot). */}
          <LinearGradient
            colors={['rgba(255,250,235,0.35)', 'rgba(255,250,235,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.sheen, { height: size * 0.42 }]}
            pointerEvents="none"
          />
          {/* Crafted seal edge — a thin lighter-gold inner rim. */}
          <View
            style={[
              styles.rim,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: Math.max(1, size * 0.018),
              },
            ]}
            pointerEvents="none"
          />
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: Colors.gold.glow },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Tighter, warmer contact glow — a present object, not a floaty bauble.
    shadowColor: '#7A5E22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 4,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  rim: {
    position: 'absolute',
    borderColor: 'rgba(255,250,238,0.45)',
  },
});

export default React.memo(KaiOrb);
