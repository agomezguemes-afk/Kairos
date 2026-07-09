// HomeHeroStats — editorial-hero summary above the planner.
//
// Two columns, both editorial-serif numerals:
//   • Sesiones (left, numHero)  — count + delta vs last 7 days
//   • Volumen  (right, numHero) — kg total + delta
//
// No background, no border — the hero figures carry the moment alone.
// Hairline divider underneath separates from the PlannerHeader below.
//
// Mounts under the safe-area top inset; the screen renders this BEFORE
// the PlannerHeader so the first paint the user sees on open is "their
// number". Apple Health / Whoop pattern.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Type, Spacing } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { computeWeekStats, formatVolume } from '../../../lib/stats/weekStats';

export default function HomeHeroStats() {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const stats = useMemo(() => computeWeekStats(history), [history]);

  // Brand-new user — no sessions ever, or none in either of the rolling
  // 14d windows. Show an invitation instead of two depressing zeros.
  const hasAnyHistory =
    stats.sessionsThisWeek > 0 || stats.sessionsLastWeek > 0 || history.length > 0;

  if (!hasAnyHistory) {
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Esta semana</Text>
        <View style={styles.emptyRow}>
          <Text style={styles.emptyValue}>0</Text>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyHeadline}>Tu primera semana</Text>
            {/* Descriptive only — the single gold "Empezar ahora" below is the
                one primary action; this line no longer competes with it. */}
            <Text style={styles.emptySub}>Aquí verás tu historia en cuanto entrenes.</Text>
          </View>
        </View>
      </View>
    );
  }

  const sessionsDeltaLabel = formatDeltaLabel(stats.sessionsDelta, 'sesión', 'sesiones');
  const volumeDeltaLabel = formatVolumeDelta(stats.volumeDelta);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Esta semana</Text>
      <View style={styles.row}>
        <View style={styles.cell}>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{stats.sessionsThisWeek}</Text>
            <Text style={styles.unit}>{stats.sessionsThisWeek === 1 ? 'sesión' : 'sesiones'}</Text>
          </View>
          {sessionsDeltaLabel && (
            <Text
              style={[
                styles.delta,
                stats.sessionsDelta > 0 && styles.deltaPositive,
                stats.sessionsDelta < 0 && styles.deltaNegative,
              ]}
            >
              {sessionsDeltaLabel}
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.cell}>
          <View style={styles.valueRow}>
            <Text style={styles.value}>
              {stats.volumeThisWeek > 0 ? formatVolume(stats.volumeThisWeek) : '—'}
            </Text>
            <Text style={styles.unit}>{stats.volumeThisWeek > 0 ? 'kg' : ''}</Text>
          </View>
          {volumeDeltaLabel && (
            <Text
              style={[
                styles.delta,
                stats.volumeDelta > 0 && styles.deltaPositive,
                stats.volumeDelta < 0 && styles.deltaNegative,
              ]}
            >
              {volumeDeltaLabel}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function formatDeltaLabel(delta: number, singular: string, plural: string): string | null {
  if (delta === 0) return 'igual que la semana pasada';
  const abs = Math.abs(delta);
  const sign = delta > 0 ? '+' : '−';
  const unit = abs === 1 ? singular : plural;
  return `${sign}${abs} ${unit} vs semana pasada`;
}

function formatVolumeDelta(delta: number): string | null {
  if (delta === 0) return null;
  const abs = Math.abs(delta);
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatVolume(abs)} kg vs semana pasada`;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair.base,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    ...Type.numHero,
    fontSize: 44,
    lineHeight: 48,
    color: Colors.ink.primary,
  },
  unit: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  delta: {
    ...Type.micro,
    color: Colors.ink.muted,
    marginTop: 4,
    fontWeight: '500',
  },
  deltaPositive: {
    color: Colors.semantic.success,
  },
  deltaNegative: {
    color: Colors.semantic.error,
  },

  // Empty state
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  emptyValue: {
    ...Type.numHero,
    fontSize: 56,
    lineHeight: 60,
    color: Colors.ink.muted,
  },
  emptyCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyHeadline: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  emptySub: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
});
