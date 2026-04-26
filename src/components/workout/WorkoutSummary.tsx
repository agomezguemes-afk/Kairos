import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import KIcon from '../icons/KIcon';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import { Colors } from '../../theme/tokens';

interface Props {
  entry: WorkoutHistoryEntry;
  onClose: () => void;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function WorkoutSummary({ entry, onClose }: Props) {
  const stats: { label: string; value: string }[] = [
    { label: 'Ejercicios', value: String(entry.exerciseCount) },
    { label: 'Series', value: String(entry.setCount) },
    { label: 'Volumen', value: `${Math.round(entry.totalVolume)} kg` },
    { label: 'Duración', value: fmtDuration(entry.durationSec) },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <KIcon name="zap" size={48} color={Colors.gold[500]} />
      </View>
      <Text style={styles.title}>Entrenamiento completado</Text>
      <Text style={styles.subtitle}>{entry.blockName}</Text>

      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={onClose} style={styles.cta}>
        <Text style={styles.ctaText}>Listo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212,175,55,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    color: Colors.text_v2.primary.dark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(245,240,232,0.6)',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(245,240,232,0.06)',
    alignItems: 'flex-start',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text_v2.primary.dark,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(245,240,232,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cta: {
    marginTop: 16,
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.gold[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
});
