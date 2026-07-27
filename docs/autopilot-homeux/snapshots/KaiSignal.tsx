// src/features/planner/components/KaiSignal.tsx
// Renders a single insight line. Returns null if there is no signal —
// silence beats noise.
//
// Layout: the tone-colored dot sits inline with the "SEÑAL" eyebrow label so
// it reads as a single unit ("colored badge"); the message lives in its own
// column below. Action button hugs the right edge.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import type { KaiSignal as KaiSignalType, KaiTone } from '../lib/kaiSignal';

interface Props {
  signal: KaiSignalType | null;
  onAction?: (action: KaiSignalType['action']) => void;
}

// Quiet ink insight (Design v2): gold stays reserved for the Kai orb, so the
// signal dot speaks in neutral ink / semantic tones instead of gold.
const TONE_COLOR: Record<KaiTone, string> = {
  focus: Colors.ink.secondary,
  progress: Colors.semantic.success,
  momentum: Colors.ink.secondary,
  celebrate: Colors.semantic.success,
};

export default function KaiSignal({ signal, onAction }: Props) {
  if (!signal) return null;

  const handleAction = () => {
    if (!signal.action) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAction?.(signal.action);
  };

  return (
    <Animated.View
      key={signal.id}
      entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
      style={styles.card}
    >
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: TONE_COLOR[signal.tone] }]} />
          <Text style={styles.label}>SEÑAL</Text>
        </View>
        <Text style={styles.message}>{signal.message}</Text>
      </View>
      {signal.action && (
        <Pressable
          onPress={handleAction}
          accessibilityRole="button"
          accessibilityLabel={signal.action.label}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.actionText}>{signal.action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A warm card again (STORY-08) — a loose scroll section with its own surface,
  // radius and margins, not a flush member of a container.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.lg,
  },
  body: { flex: 1 },
  // Dot + KAI label in a single row so the dot anchors to the eyebrow line.
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  message: {
    ...Type.caption,
    color: Colors.ink.secondary,
    marginTop: 2,
  },
  action: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  actionText: {
    ...Type.micro,
    color: Colors.ink.primary,
    fontWeight: '600',
  },
});
