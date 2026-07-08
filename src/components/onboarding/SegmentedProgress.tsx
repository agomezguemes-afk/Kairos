// KAIROS — Progreso segmentado del onboarding
// Sustituye a los dots pasivos (04-ux F8): completados en oro, actual en glow,
// restantes en hairline. Relleno animado a 280ms; con Reduce Motion, snap.

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Colors, Radius, Spacing, Animation } from '../../theme/tokens';

type SegmentState = 'done' | 'current' | 'todo';

interface SegmentedProgressProps {
  total: number;
  /** Índice de página actual (0-based). */
  current: number;
  reduceMotion: boolean;
}

const Segment = React.memo(function Segment({
  state,
  reduceMotion,
}: {
  state: SegmentState;
  reduceMotion: boolean;
}) {
  const fill = useSharedValue(state === 'done' ? 1 : 0);
  const glow = useSharedValue(state === 'current' ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : Animation.duration.normal;
    fill.value = withTiming(state === 'done' ? 1 : 0, { duration });
    glow.value = withTiming(state === 'current' ? 1 : 0, { duration });
  }, [state, reduceMotion, fill, glow]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
});

function SegmentedProgress({ total, current, reduceMotion }: SegmentedProgressProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${current + 1} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Segment
          key={i}
          state={i < current ? 'done' : i === current ? 'current' : 'todo'}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

export default React.memo(SegmentedProgress);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.hair.base,
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.pill,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.gold.base,
    borderRadius: Radius.pill,
  },
});
