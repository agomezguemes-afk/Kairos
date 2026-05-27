// WorkoutSummary — post-session editorial recap (ActiveWorkout path).
//
// Distinct from CompletionCelebration (modal triggered from the editor):
// this screen is the actual finishing surface of ActiveWorkoutScreen and
// runs against the persisted WorkoutHistoryEntry that just landed in the
// store.
//
// Layout follows the same editorial language as CompletionCelebration:
//   • Eyebrow + block name
//   • Hero numeral — total volume (numHero serif 64pt)
//   • Stats row — duration, sets, exercises (hairline-bracketed)
//   • Comparison block vs prior session (sober, no red)
//   • Auto-detected PR list across exercises (uses detectPr + the
//     library/name correlation index from M7)
//   • Adherence percentage when computable
//   • Contextual "next" suggestion
//   • Gold CTA
//
// No trophy ring, no decorative icon — the typography carries the moment.

import React, { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import { Colors, Type, Spacing, Radius } from '../../theme/tokens';
import {
  compareToPrevious,
  nextActionSuggestion,
  type ComparisonResult,
} from './lib/summaryCompare';
import {
  detectPr,
  estimateOneRepMax,
  type ExerciseSessionPoint,
  type PrResult,
} from '../../lib/history/exerciseHistory';
import { useExerciseHistoryIndex } from '../../lib/history/useExerciseHistoryIndex';
import { lookupExerciseHistory } from '../../lib/history/exerciseHistory';
import { formatVolume } from '../../lib/stats/weekStats';

interface Props {
  entry: WorkoutHistoryEntry;
  /** Prior sessions used for delta comparison. Empty list = "first session" tone. */
  history?: WorkoutHistoryEntry[];
  onClose: () => void;
}

interface PrEntry {
  name: string;
  delta: number;
  kind: PrResult['kind'];
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function signed(n: number, suffix: string): string {
  const rounded = Math.round(n);
  if (rounded > 0) return `+${rounded}${suffix}`;
  if (rounded < 0) return `−${Math.abs(rounded)}${suffix}`;
  return `0${suffix}`;
}

// Color rule per spec: success when positive, muted when zero/negative.
function colorForDelta(n: number): string {
  return n > 0.001 ? Colors.semantic.success : Colors.ink.muted;
}

function colorForAdherence(a: number): string {
  if (a >= 0.95) return Colors.semantic.success;
  if (a >= 0.85) return Colors.semantic.warning;
  return Colors.ink.muted;
}

function prDeltaLabel(pr: PrEntry): string {
  const abs = formatVolume(Math.abs(pr.delta));
  const sign = pr.delta > 0 ? '+' : '−';
  switch (pr.kind) {
    case 'weight':
      return `${sign}${abs} kg`;
    case 'oneRm':
      return `${sign}${abs} kg 1RM`;
    case 'volume':
      return `${sign}${abs} kg vol.`;
    default:
      return '';
  }
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
  const historyIndex = useExerciseHistoryIndex();

  // PR detection across every exercise of the just-finished session.
  // The current entry is already in the index (finishWorkout persisted
  // before this render), so we filter it out by `at` to compare candidate
  // vs prior history — detectPr handles the same-at case defensively.
  const prs: PrEntry[] = useMemo(() => {
    const out: PrEntry[] = [];
    for (const ex of entry.exercises) {
      const performed = ex.performedSets ?? [];
      let topWeight: number | null = null;
      let topReps: number | null = null;
      let volume = 0;
      for (const s of performed) {
        if (!s.completed) continue;
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        volume += w * r;
        if (s.weight != null && (topWeight == null || s.weight > topWeight)) {
          topWeight = s.weight;
          topReps = s.reps;
        }
      }
      if (topWeight == null && volume === 0) continue;

      const candidate: ExerciseSessionPoint = {
        at: entry.endedAt,
        date: new Date(entry.endedAt).toISOString().slice(0, 10),
        topWeight,
        topReps,
        volume,
        setsCompleted: ex.setsCompleted,
        estimatedOneRm: estimateOneRepMax(topWeight, topReps),
        libraryId: ex.libraryId,
      };
      const exHistory = lookupExerciseHistory(
        { libraryId: ex.libraryId, name: ex.name },
        historyIndex,
      );
      const pr = detectPr(candidate, exHistory);
      if (pr.isPr && pr.kind && pr.delta > 0) {
        out.push({ name: ex.name, delta: pr.delta, kind: pr.kind });
      }
    }
    return out;
  }, [entry, historyIndex]);

  const showComparison = !!comparison.previous && !!comparison.delta;
  const showAdherence = comparison.adherence != null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header — eyebrow + block name, no decorative ring. */}
      <Text style={styles.eyebrow}>Sesión completada</Text>
      <Text style={styles.title}>{entry.blockName}</Text>

      {/* Hero volume */}
      <View style={styles.heroRow}>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>
            {entry.totalVolume > 0 ? formatVolume(entry.totalVolume) : '—'}
          </Text>
          {entry.totalVolume > 0 && <Text style={styles.heroUnit}>kg</Text>}
        </View>
        <Text style={styles.heroLabel}>volumen total</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCell value={fmtDuration(entry.durationSec)} label="duración" />
        <CellDivider />
        <StatCell
          value={String(entry.setCount)}
          label={entry.setCount === 1 ? 'serie' : 'series'}
        />
        <CellDivider />
        <StatCell
          value={String(entry.exerciseCount)}
          label={entry.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}
        />
      </View>

      {/* PRs */}
      {prs.length > 0 && (
        <View style={styles.prSection}>
          <View style={styles.prHeader}>
            <View style={styles.prBadge}>
              <Feather name="award" size={11} color={Colors.gold.deep} />
            </View>
            <Text style={styles.prTitle}>
              {prs.length === 1 ? 'Nuevo récord personal' : `${prs.length} récords personales`}
            </Text>
          </View>
          {prs.slice(0, 5).map((pr, i) => (
            <View key={pr.name + i} style={styles.prRow}>
              <Text style={styles.prName} numberOfLines={1}>
                {pr.name}
              </Text>
              <Text style={styles.prDelta}>{prDeltaLabel(pr)}</Text>
            </View>
          ))}
          {prs.length > 5 && <Text style={styles.prMore}>+{prs.length - 5} más</Text>}
        </View>
      )}

      {/* Comparison block */}
      {showComparison && comparison.delta && (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Comparativa</Text>
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

      {/* Adherence */}
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

      {/* Next suggestion */}
      <View style={styles.suggestionCard}>
        <Text style={styles.sectionEyebrow}>Siguiente</Text>
        <Text style={styles.suggestionBody}>{suggestion.message}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar resumen"
        onPress={onClose}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
      >
        <Text style={styles.ctaText}>Listo</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CellDivider() {
  return <View style={styles.cellDivider} />;
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
  },

  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
    marginBottom: 6,
  },
  title: {
    ...Type.heading,
    color: Colors.ink.primary,
    marginBottom: Spacing.xl,
  },

  // Hero
  heroRow: {
    marginBottom: Spacing.xl,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroValue: {
    ...Type.numHero,
    fontSize: 64,
    lineHeight: 68,
    color: Colors.ink.primary,
  },
  heroUnit: {
    ...Type.subheading,
    color: Colors.ink.tertiary,
  },
  heroLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginTop: 4,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    marginBottom: Spacing.xl,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...Type.numLarge,
    color: Colors.ink.primary,
  },
  statLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  cellDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair.base,
    alignSelf: 'stretch',
    marginVertical: 6,
  },

  // PRs
  prSection: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold.base,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  prBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prTitle: {
    ...Type.caption,
    color: Colors.gold.deep,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: Spacing.md,
  },
  prName: {
    ...Type.body,
    color: Colors.ink.primary,
    flex: 1,
    minWidth: 0,
  },
  prDelta: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
  },
  prMore: {
    ...Type.micro,
    color: Colors.ink.muted,
    marginTop: 4,
  },

  // Comparison
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionEyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginBottom: Spacing.xs,
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

  // Suggestion
  suggestionCard: {
    backgroundColor: Colors.bg.warm,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  suggestionBody: {
    ...Type.body,
    color: Colors.ink.primary,
  },

  cta: {
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
