// src/features/planner/components/DayCell.tsx
// Single day cell — used inside both WeekStrip and MonthGrid.
// Visual states: today, selected, hasAssignment, isOtherMonth.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Radius } from '../../../theme/tokens';
import { formatDayNumber, formatWeekdayNarrow } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';

interface Props {
  date: ISODate;
  selected: boolean;
  isToday: boolean;
  hasAssignment: boolean;
  isOtherMonth?: boolean;
  showWeekdayLabel?: boolean;
  size?: 'week' | 'month';
  onPress: (date: ISODate) => void;
}

function DayCellInner({
  date, selected, isToday, hasAssignment, isOtherMonth, showWeekdayLabel, size = 'week', onPress,
}: Props) {
  const handle = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress(date);
  };

  const numberColor =
    isOtherMonth   ? Colors.ink.muted    :
    selected       ? Colors.ink.inverse  :
    isToday        ? Colors.gold.base    :
                     Colors.ink.primary;

  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={date}
      style={({ pressed }) => [
        styles.cell,
        size === 'week' ? styles.weekSize : styles.monthSize,
        pressed && styles.pressed,
      ]}
    >
      {showWeekdayLabel && (
        <Text style={[styles.weekday, isOtherMonth && { color: Colors.ink.muted }]}>
          {formatWeekdayNarrow(date)}
        </Text>
      )}
      <View style={[
        styles.numberWrap,
        selected && styles.numberWrapSelected,
        !selected && isToday && styles.numberWrapToday,
      ]}>
        <Text style={[styles.number, { color: numberColor }]}>
          {formatDayNumber(date)}
        </Text>
      </View>
      <View style={styles.dotRow}>
        {hasAssignment && <View style={[
          styles.dot,
          selected && { backgroundColor: Colors.ink.inverse },
        ]} />}
      </View>
    </Pressable>
  );
}

export default React.memo(DayCellInner);

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  weekSize:  { minHeight: 56, paddingHorizontal: 4 },
  monthSize: { minHeight: 44, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  weekday: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginBottom: 4,
  },
  numberWrap: {
    width: 32, height: 32,
    borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  numberWrapSelected: {
    backgroundColor: Colors.gold.base,
  },
  numberWrapToday: {
    borderWidth: 1.5,
    borderColor: Colors.gold.base,
  },
  number: {
    ...Type.body,
    fontWeight: '500',
  },
  dotRow: {
    height: 6, marginTop: 3,
    flexDirection: 'row', justifyContent: 'center',
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.gold.base,
  },
});
