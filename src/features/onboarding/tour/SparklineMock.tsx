// src/features/onboarding/tour/SparklineMock.tsx
// Reuses the real Sparkline from the Progress dashboard with a hardcoded
// rising-trend series so the visual matches what the user will actually see
// after a few sessions. Centered, with a discreet caption underneath.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import Sparkline from '../../../screens/tabs/progress/components/Sparkline';

// 8 sessions, slight noise, clearly upward — feels real instead of synthetic.
const POINTS = [
  { x: 0, y: 80 },
  { x: 1, y: 82.5 },
  { x: 2, y: 82.5 },
  { x: 3, y: 85 },
  { x: 4, y: 87.5 },
  { x: 5, y: 85 },
  { x: 6, y: 90 },
  { x: 7, y: 92.5 },
];

const WIDTH = 280;
const HEIGHT = 90;

export default function SparklineMock() {
  return (
    <View style={styles.outer}>
      <Sparkline
        points={POINTS}
        width={WIDTH}
        height={HEIGHT}
        stroke={Colors.gold.deep}
        showLastDot
      />
      <Text style={styles.caption}>Press banca · últimas 8 sesiones</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: WIDTH,
    alignSelf: 'center',
  },
  caption: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
