// src/features/planner/components/MovePicker.tsx
// Modal sheet: pick a destination date for a single occurrence. Reuses
// DayCell so the calendar feels identical to the main planner grid.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { addMonthsISO, monthGridDays, formatMonthYear, fromISODate, todayISO } from '../lib/dates';
import DayCell from './DayCell';
import { useScheduleStore } from '../../../store/scheduleStore';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  fromDate: ISODate | null;
  onClose: () => void;
}

export default function MovePicker({ visible, assignmentId, fromDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const move = useScheduleStore((s) => s.moveOccurrence);
  const [anchor, setAnchor] = useState<ISODate>(fromDate ?? todayISO());

  // Re-anchor when the source date changes (e.g. opening for a new occurrence).
  useEffect(() => {
    if (fromDate) setAnchor(fromDate);
  }, [fromDate]);

  if (!assignmentId || !fromDate) return null;

  const days = monthGridDays(anchor);
  const focusedMonth = fromISODate(anchor).getMonth();
  const today = todayISO();

  const pick = (d: ISODate) => {
    if (d === fromDate) {
      onClose();
      return;
    }
    move(assignmentId, fromDate, d);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Mover sesión</Text>
          <Text style={styles.subtitle}>Elige una nueva fecha.</Text>

          <View style={styles.headerRow}>
            <Pressable
              onPress={() => setAnchor(addMonthsISO(anchor, -1))}
              hitSlop={12}
              accessibilityLabel="Mes anterior"
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={styles.month}>{formatMonthYear(anchor)}</Text>
            <Pressable
              onPress={() => setAnchor(addMonthsISO(anchor, 1))}
              hitSlop={12}
              accessibilityLabel="Mes siguiente"
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayHeader}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((w) => (
              <Text key={w} style={styles.weekdayHeaderText}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((d) => (
              <View key={d} style={styles.cell}>
                <DayCell
                  date={d}
                  selected={d === fromDate}
                  isToday={d === today}
                  hasAssignment={false}
                  isOtherMonth={fromISODate(d).getMonth() !== focusedMonth}
                  size="month"
                  onPress={pick}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.paper.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  title: {
    ...Type.title,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.ink.primary,
    marginBottom: 2,
  },
  subtitle: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  arrow: {
    fontSize: 24,
    color: Colors.ink.secondary,
    paddingHorizontal: Spacing.sm,
  },
  month: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    textTransform: 'capitalize',
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingBottom: Spacing.xs,
  },
  weekdayHeaderText: {
    flex: 1,
    textAlign: 'center',
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: Spacing.lg,
  },
  cell: {
    width: `${100 / 7}%`,
    paddingVertical: 2,
  },
});
