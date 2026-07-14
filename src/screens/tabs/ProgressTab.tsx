import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Type, Spacing, Radius } from '../../theme/tokens';
import { useWorkoutStore } from '../../store/workoutStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useGamification } from '../../context/GamificationContext';
import { BADGE_DEFINITIONS } from '../../types/gamification';
import { isSurfaceVisible } from '../../config/wedge';
import {
  topExercisesByFrequency,
  maxWeightSeries,
  weeklyVolumeSeries,
  computeSummaryStats,
} from './progress/lib/aggregations';
import { oneRMSeries, summarize1RM } from './progress/lib/oneRM';
import { buildMonthAdherence } from './progress/lib/adherence';
import {
  detectPlateau,
  detectPRStreak,
  detectGap,
  detectConsistent,
} from './progress/lib/insights';
import { todayISO } from '../../features/planner/lib/dates';
import Sparkline from './progress/components/Sparkline';
import VolumeBarChart from './progress/components/VolumeBarChart';
import MonthAdherenceGrid from './progress/components/MonthAdherenceGrid';

const SCREEN_W = Dimensions.get('window').width;

export default function ProgressTab() {
  const insets = useSafeAreaInsets();
  const history = useWorkoutStore((s) => s.workoutHistory);
  const assignments = useScheduleStore((s) => s.assignments);
  const { streak, badges } = useGamification();

  const summary = useMemo(() => computeSummaryStats(history), [history]);
  const top = useMemo(() => topExercisesByFrequency(history, 5), [history]);
  const top1RM = useMemo(() => topExercisesByFrequency(history, 3), [history]);
  const weekly = useMemo(() => weeklyVolumeSeries(history, 12), [history]);

  // Resolve current-month adherence. resolveRange is a non-reactive selector,
  // so we depend on assignments (reactive) + history to retrigger.
  const monthAdherence = useMemo(
    () =>
      buildMonthAdherence({
        anchor: todayISO(),
        resolveRange: (s, e) => useScheduleStore.getState().resolveRange(s, e),
        history,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignments, history],
  );

  const headerInsight = useMemo(() => detectGap(history) ?? detectConsistent(history), [history]);

  const chartW = SCREEN_W - Spacing.screen.horizontal * 2 - Spacing.lg * 2;
  const unlockedIds = new Set(badges.map((b) => b.id));
  const isEmpty = history.length === 0;

  // Content-as-headline: the accumulated session count is the one dominant
  // statement (Fraunces). Its subline is the momentum insight when there is
  // one, otherwise the concrete total volume moved.
  const sessionWord = summary.totalSessions === 1 ? 'sesión' : 'sesiones';
  const heroSub = isEmpty
    ? 'Aquí verás tu progreso cuando termines una sesión'
    : (headerInsight?.label ?? `${Math.round(summary.totalVolume)} kg movidos en total`);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero statement — the one dominant number, in Fraunces. */}
      <View style={styles.hero} accessible accessibilityRole="header">
        <Text style={styles.heroEyebrow}>Progreso</Text>
        <View style={styles.heroNumRow}>
          <Text style={styles.heroNum} maxFontSizeMultiplier={1.3}>
            {summary.totalSessions}
          </Text>
          <Text style={styles.heroUnit} maxFontSizeMultiplier={1.4}>
            {sessionWord}
          </Text>
        </View>
        <Text style={styles.heroSub} maxFontSizeMultiplier={1.6}>
          {heroSub}
        </Text>
      </View>

      {/* Esta semana */}
      <Card eyebrow="ESTA SEMANA">
        <KVRow label="Volumen" value={`${Math.round(summary.thisWeekVolume)} kg`} />
        <KVRow label="Sesiones" value={String(summary.thisWeekSessions)} />
        <KVRow label="Días activos" value={String(streak.current)} />
      </Card>

      {/* Volumen 12 semanas */}
      <Card eyebrow="VOLUMEN · 12 SEMANAS">
        <VolumeBarChart data={weekly} width={chartW} height={100} />
      </Card>

      {/* 1RM estimado */}
      <Card eyebrow="1RM ESTIMADO">
        {top1RM.length === 0 ? (
          <Text style={styles.empty}>Sin sesiones registradas aún</Text>
        ) : (
          top1RM.map((ex) => {
            const series = oneRMSeries(history, ex.exerciseId, 12);
            const sum = summarize1RM(series);
            const plateau = detectPlateau(history, ex.exerciseId);
            const prStreak = detectPRStreak(history, ex.exerciseId);
            const exInsight = prStreak ?? plateau;
            return (
              <View key={ex.exerciseId} style={styles.exerciseBlock}>
                <View style={styles.exerciseRow}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <View style={styles.oneRMValues}>
                    <Text style={styles.exerciseLatest}>
                      {sum.current > 0 ? `${stripZero(sum.current)} kg` : '—'}
                    </Text>
                    <Text style={[styles.trend, trendStyle(sum.trendPct)]}>
                      {formatTrend(sum.trendPct)}
                    </Text>
                  </View>
                </View>
                <Sparkline
                  points={series.map((p) => ({ x: p.date, y: p.oneRM }))}
                  width={chartW}
                  height={40}
                  stroke={Colors.ink.secondary}
                  showLastDot
                />
                {exInsight && <Text style={styles.exerciseInsight}>{exInsight.label}</Text>}
              </View>
            );
          })
        )}
      </Card>

      {/* Peso máximo */}
      <Card eyebrow="PESO MÁXIMO POR EJERCICIO">
        {top.length === 0 ? (
          <Text style={styles.empty}>Sin sesiones registradas aún</Text>
        ) : (
          top.map((ex) => {
            const series = maxWeightSeries(history, ex.exerciseId, 12);
            const latest = series.length > 0 ? series[series.length - 1].weight : null;
            return (
              <View key={ex.exerciseId} style={styles.exerciseBlock}>
                <View style={styles.exerciseRow}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={styles.exerciseLatest}>
                    {latest != null ? `${stripZero(latest)} kg` : '—'}
                  </Text>
                </View>
                <Sparkline
                  points={series.map((p) => ({ x: p.date, y: p.weight }))}
                  width={chartW}
                  height={40}
                  showLastDot
                />
              </View>
            );
          })
        )}
      </Card>

      {/* Adherencia */}
      <Card eyebrow="ADHERENCIA">
        <View style={styles.statRow}>
          <Stat
            label="Adherencia"
            value={monthAdherence.adherencePct != null ? `${monthAdherence.adherencePct}%` : '—'}
          />
          <Stat label="Planeadas" value={`${monthAdherence.done}/${monthAdherence.planned}`} />
          <Stat label="Extra" value={String(monthAdherence.unplanned)} />
        </View>
        <MonthAdherenceGrid data={monthAdherence} />
      </Card>

      {/* Logros — gamification, demoted out of the beta wedge (premise P3).
          The progression data above (volume, 1RM, adherence, constancia) is the
          memory surface and stays; badges are the hedge that hides. */}
      {isSurfaceVisible('gamification') && (
        <Card eyebrow="LOGROS">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.sm }}
          >
            {BADGE_DEFINITIONS.map((b) => {
              const unlocked = unlockedIds.has(b.id);
              return (
                <View
                  key={b.id}
                  style={[styles.badgeChip, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}
                >
                  <Text
                    style={[styles.badgeName, unlocked && { color: Colors.gold.deep }]}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          {badges.length === 0 && <Text style={styles.empty}>Tus logros aparecerán aquí</Text>}
        </Card>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue} maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

// Borderless neutral-tinted card (Ola-2 pattern 5). Progress is cross-
// discipline, so the fill is a warm neutral rather than a discipline hue.
function Card({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      {children}
    </View>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function stripZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function formatTrend(pct: number | null): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const abs = Math.abs(pct);
  return `${sign}${abs.toFixed(1)}%`;
}

function trendStyle(pct: number | null) {
  if (pct == null) return { color: Colors.ink.muted };
  if (pct > 0) return { color: Colors.semantic.success };
  if (pct < 0) return { color: Colors.ink.muted };
  return { color: Colors.ink.tertiary };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.void },
  content: { paddingHorizontal: Spacing.screen.horizontal },

  // Hero statement — the single dominant number, Fraunces.
  hero: {
    marginBottom: Spacing['2xl'],
  },
  heroEyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginBottom: Spacing.sm,
  },
  heroNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  heroNum: {
    ...Type.numHero,
    color: Colors.ink.primary,
  },
  heroUnit: {
    ...Type.titleSmall,
    color: Colors.ink.tertiary,
  },
  heroSub: {
    ...Type.body,
    color: Colors.ink.tertiary,
    marginTop: Spacing.sm,
  },

  // Borderless neutral-tinted card.
  card: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.md,
  },

  statRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statValue: { ...Type.numMedium, color: Colors.ink.primary, fontSize: 18 },
  statLabel: { ...Type.micro, color: Colors.ink.tertiary, marginTop: 2 },

  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  kvLabel: { ...Type.body, color: Colors.ink.secondary },
  kvValue: { ...Type.bodyEmph, color: Colors.ink.primary },

  exerciseBlock: { marginBottom: Spacing.md },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  exerciseName: { ...Type.bodyEmph, color: Colors.ink.primary, flex: 1 },
  exerciseLatest: { ...Type.bodyEmph, color: Colors.ink.tertiary },
  oneRMValues: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  trend: { ...Type.micro, fontWeight: '600' },
  exerciseInsight: { ...Type.micro, color: Colors.ink.tertiary, marginTop: 4 },

  headerInsight: {
    ...Type.bodyEmph,
    color: Colors.ink.secondary,
    marginBottom: Spacing.md,
  },

  empty: { ...Type.caption, color: Colors.ink.muted, paddingVertical: Spacing.sm },

  badgeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  badgeUnlocked: { backgroundColor: Colors.gold.glow },
  badgeLocked: { backgroundColor: Colors.bg.elevated },
  badgeName: { ...Type.caption, color: Colors.ink.tertiary },
});
