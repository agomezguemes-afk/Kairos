// KAIROS — Gold confetti particle burst
// Each particle is its own component (with its own SharedValue) so we honour
// the Rules of Hooks while keeping every animation on the UI thread.

import React, { useRef, useImperativeHandle, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

// ======================== TYPES ========================

export interface ConfettiRef {
  burst: () => void;
}

// ======================== PALETTE & CONFIG ========================

const GOLD_PALETTE = ['#C9A96E', '#E8C96E', '#F0C050', '#D4A843', '#FBDFAA', '#FFE878'];
const N = 22;

type ParticleConfig = {
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  color: string;
  delay: number;
  circle: boolean;
};

function genConfigs(): ParticleConfig[] {
  return Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 80 + Math.random() * 120;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 55,
      rotate: (Math.random() - 0.5) * 800,
      size: 5 + Math.random() * 7,
      color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
      delay: Math.round(Math.random() * 130),
      circle: Math.random() > 0.5,
    };
  });
}

// ======================== SINGLE PARTICLE ========================

const Particle = React.memo(({ config, trigger }: { config: ParticleConfig; trigger: number }) => {
  const p = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    p.value = 0;
    p.value = withDelay(config.delay, withTiming(1, { duration: 850 }));
  }, [trigger]);

  const style = useAnimatedStyle(() => {
    const gravity = p.value * p.value * 90;
    return {
      opacity: interpolate(p.value, [0, 0.1, 0.72, 1], [0, 1, 0.85, 0]),
      transform: [
        { translateX: p.value * config.dx },
        { translateY: p.value * config.dy + gravity },
        { rotate: `${p.value * config.rotate}deg` },
        { scale: interpolate(p.value, [0, 0.12, 1], [0, 1.15, 0.65]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          width: config.size,
          height: config.circle ? config.size : config.size * 0.5,
          backgroundColor: config.color,
          borderRadius: config.circle ? config.size / 2 : 2,
        },
      ]}
    />
  );
});
Particle.displayName = 'ConfettiParticle';

// ======================== BURST COMPONENT ========================

export default function ConfettiBurst({
  confettiRef,
}: {
  confettiRef: React.RefObject<ConfettiRef | null>;
}) {
  const configs = useRef(genConfigs());
  const [burstCount, setBurstCount] = useState(0);

  useImperativeHandle(confettiRef, () => ({
    burst: () => setBurstCount((c) => c + 1),
  }));

  return (
    <View style={styles.root} pointerEvents="none">
      {configs.current.map((cfg, i) => (
        <Particle key={i} config={cfg} trigger={burstCount} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
});
