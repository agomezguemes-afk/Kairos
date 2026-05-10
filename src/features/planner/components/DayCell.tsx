// src/features/planner/components/DayCell.tsx
// Single day cell — used inside both WeekStrip and MonthGrid.
// Visual states: today, selected, isOtherMonth, plus discipline-colored dots
// for any day with an assignment (parent passes the colors so this stays
// a dumb display component).

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
  /** Discipline colors for assigned blocks, capped at 3 by the parent.
   * Empty/undefined → no dots. */
  dotColors?: string[];
  /** @deprecated Use dotColors. Kept for legacy callers (MovePicker, pickers). */
  hasAssignment?: boolean;
  isOtherMonth?: boolean;
  showWeekdayLabel?: boolean;
  size?: 'week' | 'month';
  onPress: (date: ISODate) => void;
}

function DayCellInner({
  date, selected, isToday, dotColors, hasAssignment, isOtherMonth,
  showWeekdayLabel, size = 'week', onPress,
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

  // Resolve final dot list. dotColors wins; legacy hasAssignment is a
  // single gold dot fallback for callers that haven't migrated.
  const dots: string[] =
    dotColors && dotColors.length > 0
      ? dotColors
      : hasAssignment
        ? [Colors.gold.base]
        : [];

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
        {dots.slice(0, 3).map((c, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: selected ? Colors.ink.inverse : c },
              i > 0 && styles.dotGap,
            ]}
          />
        ))}
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
  // WHY: tighter vertical extents so the persistent month grid doesn't
  // dominate the screen. minHeight reduced from 56/44 → 50/40.
  weekSize:  { minHeight: 50, paddingHorizontal: 4 },
  monthSize: { minHeight: 40, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  weekday: {
    ...Type.micro,
    color: Colors.ink.muted,
    fontWeight: '500',
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
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
  },
  // WHY: tiny gap between dots — read as separate signals, not a smudge.
  dotGap: {
    marginLeft: 2,
  },
});
