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
//
// STORY-02: the greeting shrinks to a compact single line when today has a
// session to start or continue — that CTA is the one thing that matters right
// now, and the hero shouldn't push it below the fold. HomeHero resolves its
// own mode via useDayCardState(todayISO()) — deliberately decoupled from
// TodayPlanner's selectedDate: the greeting is ALWAYS about today, even while
// the user browses another day on the calendar.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

import { Colors, Type, Spacing, Animation } from '../../../theme/tokens';
import { todayISO, formatLongDate } from '../lib/dates';
import { getGreeting } from '../lib/momentum';
import { useMomentumPhrase } from '../hooks/useMomentumPhrase';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useDayCardState } from '../hooks/useDayCardState';
import { heroMode } from '../lib/heroMode';

export default function HomeHero() {
  const today = todayISO();
  const userName = useWorkoutStore((s) => s.userName).trim();
  const firstName = userName ? userName.split(/\s+/)[0] : null;
  const greeting = getGreeting(firstName);
  const phrase = useMomentumPhrase();
  const reduceMotion = useReducedMotion();

  const todayState = useDayCardState(today);
  const mode = heroMode(todayState.variant);
  const isCompact = mode === 'compact';

  return (
    <Animated.View
      entering={FadeIn.duration(Animation.duration.normal)}
      layout={
        reduceMotion ? undefined : LinearTransition.duration(220).easing(Easing.out(Easing.cubic))
      }
      style={[styles.container, isCompact && styles.containerCompact]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${greeting}. ${formatLongDate(today)}.${isCompact ? '' : ` ${phrase}`}`}
    >
      <Text style={styles.eyebrow} accessibilityElementsHidden importantForAccessibility="no">
        {formatLongDate(today)}
      </Text>
      {isCompact ? (
        <>
          {/* Compact: date + one greeting line, nothing else. Today's session
              is the CTA that matters; the momentum phrase (STORY-08 §4) is
              dropped here so it can't compete with the DayCard CTA below —
              it survives only in full mode. Truncating the name is acceptable
              (unlike full): it lives whole in the a11y label. */}
          <Text
            style={styles.greetingCompact}
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={1.3}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {greeting}
          </Text>
        </>
      ) : (
        <>
          {/* No numberOfLines — the greeting wraps rather than ellipsising a
              name. Font scaling is allowed (Dynamic Type) but capped so a huge
              setting can't push the hero off-screen; the display face carries
              the moment. */}
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
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.lg,
  },
  containerCompact: {
    paddingBottom: Spacing.md,
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
  greetingCompact: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
});
