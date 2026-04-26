import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import KIcon from '../icons/KIcon';
import { Colors } from '../../theme/tokens';

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
  const pct = durationSec > 0 ? Math.min(1, (durationSec * 1000 - remainingMs) / (durationSec * 1000)) : 1;

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (onComplete) onComplete();
    }
  }, [remainingMs, onComplete]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Descanso</Text>
      <Text style={styles.timer}>{mm}:{ss}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={12}>
        <KIcon name="x" size={18} color={Colors.text_v2.primary.dark} />
        <Text style={styles.skipText}>Saltar (+0s)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.gold[500],
  },
  timer: {
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
    color: Colors.text_v2.primary.dark,
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: 220,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,240,232,0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: Colors.gold[500],
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.2)',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text_v2.primary.dark,
  },
});
