// RestTimer — large centered countdown with hairline progress bar and a
// quiet skip affordance. No motivational copy, no animated pulses.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, FontFamily } from '../../theme/tokens';

interface Props {
  durationSec: number;
  startTime: number;
  onSkip: () => void;
  onComplete?: () => void;
}

const TICK_MS = 200;

export default function RestTimer({ durationSec, startTime, onSkip, onComplete }: Props) {
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

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (onComplete) onComplete();
    }
  }, [remainingMs, onComplete]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} accessibilityRole="text">Descanso</Text>

      <Text
        style={styles.timer}
        accessibilityLabel={`Quedan ${mm}:${ss}`}
      >
        {mm}:{ss}
      </Text>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 1, now: pct }}
      >
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>

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
  track: {
    width: 220,
    height: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.hair.base,
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: Colors.gold.base,
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
