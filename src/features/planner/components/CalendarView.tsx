// src/features/planner/components/CalendarView.tsx
// View toggle [Semana | Mes] with animated layout transition.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import WeekStrip from './WeekStrip';
import MonthGrid from './MonthGrid';
import type { ISODate } from '../../../types/schedule';

type Mode = 'week' | 'month';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function CalendarView({ selectedDate, onSelect }: Props) {
  const [mode, setMode] = useState<Mode>('week');

  const switchTo = (m: Mode) => {
    if (m === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode(m);
  };

  return (
    <Animated.View layout={LinearTransition.duration(280)}>
      <View style={styles.toggle}>
        <Pressable
          onPress={() => switchTo('week')}
          accessibilityRole="button"
          style={[styles.tab, mode === 'week' && styles.tabActive]}
        >
          <Text style={[styles.tabText, mode === 'week' && styles.tabTextActive]}>Semana</Text>
        </Pressable>
        <Pressable
          onPress={() => switchTo('month')}
          accessibilityRole="button"
          style={[styles.tab, mode === 'month' && styles.tabActive]}
        >
          <Text style={[styles.tabText, mode === 'month' && styles.tabTextActive]}>Mes</Text>
        </Pressable>
      </View>

      {mode === 'week' ? (
        <WeekStrip selectedDate={selectedDate} onSelect={onSelect} />
      ) : (
        <MonthGrid selectedDate={selectedDate} onSelect={onSelect} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  tabActive: {
    backgroundColor: Colors.bg.surface,
  },
  tabText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  tabTextActive: {
    color: Colors.ink.primary,
    fontWeight: '600',
  },
});
