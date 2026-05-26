// src/features/planner/components/PlannerHeader.tsx
// "Hoy" + fecha + frase de momentum + streak pill (tiered).
//
// The streak pill ramps visually with milestones:
//   • 0       → muted neutral (no signal)
//   • 1-6     → tier 1: gold.glow bg, gold.deep text — "iniciando"
//   • 7-29    → tier 2: gold.base bg, ink.inverse text — "constante"
//   • 30+     → tier 3: gold.deep bg + halo shadow — "veterano"
// Crossing into 7, 30 (and 100, 365 for future) is a meaningful
// dopamine moment; the pill visibly deepens so the user feels the
// promotion without needing a separate badge surface.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import { todayISO, formatLongDate } from '../lib/dates';
import { useMomentumPhrase } from '../hooks/useMomentumPhrase';
import { useGamification } from '../../../context/GamificationContext';

interface Props {
  onStreakPress?: () => void;
}

type StreakTier = 'none' | 'start' | 'steady' | 'veteran';

function streakTier(days: number): StreakTier {
  if (days <= 0)  return 'none';
  if (days < 7)   return 'start';
  if (days < 30)  return 'steady';
  return 'veteran';
}

export default function PlannerHeader({ onStreakPress }: Props) {
  const today = todayISO();
  const phrase = useMomentumPhrase();
  const { streak } = useGamification();
  const tier = streakTier(streak.current);

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
          accessibilityLabel={`Constancia ${streak.current} días`}
          style={({ pressed }) => [
            styles.streakPill,
            tier === 'none'    && styles.streakPillNone,
            tier === 'start'   && styles.streakPillStart,
            tier === 'steady'  && styles.streakPillSteady,
            tier === 'veteran' && styles.streakPillVeteran,
            pressed && styles.streakPillPressed,
          ]}
        >
          <Text
            style={[
              styles.streakLabel,
              tier === 'none'    && styles.streakLabelNone,
              tier === 'start'   && styles.streakLabelStart,
              (tier === 'steady' || tier === 'veteran') && styles.streakLabelStrong,
            ]}
          >
            Constancia
          </Text>
          <Text
            style={[
              styles.streakDot,
              tier === 'none'    && styles.streakLabelNone,
              tier === 'start'   && styles.streakLabelStart,
              (tier === 'steady' || tier === 'veteran') && styles.streakLabelStrong,
            ]}
          >
            ·
          </Text>
          <Text
            style={[
              styles.streakText,
              tier === 'none'    && styles.streakLabelNone,
              tier === 'start'   && styles.streakLabelStart,
              (tier === 'steady' || tier === 'veteran') && styles.streakLabelStrong,
            ]}
          >
            {streak.current}
          </Text>
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

  // ── Streak pill: base + tier overlays ──────────────────────────────
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  streakPillNone: {
    backgroundColor: Colors.bg.elevated,
  },
  streakPillStart: {
    backgroundColor: Colors.gold.glow,
  },
  streakPillSteady: {
    backgroundColor: Colors.gold.base,
  },
  streakPillVeteran: {
    backgroundColor: Colors.gold.deep,
    shadowColor: Colors.gold.deep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  streakPillPressed: { opacity: 0.7 },

  // Base text style (size + weight) — color overridden by tier classes below.
  streakLabel: {
    ...Type.micro,
    fontWeight: '600',
  },
  streakDot: {
    ...Type.micro,
    fontWeight: '700',
  },
  streakText: {
    ...Type.micro,
    fontWeight: '700',
  },
  streakLabelNone:   { color: Colors.ink.tertiary },
  streakLabelStart:  { color: Colors.gold.deep },
  streakLabelStrong: { color: Colors.ink.inverse },
});
