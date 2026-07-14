// KAIROS — The block-ready moment of the "Hoy" conversation (Design v2).
//
// When Kai finishes building, the session materialises as a borderless card
// tinted by its discipline (pattern 5), with a duration chip, the exercise
// preview, and the "memoria que compone" cue when history pre-filled it. The
// primary action is a dark INK pill ("Empezar ahora") — gold is reserved for
// the Kai orb in the header, so this card speaks in ink + discipline colour.
// Secondary = an outline pill; the reset is a quiet ghost. Success haptic on
// mount — the block landing is the payoff of the whole conversation.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import KIcon from '../../components/icons/KIcon';
import type { BuiltSession } from '../../lib/ai/conversation';
import { Animation, Colors, Radius, Spacing, Type } from '../../theme/tokens';

interface Props {
  session: BuiltSession;
  onStart: () => void;
  onView: () => void;
  onAskAgain: () => void;
}

function BlockReadyCard({ session, onStart, onView, onAskAgain }: Props) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const accent = Colors.discipline[session.discipline] ?? Colors.gold.base;
  const tint = Colors.tint[session.discipline] ?? Colors.bg.warm;

  return (
    <Animated.View
      entering={FadeInDown.springify()
        .damping(Animation.spring.gentle.damping)
        .stiffness(Animation.spring.gentle.stiffness)}
      style={[styles.card, { backgroundColor: tint }]}
    >
      <View style={styles.headRow}>
        <Text style={[styles.eyebrow, { color: accent }]} accessibilityRole="header">
          Tu bloque de hoy
        </Text>
        {session.durationMin > 0 ? (
          <View
            style={styles.durationChip}
            accessible
            accessibilityLabel={`Duración aproximada ${session.durationMin} minutos`}
          >
            <KIcon name="clock" size={12} color={Colors.ink.tertiary} />
            <Text style={styles.durationText} maxFontSizeMultiplier={1.5}>
              {session.durationMin} min
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <Text style={styles.title} numberOfLines={3}>
          {session.blockName}
        </Text>
      </View>

      <View style={styles.exercises}>
        {session.exercises.map((ex, i) => (
          <View
            key={`${i}-${ex.name}`}
            style={styles.exerciseRow}
            accessible
            accessibilityLabel={ex.detail.length > 0 ? `${ex.name}, ${ex.detail}` : ex.name}
          >
            <Text style={styles.exerciseName} numberOfLines={2}>
              {ex.name}
            </Text>
            {ex.detail.length > 0 ? (
              <Text style={styles.exerciseDetail} maxFontSizeMultiplier={1.6}>
                {ex.detail}
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* "Memoria que compone" cue — quiet, muted, never gold. Only shows when
          history actually pre-filled the block; a first session shows nothing. */}
      {session.enrichedFromHistory ? (
        <View
          style={styles.memoryCue}
          accessible
          accessibilityLabel="Rellenado con tus números de la última vez"
        >
          <KIcon name="clock" size={12} color={Colors.ink.muted} />
          <Text style={styles.memoryCueText} maxFontSizeMultiplier={1.6}>
            Con tus números de la última vez
          </Text>
        </View>
      ) : null}

      {/* Primary = dark ink pill. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Empezar ahora: ${session.blockName}`}
        accessibilityHint="Abre el workout y empieza a registrar"
        onPress={onStart}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <KIcon name="zap" size={16} color={Colors.ink.inverse} />
        <Text style={styles.ctaText} maxFontSizeMultiplier={1.5}>
          Empezar ahora
        </Text>
      </Pressable>

      {/* Secondary = outline pill + a quiet reset ghost. */}
      <View style={styles.secondaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver bloque"
          accessibilityHint="Abre el detalle del bloque sin empezar"
          onPress={onView}
          style={({ pressed }) => [styles.outlinePill, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.outlineText} maxFontSizeMultiplier={1.5}>
            Ver bloque
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pedir otra cosa"
          accessibilityHint="Descarta este bloque y empieza otra conversación"
          onPress={onAskAgain}
          hitSlop={8}
          style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.ghostText} maxFontSizeMultiplier={1.5}>
            Pedir otra cosa
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default React.memo(BlockReadyCard);

const styles = StyleSheet.create({
  // Borderless, discipline-tinted, no shadow — the fill carries the weight.
  card: {
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    marginTop: Spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  eyebrow: {
    ...Type.eyebrow,
    flexShrink: 1,
  },
  // Duration chip: a small surface pill that lifts off the tint for legibility.
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bg.surface,
  },
  durationText: {
    ...Type.numSmall,
    color: Colors.ink.secondary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  accentBar: {
    width: 4, // decorative discipline bar — sized in px, not a spacing rhythm
    height: 26,
    borderRadius: 2,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    flex: 1,
  },
  exercises: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  // flex-start (not baseline) so a wrapped, Dynamic-Type-scaled name keeps its
  // detail top-aligned instead of drifting off the baseline.
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  exerciseName: {
    ...Type.body,
    color: Colors.ink.secondary,
    flexShrink: 1,
  },
  exerciseDetail: {
    ...Type.caption,
    color: Colors.ink.muted,
    flexShrink: 0,
  },
  memoryCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  memoryCueText: {
    ...Type.caption,
    color: Colors.ink.muted,
    flexShrink: 1,
  },
  cta: {
    marginTop: Spacing.xl,
    minHeight: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  outlinePill: {
    minHeight: 44, // HIG minimum tappable target
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.strong,
  },
  outlineText: {
    ...Type.bodyEmph,
    color: Colors.ink.secondary,
  },
  ghostBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  ghostText: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
});
