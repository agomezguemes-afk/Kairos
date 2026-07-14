// HomeHero — the single dominant statement of the "Hoy" screen (Design v2,
// pattern 1 "el contenido es el titular"). A quiet dated eyebrow, then the
// greeting in the loudest brand voice (Fraunces display), then one momentum
// line. Nothing competes: the session card below is the hero content, this is
// its headline.
//
// Bug fix carried here: the old PlannerHeader ran the greeting at Type.title
// with numberOfLines={1}, so "Buenos días, Álvaro" ellipsised to
// "Buenos días, Á…". Here the greeting WRAPS (no line clamp), so a name never
// gets truncated — it flows onto a second line instead.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors, Type, Spacing, Animation } from '../../../theme/tokens';
import { todayISO, formatLongDate } from '../lib/dates';
import { getGreeting } from '../lib/momentum';
import { useMomentumPhrase } from '../hooks/useMomentumPhrase';
import { useWorkoutStore } from '../../../store/workoutStore';

export default function HomeHero() {
  const today = todayISO();
  const userName = useWorkoutStore((s) => s.userName).trim();
  const firstName = userName ? userName.split(/\s+/)[0] : null;
  const greeting = getGreeting(firstName);
  const phrase = useMomentumPhrase();

  return (
    <Animated.View
      entering={FadeIn.duration(Animation.duration.normal)}
      style={styles.container}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${greeting}. ${formatLongDate(today)}. ${phrase}`}
    >
      <Text style={styles.eyebrow} accessibilityElementsHidden importantForAccessibility="no">
        {formatLongDate(today)}
      </Text>
      {/* No numberOfLines — the greeting wraps rather than ellipsising a name.
          Font scaling is allowed (Dynamic Type) but capped so a huge setting
          can't push the hero off-screen; the display face carries the moment. */}
      <Text
        style={styles.greeting}
        maxFontSizeMultiplier={1.4}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {greeting}
      </Text>
      <Text
        style={styles.phrase}
        maxFontSizeMultiplier={1.6}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {phrase}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.lg,
  },
  eyebrow: {
    ...Type.caption,
    color: Colors.ink.muted,
    textTransform: 'capitalize',
    marginBottom: Spacing.xs,
  },
  greeting: {
    ...Type.heroDisplay,
    color: Colors.ink.primary,
  },
  phrase: {
    ...Type.body,
    color: Colors.ink.tertiary,
    marginTop: Spacing.md,
  },
});
