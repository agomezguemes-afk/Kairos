// ReadinessLine — the day's state as one line of ink. (Design v3 §3 / §4)
//
// Replaces ReadinessRings, which was three faults in one component:
//   1. the Apple-Fitness activity-rings cliché,
//   2. the "row of three rounded cards" — tell #1 of AI-generated UI,
//   3. three accent hues on a screen whose contract is ONE gold (Kai's orb).
//
// What survives is the only part that was ever content: the reading. The three
// scores stay — as tabular numerals on a metadata line, cross-referenceable at a
// glance — but they no longer cosplay as a dashboard. No card, no border, no
// shadow, no hue: a hairline rule, an eyebrow, the sentence, the figures.
// The tension comes from the empty right column, not from decoration.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors, Type, Spacing } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { computeReadiness } from '../../../lib/readiness/readiness';

function ReadinessLineImpl() {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const snapshot = useMemo(() => computeReadiness(history), [history]);

  // Day 0: no sessions yet → no data to score. Never fabricate 90/70/100.
  const calibrating = snapshot.signals.daysSinceLastWorkout === null;
  const headline = calibrating ? 'Se calibra con tu primer entrenamiento.' : snapshot.headline;

  const figures = useMemo(
    () =>
      [
        { label: 'Energía', value: snapshot.energia },
        { label: 'Fuerza', value: snapshot.fuerza },
        { label: 'Recuperación', value: snapshot.recuperacion },
      ] as const,
    [snapshot.energia, snapshot.fuerza, snapshot.recuperacion],
  );

  const spoken = calibrating
    ? `Tu estado hoy: por calibrar. ${headline}`
    : `Tu estado hoy: ${headline} Energía ${snapshot.energia} de 100. ` +
      `Fuerza ${snapshot.fuerza} de 100. Recuperación ${snapshot.recuperacion} de 100.`;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={spoken}
    >
      <Text
        style={styles.eyebrow}
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={1.6}
      >
        Tu estado hoy
      </Text>
      <Text
        style={styles.headline}
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={1.5}
      >
        {headline}
      </Text>

      <View style={styles.figures} accessibilityElementsHidden importantForAccessibility="no">
        {figures.map(({ label, value }, i) => (
          <React.Fragment key={label}>
            {i > 0 ? <Text style={styles.sep}>·</Text> : null}
            <Text style={styles.figure} maxFontSizeMultiplier={1.4}>
              <Text style={styles.figureLabel}>{label} </Text>
              {calibrating ? '—' : value}
            </Text>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const ReadinessLine = React.memo(ReadinessLineImpl);
export default ReadinessLine;

const styles = StyleSheet.create({
  // Sits flush inside its HomeFolder section — the container supplies the
  // gutter and the hairline above (STORY-04); no own margins, no own rule.
  container: {},
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginBottom: Spacing.sm,
  },
  headline: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  figure: {
    ...Type.numSmall,
    fontSize: 14,
    color: Colors.ink.secondary,
  },
  figureLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  sep: {
    ...Type.micro,
    color: Colors.ink.faint,
  },
});
