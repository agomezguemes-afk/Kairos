// RestTimer — circular ring countdown that fills clockwise as time elapses,
// with a large centered tabular numeral, +15s extend pill, and skip link.
// Uses react-native-svg primitives directly (no Animated SVG wrapper); the
// 200ms tick re-renders strokeDashoffset, which is smooth enough.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, FontFamily } from '../../theme/tokens';

interface Props {
  durationSec: number;
  startTime: number;
  onSkip: () => void;
  onComplete?: () => void;
  onExtend?: (seconds: number) => void;
}

const TICK_MS = 200;
const RING_SIZE = 200;
const STROKE_W = 10;
const RADIUS = (RING_SIZE - STROKE_W) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const CENTER = RING_SIZE / 2;
const EXTEND_SECONDS = 15;

export default function RestTimer({
  durationSec,
  startTime,
  onSkip,
  onComplete,
  onExtend,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startTime, durationSec]);

  const remainingMs = Math.max(0, startTime + durationSec * 1000 - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, '0');
  const ss = (remainingSec % 60).toString().padStart(2, '0');
  const pct = durationSec > 0
    ? Math.min(1, (durationSec * 1000 - remainingMs) / (durationSec * 1000))
    : 1;
  const dashOffset = CIRC * (1 - pct);
  const finished = remainingMs <= 0;

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (onComplete) onComplete();
    }
  }, [remainingMs, onComplete]);

  const handleExtend = () => {
    if (!onExtend) return;
    Haptics.selectionAsync().catch(() => {});
    onExtend(EXTEND_SECONDS);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} accessibilityRole="text">Descanso</Text>

      <View
        style={styles.ringWrap}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 1, now: pct }}
        accessibilityLabel={`Quedan ${mm}:${ss}`}
      >
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Track ring */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={Colors.hair.strong}
            strokeWidth={STROKE_W}
            fill="none"
            opacity={0.5}
          />
          {/* Progress ring — rotates 90° anticlockwise so the start is at 12
              o'clock and the stroke fills clockwise as `pct` grows. */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={Colors.gold.base}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        </Svg>
        {/* Centered numeral absolutely positioned over the SVG. Swaps to a
            sober "Listo" label when the countdown hits zero. */}
        <View style={styles.numeralWrap} pointerEvents="none">
          {finished ? (
            <Text style={styles.doneText}>Listo</Text>
          ) : (
            <Text
              style={styles.timer}
              accessibilityLabel={`Quedan ${mm}:${ss}`}
            >
              {mm}:{ss}
            </Text>
          )}
        </View>
      </View>

      {/* +15s pill — gold ghost, fires haptic selection + onExtend(15) */}
      {onExtend ? (
        <Pressable
          onPress={handleExtend}
          accessibilityRole="button"
          accessibilityLabel="Añadir 15 segundos"
          hitSlop={10}
          style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.extendText}>+15s</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Saltar descanso"
        hitSlop={12}
        style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.skipText}>Saltar descanso</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  // Eyebrow — sober label, gold deep.
  label: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeralWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sans large numeral — overrides Type.title's serif family per spec.
  timer: {
    fontFamily: FontFamily.sans,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '600',
    letterSpacing: -1,
    color: Colors.ink.primary,
    fontVariant: ['tabular-nums'],
  },
  doneText: {
    fontFamily: FontFamily.sans,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
    color: Colors.gold.deep,
    letterSpacing: 0.5,
  },
  // +15s pill — gold ghost on gold.glow halo. Reads as a tap target, not chrome.
  extendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.glow,
  },
  extendText: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
    fontVariant: ['tabular-nums'],
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
});
