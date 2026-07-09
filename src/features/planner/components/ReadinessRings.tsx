// ReadinessRings — three concentric mini-rings, the daily ritual hook.
//
// Apple Fitness-style: three independent scores that can be cross-
// referenced at a glance ("Energía verde, Recuperación roja → sesión
// ligera hoy"). One serif numeral + one eyebrow label per ring.
//
// Animation: each ring sweeps in from 0 to its score on mount and on
// score change. Spring physics from theme/animations so it matches the
// rest of the app's motion vocabulary.

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { springs } from '../../../theme/animations';
import { useWorkoutStore } from '../../../store/workoutStore';
import { computeReadiness } from '../../../lib/readiness/readiness';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  onPress?: () => void;
}

export default function ReadinessRings({ onPress }: Props) {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const snapshot = useMemo(() => computeReadiness(history), [history]);

  // Day 0: no sessions yet → no data to score. Never fabricate 90/70/100.
  // Show a single-accent "por calibrar" state until the first session lands.
  const calibrating = snapshot.signals.daysSinceLastWorkout === null;
  const headline = calibrating ? 'Se calibra con tu primer entrenamiento.' : snapshot.headline;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={
        calibrating ? 'Tu estado: por calibrar' : `Tu estado: ${snapshot.headline}`
      }
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <Text style={styles.eyebrow}>Tu estado hoy</Text>
      <View style={styles.row}>
        {/* Single accent (gold) while calibrating — the three data hues only
            appear once there are real numbers to cross-reference. */}
        <RingCell
          label="Energía"
          score={snapshot.energia}
          hue={Colors.gold.base}
          calibrating={calibrating}
        />
        <RingCell
          label="Fuerza"
          score={snapshot.fuerza}
          hue={calibrating ? Colors.gold.base : Colors.semantic.info}
          calibrating={calibrating}
        />
        <RingCell
          label="Recuperación"
          score={snapshot.recuperacion}
          hue={calibrating ? Colors.gold.base : Colors.semantic.success}
          calibrating={calibrating}
        />
      </View>
      <Text style={styles.headline}>{headline}</Text>
    </Pressable>
  );
}

// ── Ring cell ──────────────────────────────────────────────────────

const RING_SIZE = 72;
const STROKE = 7;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function RingCell({
  label,
  score,
  hue,
  calibrating = false,
}: {
  label: string;
  score: number;
  hue: string;
  calibrating?: boolean;
}) {
  const progress = useSharedValue(0);
  const numberOpacity = useSharedValue(0);

  // Animate sweep on mount + whenever score changes. Numerals fade in
  // slightly behind the sweep for a sequenced reveal. While calibrating there
  // is no data → the ring stays empty (track only) and the centre shows "—".
  useEffect(() => {
    progress.value = calibrating ? 0 : withSpring(score / 100, springs.gentle);
    numberOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [score, calibrating, progress, numberOpacity]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const numberStyle = useAnimatedStyle(() => ({
    opacity: numberOpacity.value,
  }));

  return (
    <View style={styles.cell}>
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={Colors.hair.base}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Progress sweep — starts at 12 o'clock (-90deg) */}
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={hue}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <Animated.View style={[styles.numberCenter, numberStyle]}>
          <Text style={[styles.number, calibrating && styles.numberCalibrating]}>
            {calibrating ? '—' : score}
          </Text>
        </Animated.View>
      </View>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.screen.horizontal,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    ...Shadows.subtle,
  },
  pressed: {
    opacity: 0.92,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  cell: {
    alignItems: 'center',
    gap: 6,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    ...Type.numMedium,
    fontFamily: Type.title.fontFamily, // serif — brand voice on stat numerals
    fontSize: 20,
    color: Colors.ink.primary,
    letterSpacing: -0.3,
  },
  numberCalibrating: { color: Colors.ink.muted },
  cellLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
  headline: {
    ...Type.caption,
    color: Colors.ink.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
