// src/features/onboarding/tour/MonthGridMock.tsx
// Illustrative 4×7 calendar for tour page 2 ("Programa"). Gold dots mark
// "assigned" days; one cell has a gold ring marking "today". Token-only.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';

const ROWS = 4;
const COLS = 7;
const TODAY_INDEX = 10; // arbitrary mid-grid cell
const ASSIGNED = new Set([1, 3, 8, 10, 15, 17, 22, 24]);

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function MonthGridMock() {
  // Generate a simple sequential day count starting at 1, masking the trailing
  // cells so the grid feels like a real month tail (~28 visible cells works).
  const cells = Array.from({ length: ROWS * COLS }, (_, i) => i);

  return (
    <View style={styles.outer}>
      <View style={styles.headerRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.headerText}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((i) => {
          const dayNumber = i + 1;
          const isToday = i === TODAY_INDEX;
          const isAssigned = ASSIGNED.has(i);
          return (
            <View key={i} style={styles.cell}>
              <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                <Text style={[styles.dayText, isToday && styles.dayTextToday]}>{dayNumber}</Text>
              </View>
              {isAssigned && <View style={styles.dot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Sized so the grid sits comfortably inside the 320pt page width.
const CELL_SIZE = 36;

const styles = StyleSheet.create({
  outer: {
    width: CELL_SIZE * COLS,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  headerText: {
    ...Type.micro,
    color: Colors.ink.muted,
    width: CELL_SIZE,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: Colors.gold.base,
  },
  dayText: {
    ...Type.caption,
    color: Colors.ink.secondary,
  },
  dayTextToday: {
    color: Colors.gold.deep,
    fontWeight: '700',
  },
  // The "assigned" indicator — small gold dot under the day number, matching
  // CalendarView's vocabulary.
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold.base,
  },
});
