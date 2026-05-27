import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Type, Spacing } from '../../../../theme/tokens';
import { formatMonthYear, formatDayNumber } from '../../../../features/planner/lib/dates';
import type { DayCell, MonthAdherence } from '../lib/adherence';

interface Props {
  data: MonthAdherence;
}

const STATUS_BG: Record<DayCell['status'], string | null> = {
  'rest':              null,
  'planned':           Colors.bg.elevated,
  'planned-done':      Colors.semantic.success,
  'planned-missed':    Colors.semantic.errorMuted,
  'unplanned-done':    Colors.gold.glow,
  'planned-skipped':   Colors.bg.elevated,
};

const STATUS_INK: Record<DayCell['status'], string> = {
  'rest':              Colors.ink.muted,
  'planned':           Colors.ink.tertiary,
  'planned-done':      Colors.ink.inverse,
  'planned-missed':    Colors.semantic.error,
  'unplanned-done':    Colors.gold.deep,
  'planned-skipped':   Colors.ink.muted,
};

export default function MonthAdherenceGrid({ data }: Props) {
  return (
    <View>
      <Text style={styles.monthLabel}>{formatMonthYear(data.anchor)}</Text>
      <View style={styles.weekdayHeader}>
        {['L','M','X','J','V','S','D'].map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {data.cells.map((c) => {
          const bg = STATUS_BG[c.status];
          const ink = c.isOtherMonth ? Colors.ink.muted : STATUS_INK[c.status];
          return (
            <View key={c.date} style={styles.cell}>
              <View style={[
                styles.dayDot,
                bg ? { backgroundColor: bg } : null,
                c.isToday && !c.isOtherMonth && { borderColor: Colors.gold.base, borderWidth: 1.5 },
              ]}>
                <Text style={[styles.dayText, { color: ink }]}>{formatDayNumber(c.date)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthLabel: {
    ...Type.bodyEmph, color: Colors.ink.primary,
    textTransform: 'capitalize', textAlign: 'center', marginBottom: Spacing.sm,
  },
  weekdayHeader: {
    flexDirection: 'row', marginBottom: Spacing.xs,
  },
  weekday: {
    flex: 1, textAlign: 'center',
    ...Type.micro, color: Colors.ink.tertiary,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100/7}%`, paddingVertical: 2, alignItems: 'center' },
  dayDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { ...Type.micro, fontWeight: '600' },
});
