import React, { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';

import KIcon from '../icons/KIcon';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import { Colors, Type, Spacing, Radius } from '../../theme/tokens';
import {
  compareToPrevious,
  nextActionSuggestion,
  type ComparisonResult,
} from './lib/summaryCompare';

interface Props {
  entry: WorkoutHistoryEntry;
  /** Prior sessions used for delta comparison. Empty list = "first session" tone. */
  history?: WorkoutHistoryEntry[];
  onClose: () => void;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function signed(n: number, suffix: string): string {
  const rounded = Math.round(n);
  if (rounded > 0) return `+${rounded}${suffix}`;
  if (rounded < 0) return `−${Math.abs(rounded)}${suffix}`;
  return `0${suffix}`;
}

// Color rule per spec: success when positive, muted when zero/negative.
// No red — sober tone, no negative reinforcement.
function colorForDelta(n: number): string {
  return n > 0.001 ? Colors.semantic.success : Colors.ink.muted;
}

function colorForAdherence(a: number): string {
  if (a >= 0.95) return Colors.semantic.success;
  if (a >= 0.85) return Colors.semantic.warning;
  return Colors.ink.muted;
}

interface DeltaRowProps {
  label: string;
  value: string;
  color: string;
}

function DeltaRow({ label, value, color }: DeltaRowProps) {
  return (
    <View style={styles.deltaRow}>
      <Text style={styles.deltaLabel}>{label}</Text>
      <Text style={[styles.deltaValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function WorkoutSummary({ entry, history = [], onClose }: Props) {
  const comparison: ComparisonResult = useMemo(
    () => compareToPrevious(entry, history),
    [entry, history],
  );
  const suggestion = useMemo(() => nextActionSuggestion(comparison), [comparison]);

  const stats: { label: string; value: string }[] = [
    { label: 'Duración', value: fmtDuration(entry.durationSec) },
    { label: 'Series', value: String(entry.setCount) },
    { label: 'Volumen', value: `${Math.round(entry.totalVolume)} kg` },
    { label: 'Ejercicios', value: String(entry.exerciseCount) },
  ];

  const showComparison = !!comparison.previous && !!comparison.delta;
  const showAdherence = comparison.adherence != null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.iconWrap}>
        <KIcon name="zap" size={32} color={Colors.gold.base} />
      </View>
      <Text style={styles.title}>Sesión completada</Text>
      <Text style={styles.subtitle}>{entry.blockName}</Text>

      {/* Stats grid 2×2 */}
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Comparison block */}
      {showComparison && comparison.delta && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>COMPARACIÓN</Text>
          <View style={styles.sectionCard}>
            <DeltaRow
              label="Volumen"
              value={signed(comparison.delta.volume, ' kg')}
              color={colorForDelta(comparison.delta.volume)}
            />
            <View style={styles.divider} />
            <DeltaRow
              label="Series completadas"
              value={signed(comparison.delta.sets, '')}
              color={colorForDelta(comparison.delta.sets)}
            />
            <View style={styles.divider} />
            <DeltaRow
              label="Carga máx."
              value={signed(comparison.delta.maxWeight, ' kg')}
              color={colorForDelta(comparison.delta.maxWeight)}
            />
          </View>
        </View>
      )}

      {/* Adherence row */}
      {showAdherence && comparison.adherence != null && (
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <DeltaRow
              label="Adherencia al plan"
              value={`${Math.round(comparison.adherence * 100)}%`}
              color={colorForAdherence(comparison.adherence)}
            />
          </View>
        </View>
      )}

      {/* Next action */}
      <View style={styles.suggestionCard}>
        <Text style={styles.eyebrow}>SIGUIENTE</Text>
        <Text style={styles.suggestionBody}>{suggestion.message}</Text>
      </View>

      {/* CTA */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar resumen"
        onPress={onClose}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Listo</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg.void,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    alignItems: 'stretch',
  },

  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...Type.body,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    gap: Spacing.xs,
  },
  statValue: {
    ...Type.numLarge,
    color: Colors.ink.primary,
  },
  statLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  section: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  eyebrow: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    paddingHorizontal: Spacing.lg,
  },

  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  deltaLabel: {
    ...Type.body,
    color: Colors.ink.secondary,
  },
  deltaValue: {
    ...Type.numMedium,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair.subtle,
  },

  suggestionCard: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.bg.warm,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  suggestionBody: {
    ...Type.body,
    color: Colors.ink.primary,
  },

  cta: {
    marginTop: Spacing.xl,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
});
