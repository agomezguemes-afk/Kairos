// src/features/planner/components/PlannerHeader.tsx
// "Hoy" + fecha + frase de momentum + streak pill (gold).

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import { todayISO, formatLongDate } from '../lib/dates';
import { useMomentumPhrase } from '../hooks/useMomentumPhrase';
import { useGamification } from '../../../context/GamificationContext';

interface Props {
  onStreakPress?: () => void;
}

export default function PlannerHeader({ onStreakPress }: Props) {
  const today = todayISO();
  const phrase = useMomentumPhrase();
  const { streak } = useGamification();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Hoy</Text>
          <Text style={styles.date}>{formatLongDate(today)}</Text>
        </View>
        <Pressable
          onPress={onStreakPress}
          accessibilityRole="button"
          accessibilityLabel={`Racha ${streak.current} días`}
          style={({ pressed }) => [styles.streakPill, pressed && styles.streakPillPressed]}
        >
          <Text style={styles.streakBullet}>·</Text>
          <Text style={styles.streakText}>{streak.current}</Text>
        </Pressable>
      </View>
      <Text style={styles.phrase}>{phrase}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen.horizontal,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: { flex: 1 },
  title: {
    ...Type.title,
    color: Colors.ink.primary,
  },
  date: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  phrase: {
    ...Type.body,
    color: Colors.ink.secondary,
    marginTop: Spacing.md,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.full,
  },
  streakPillPressed: { opacity: 0.7 },
  streakBullet: {
    fontSize: 11,
    color: Colors.gold.deep,
    fontWeight: '700',
  },
  streakText: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
});
