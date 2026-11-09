import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brut, Colors, Type, Spacing, Radius } from '../../theme/tokens';
import { BBox, BScreen, BText } from '../../features/coach/ui/brut';
import { useWorkoutStore } from '../../store/workoutStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useGamification } from '../../context/GamificationContext';
import { BADGE_DEFINITIONS } from '../../types/gamification';
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
const CARD_PAD = 14;

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

  // Charts sit inside a Brut box: screen pad + box padding + border + shadow.
  const chartW = SCREEN_W - Spacing.lg * 2 - CARD_PAD * 2 - Brut.border * 2 - Brut.shadow.md;
  const unlockedIds = new Set(badges.map((b) => b.id));
  const isEmpty = history.length === 0;

  return (
    <BScreen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
          KAIROS{' '}
          <BText variant="mono" size={11} color={Brut.muted}>
            / PROGRESO
          </BText>
        </BText>
        <BText variant="display" size={44} style={styles.title}>
          PROGRESO
        </BText>

        {headerInsight && <Text style={styles.headerInsight}>{headerInsight.label}</Text>}

        {/* Summary stats */}
        <View style={styles.statRow}>
          <Stat label="Sesiones" value={String(summary.totalSessions)} />
          <Stat label="Volumen" value={`${Math.round(summary.totalVolume)} kg`} />
          <Stat label="Esta sem" value={String(summary.thisWeekSessions)} />
        </View>

        {isEmpty && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              Aquí verás tu progreso cuando termines una sesión
            </Text>
          </View>
        )}

        {/* Esta semana */}
        <Section eyebrow="ESTA SEMANA">
          <KVRow label="Volumen" value={`${Math.round(summary.thisWeekVolume)} kg`} />
          <KVRow label="Sesiones" value={String(summary.thisWeekSessions)} />
        </Section>

        {/* Volumen 12 semanas */}
        <Section eyebrow="VOLUMEN 12 SEMANAS">
          <VolumeBarChart data={weekly} width={chartW} height={100} />
        </Section>

        {/* 1RM estimado */}
        <Section eyebrow="1RM ESTIMADO">
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
                    stroke={Colors.gold.deep}
                    showLastDot
                  />
                  {exInsight && <Text style={styles.exerciseInsight}>{exInsight.label}</Text>}
                </View>
              );
            })
          )}
        </Section>

        {/* Peso máximo */}
        <Section eyebrow="PESO MÁXIMO POR EJERCICIO">
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
        </Section>

        {/* Constancia */}
        <Section eyebrow="CONSTANCIA">
          <KVRow label="Días activos" value={String(streak.current)} />
        </Section>

        {/* Adherencia */}
        <Section eyebrow="ADHERENCIA">
          <View style={styles.statRow}>
            <Stat
              label="Adherencia"
              value={monthAdherence.adherencePct != null ? `${monthAdherence.adherencePct}%` : '—'}
            />
            <Stat label="Planeadas" value={`${monthAdherence.done}/${monthAdherence.planned}`} />
            <Stat label="Extra" value={String(monthAdherence.unplanned)} />
          </View>
          <MonthAdherenceGrid data={monthAdherence} />
        </Section>

        {/* Logros */}
        <Section eyebrow="LOGROS">
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
                    style={[styles.badgeName, unlocked && { color: Brut.ink }]}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          {badges.length === 0 && <Text style={styles.empty}>Tus logros aparecerán aquí</Text>}
        </Section>
      </ScrollView>
    </BScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <BBox radius={Brut.radius.md} style={{ flex: 1 }} contentStyle={styles.statBox}>
      <BText variant="monoBold" size={10} color={Brut.muted}>
        {label.toUpperCase()}
      </BText>
      <BText variant="display" size={24} numberOfLines={1}>
        {value}
      </BText>
    </BBox>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <BBox style={styles.section} contentStyle={styles.sectionBody}>
      <BText variant="monoBold" size={10} style={styles.eyebrow}>
        {eyebrow}
      </BText>
      {children}
    </BBox>
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
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  title: { marginTop: Spacing.sm, marginBottom: Spacing.md },

  statRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statBox: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  statValue: { ...Type.bodyEmph, color: Colors.ink.primary, fontSize: 18 },
  statLabel: { ...Type.micro, color: Colors.ink.tertiary, marginTop: 2 },

  emptyHint: {
    borderWidth: Brut.border,
    borderStyle: 'dashed',
    borderColor: Brut.ink,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyHintText: { ...Type.caption, color: Colors.ink.muted },

  section: { marginBottom: Spacing.md },
  sectionBody: { padding: CARD_PAD },
  eyebrow: { letterSpacing: 1.2, marginBottom: Spacing.sm },

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
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
  },
  badgeUnlocked: { backgroundColor: Brut.accent },
  badgeLocked: { borderStyle: 'dashed', opacity: 0.6 },
  badgeName: { ...Type.caption, color: Colors.ink.tertiary },
});
