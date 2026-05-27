// src/features/planner/components/WeekStrip.tsx
// Horizontal 7-day strip. Used as the compact calendar view.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '../../../theme/tokens';
import DayCell from './DayCell';
import { weekDays, todayISO } from '../lib/dates';
import { useScheduleForRange } from '../hooks/useScheduleForRange';
import type { ISODate } from '../../../types/schedule';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function WeekStrip({ selectedDate, onSelect }: Props) {
  const days = useMemo(() => weekDays(selectedDate), [selectedDate]);
  const today = todayISO();
  const range = useScheduleForRange(days[0], days[6]);

  return (
    <View style={styles.row}>
      {days.map((d) => (
        <View key={d} style={styles.cell}>
          <DayCell
            date={d}
            selected={d === selectedDate}
            isToday={d === today}
            hasAssignment={(range.get(d) ?? []).length > 0}
            showWeekdayLabel
            size="week"
            onPress={onSelect}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen.horizontal,
  },
  cell: { flex: 1 },
});
