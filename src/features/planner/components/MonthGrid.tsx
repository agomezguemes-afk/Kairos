// src/features/planner/components/MonthGrid.tsx
// 6×7 month grid. Header shows month label + arrow nav.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing } from '../../../theme/tokens';
import DayCell from './DayCell';
import {
  monthGridDays, formatMonthYear, addMonthsISO, todayISO, fromISODate,
} from '../lib/dates';
import { useScheduleForRange } from '../hooks/useScheduleForRange';
import { useWorkoutStore } from '../../../store/workoutStore';
import type { ISODate } from '../../../types/schedule';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function MonthGrid({ selectedDate, onSelect }: Props) {
  const [anchor, setAnchor] = useState<ISODate>(selectedDate);
  const today = todayISO();

  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const range = useScheduleForRange(days[0], days[days.length - 1]);
  const blocks = useWorkoutStore((s) => s.blocks);
  const focusedMonth = fromISODate(anchor).getMonth();

  // Pre-build a lookup ISODate → discipline colors[] (cap 3 for the dot row).
  // Done in the parent so each DayCell stays a dumb display component.
  const dotsByDate = useMemo(() => {
    const map = new Map<ISODate, string[]>();
    range.forEach((resolved, date) => {
      const colors = resolved
        .map((r) => blocks.find((b) => b.id === r.blockId))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => Colors.discipline[b.discipline] ?? Colors.gold.base)
        .slice(0, 3);
      if (colors.length > 0) map.set(date, colors);
    });
    return map;
  }, [range, blocks]);

  const goPrev = () => { Haptics.selectionAsync().catch(() => {}); setAnchor(addMonthsISO(anchor, -1)); };
  const goNext = () => { Haptics.selectionAsync().catch(() => {}); setAnchor(addMonthsISO(anchor, 1));  };

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={goPrev} accessibilityLabel="Mes anterior" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthYear(anchor)}</Text>
        <Pressable onPress={goNext} accessibilityLabel="Mes siguiente" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayHeader}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((w) => (
          <Text key={w} style={styles.weekdayHeaderText}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((d) => (
          <View key={d} style={styles.cell}>
            <DayCell
              date={d}
              selected={d === selectedDate}
              isToday={d === today}
              dotColors={dotsByDate.get(d)}
              isOtherMonth={fromISODate(d).getMonth() !== focusedMonth}
              size="month"
              onPress={onSelect}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // WHY: tightened header — was paddingBottom: sm + arrow 24pt + bodyEmph;
  // smaller chrome lets the DayCard breathe immediately below.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.xs,
  },
  arrow: {
    fontSize: 18,
    color: Colors.ink.tertiary,
    paddingHorizontal: Spacing.sm,
    fontWeight: '500',
  },
  monthLabel: {
    ...Type.caption,
    color: Colors.ink.secondary,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.xs,
  },
  weekdayHeaderText: {
    flex: 1,
    textAlign: 'center',
    ...Type.micro,
    color: Colors.ink.muted,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.screen.horizontal,
  },
  cell: {
    width: `${100 / 7}%`,
    // WHY: tighter than v1's 2pt — the grid was dominating the screen.
    paddingVertical: 1,
  },
});
