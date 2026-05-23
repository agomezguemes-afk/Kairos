// KAIROS — Progress Screen v3
// Spec: §5.7, §7 — token v3, Type.numHero for total volume, eyebrow labels.
// paddingBottom: 88 for floating tab bar (spec §4.1).

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KIcon from '../components/icons/KIcon';
import EmptyState from '../components/EmptyState';
import { useWorkoutStore } from '../store/workoutStore';
import { useGamification } from '../context/GamificationContext';
import { Colors, Type, Spacing, Radius, Shadows } from '../theme/tokens';

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}m`;
}

export default function ProgressScreen() {
  const insets  = useSafeAreaInsets();
  const history = useWorkoutStore((s) => s.workoutHistory);
  const { streak, prCards } = useGamification();

  const totals = useMemo(() => {
    let sets        = 0;
    let volume      = 0;
    let durationSec = 0;
    for (const h of history) {
      sets        += h.setCount;
      volume      += h.totalVolume;
      durationSec += h.durationSec;
    }
    return {
      sessions:    history.length,
      sets,
      volume:      Math.round(volume),
      durationMin: Math.round(durationSec / 60),
    };
  }, [history]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop:    insets.top + Spacing.md,
          paddingBottom: insets.bottom + 88,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Screen title — spec §5.7: serif via Type.title */}
      <Text style={styles.title}>Progreso</Text>

      {/* Hero stat — total volume (spec §5.7 editorial layout) */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>VOLUMEN TOTAL</Text>
        <View style={styles.eyebrowRule} />
        <Text style={styles.heroNum}>{totals.volume}</Text>
        <Text style={styles.heroUnit}>kg levantados</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard icon="zap"       label="RACHA"    value={String(streak.current)} />
        <StatCard icon="chart"     label="SESIONES" value={String(totals.sessions)} />
        <StatCard icon="barbell"   label="SERIES"   value={String(totals.sets)} />
        <StatCard icon="clock"     label="TIEMPO"   value={`${totals.durationMin}m`} />
        <StatCard icon="dashboard" label="PRs"      value={String(prCards.length)} />
      </View>

      {/* Historial reciente */}
      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>HISTORIAL RECIENTE</Text>
        <View style={styles.eyebrowRule} />
      </View>

      {history.length === 0 ? (
        <EmptyState type="exercises" />
      ) : (
        <View style={styles.historyList}>
          {history.slice(0, 12).map((h) => (
            <View key={h.id} style={styles.historyItem}>
              <View style={styles.historyHead}>
                <Text style={styles.historyName} numberOfLines={1}>
                  {h.blockName}
                </Text>
                <Text style={styles.historyDate}>{fmtDate(h.startedAt)}</Text>
              </View>
              <Text style={styles.historyMeta}>
                {h.setCount} series · {Math.round(h.totalVolume)} kg · {fmtDuration(h.durationSec)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = React.memo(function StatCard({
  icon,
  label,
  value,
}: {
  icon: import('../components/icons/KIcon').KIconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <KIcon name={icon} size={16} color={Colors.gold.base} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.void,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
    gap: Spacing.lg,
  },

  // Title — Type.title serif (spec §5.7)
  title: {
    ...Type.title,
    color: Colors.ink.primary,
  },

  // Hero stat card (spec §5.7 editorial layout)
  heroCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg.warm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.gold.glow,
    gap: Spacing.xs,
    ...Shadows.subtle,
  },
  heroEyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  eyebrowRule: {
    height: 1,
    width: 28,
    backgroundColor: Colors.gold.base,
    marginBottom: Spacing.xs,
  },
  // Type.numHero serif for hero volume (spec §5.7)
  heroNum: {
    ...Type.numHero,
    color: Colors.ink.primary,
  },
  heroUnit: {
    ...Type.caption,
    color: Colors.ink.muted,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flexBasis: '31%',
    flexGrow: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.surface,
    alignItems: 'flex-start',
    gap: 6,
    ...Shadows.subtle,
  },
  statValue: {
    ...Type.numMedium,
    color: Colors.ink.primary,
  },
  statLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    fontSize: 9,
  },

  // Section header
  sectionHeader: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },

  // History list
  historyList: {
    gap: Spacing.sm,
  },
  historyItem: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.surface,
    gap: 4,
    ...Shadows.subtle,
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyName: {
    flex: 1,
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  historyDate: {
    ...Type.numSmall,
    color: Colors.ink.muted,
  },
  historyMeta: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
});
