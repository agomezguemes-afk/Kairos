// KAIROS — PresentationStep: the payoff. The seeded week + the block Kai built.
//
// The flow culminates with the plan already created and *shown*: a strip of the
// N days the user declared (weekAssignments), and the first real block below it
// (name + exercises). The block card enters with a celebratory spring and a
// success haptic — a clímax is celebrated, never a cold render. Reduce-motion
// keeps a crossfade and the haptic, drops the transform.

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Shadows, Spacing, Type } from '../../../../theme/tokens';
import { springs } from '../../../../theme/animations';
import type { RevealPlan } from '../reveal';
import { text } from '../textStyles';
import GoldButton from '../GoldButton';

interface PresentationStepProps {
  name: string | null;
  /** The seeded week + featured block Kai produced. */
  reveal: RevealPlan;
  onEnter: () => void;
}

function PresentationStep({ name, reveal, onEnter }: PresentationStepProps) {
  const reduce = useReducedMotion();
  const rise = useSharedValue(0);

  // The block Kai built lands with a celebratory pop + a success haptic — this
  // is the single moment in the flow that earns a notification-grade cue.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    rise.value = reduce ? withTiming(1, { duration: 160 }) : withSpring(1, springs.celebrate);
  }, [reduce, rise]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: reduce
      ? []
      : [{ scale: 0.94 + rise.value * 0.06 }, { translateY: (1 - rise.value) * 18 }],
  }));

  const sessions = reveal.week.length;
  const featured = reveal.featured;
  const weekLabel = reveal.week.map((d) => d.label).join(', ');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={text.eyebrowCenter}>TODO LISTO</Text>
        <Text style={styles.title}>
          {name ? `${name}, tu ` : 'Tu '}
          <Text style={text.titleAccent}>semana</Text>
          {'\n'}ya está sembrada
        </Text>
      </View>

      {/* The seeded week — one chip per declared training day. */}
      <View
        style={styles.week}
        accessibilityRole="summary"
        accessibilityLabel={`Tu semana: ${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'} — ${weekLabel}`}
      >
        {reveal.week.map((d, i) => (
          <Animated.View
            key={`${d.weekday}-${i}`}
            entering={reduce ? undefined : FadeIn.delay(120 + i * 55).duration(260)}
            style={styles.dayChip}
          >
            <Text style={styles.dayLabel}>{d.label}</Text>
            <View style={[styles.dayDot, { backgroundColor: d.accent }]} />
          </Animated.View>
        ))}
      </View>
      <Text style={styles.weekCaption}>
        {sessions} {sessions === 1 ? 'sesión' : 'sesiones'} · a partir de lo que me contaste
      </Text>

      {/* The featured block, shown in full before entering. */}
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.cardTop}>
          <View style={[styles.cardTag, { backgroundColor: featured.accent }]} />
          <Text style={styles.cardName} numberOfLines={1}>
            {featured.name}
          </Text>
        </View>
        <View>
          {featured.exercises.map((ex, i) => (
            <View
              key={`${ex.name}-${i}`}
              style={[styles.exRow, i === featured.exercises.length - 1 && styles.exRowLast]}
            >
              <Text style={styles.exName} numberOfLines={1}>
                {ex.name}
              </Text>
              {ex.detail ? <Text style={styles.exDetail}>{ex.detail}</Text> : null}
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={styles.note}>
        <View style={styles.noteDot} />
        <Text style={styles.noteText}>
          Kai vive en tu espacio: ajusta el plan y te aconseja a medida que entrenas.
        </Text>
      </View>

      <View style={styles.spacer} />
      <View style={styles.fullWidth}>
        <GoldButton label="Entrar a Kairos" hint="Kai piensa, tú entrenas" onPress={onEnter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.sm },
  fullWidth: { width: '100%' },
  spacer: { flex: 1, minHeight: Spacing.lg },

  header: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.lg },
  title: { ...Type.title, color: Colors.ink.primary, textAlign: 'center' },

  week: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dayChip: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    minWidth: 52,
  },
  dayLabel: { ...Type.caption, color: Colors.ink.secondary, fontWeight: '600' },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  weekCaption: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },

  card: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTag: { width: 4, height: 22, borderRadius: 2 },
  cardName: { ...Type.subheading, color: Colors.ink.primary, flex: 1 },
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
    gap: Spacing.md,
  },
  exRowLast: { borderBottomWidth: 0 },
  exName: { ...Type.body, color: Colors.ink.secondary, flex: 1 },
  exDetail: { ...Type.numSmall, color: Colors.ink.tertiary },

  note: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  noteDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.gold.base,
    marginTop: 6,
  },
  noteText: { ...Type.caption, color: Colors.ink.tertiary, flex: 1, lineHeight: 19 },
});

export default React.memo(PresentationStep);
