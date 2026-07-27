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
import { Colors, Type, Spacing, Radius, Shadows, FontFamily } from '../../theme/tokens';
import {
  compareToPrevious,
  nextActionSuggestion,
  type ComparisonResult,
} from './lib/summaryCompare';
import {
  fmtDuration,
  signedDelta,
  prDeltaLabel,
  buildSessionPrs,
  type SummaryPr,
} from './lib/workoutSummaryModel';
import { useExerciseHistoryIndex } from '../../lib/history/useExerciseHistoryIndex';
import { lookupExerciseHistory } from '../../lib/history/exerciseHistory';
import { formatVolume } from '../../lib/stats/weekStats';

interface Props {
  entry: WorkoutHistoryEntry;
  /** Prior sessions used for delta comparison. Empty list = "first session" tone. */
  history?: WorkoutHistoryEntry[];
  onClose: () => void;
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

  // PR detection across every exercise of the just-finished session. The
  // current entry is already in the index (finishWorkout persisted before this
  // render), so detectPr filters it out by `at` — see buildSessionPrs.
  const prs: SummaryPr[] = useMemo(
    () => buildSessionPrs(entry, (ref) => lookupExerciseHistory(ref, historyIndex)),
    [entry, historyIndex],
  );

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
              value={signedDelta(comparison.delta.volume, ' kg')}
              color={colorForDelta(comparison.delta.volume)}
            />
            <View style={styles.divider} />
            <DeltaRow
              label="Series completadas"
              value={signedDelta(comparison.delta.sets, '')}
              color={colorForDelta(comparison.delta.sets)}
            />
            <View style={styles.divider} />
            <DeltaRow
              label="Carga máx."
              value={signedDelta(comparison.delta.maxWeight, ' kg')}
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
    // BRIEF-09 recommendation (Álvaro to approve/revert): was Colors.bg.void,
    // a deprecated alias of paper.base — same hex (#FBF9F5), zero visual change.
    backgroundColor: Colors.paper.base,
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
  // Fraunces block name — echoes the serif marker of the session it closes.
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '600',
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
  // No border: white card on warm paper (v3 §3a). The shadow does the lifting.
  sectionCard: {
    backgroundColor: Colors.paper.raised,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
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
