// GiantTarget — the scoreboard's dominant value: peso × reps (or distancia ·
// ritmo) in numerals legible across a gym at 2 m. Tabular sans (not the
// editorial serif) because glance-legibility beats flourish here — same call
// RestTimer makes for its countdown. In set-active it's tappable → opens the
// correction sheet (confirm-or-correct). In exercise-change it's a static
// preview of what's coming.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Spacing, Type } from '../../theme/tokens';
import type { FormattedTarget } from '../../features/workout/scoreboard/format';

interface Props {
  target: FormattedTarget | null;
  /** Present → the value is tappable (correction). Absent → static preview. */
  onPress?: () => void;
  /** Spoken form for VoiceOver (the visual numerals aren't self-describing). */
  spokenLabel: string;
}

function GiantTargetImpl({ target, onPress, spokenLabel }: Props) {
  const body =
    target == null ? (
      <Text style={styles.bodyweight} maxFontSizeMultiplier={1.4}>
        Sin objetivo
      </Text>
    ) : (
      <View style={styles.row}>
        {target.segments.map((seg, i) => (
          <React.Fragment key={`${seg.value}-${i}`}>
            {i > 0 ? (
              <Text style={styles.separator} maxFontSizeMultiplier={1.3}>
                {target.separator}
              </Text>
            ) : null}
            <View style={styles.segment}>
              <Text
                style={styles.value}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                maxFontSizeMultiplier={1.3}
              >
                {seg.value}
              </Text>
              {seg.unit ? (
                <Text style={styles.unit} maxFontSizeMultiplier={1.3}>
                  {seg.unit}
                </Text>
              ) : null}
            </View>
          </React.Fragment>
        ))}
      </View>
    );

  if (!onPress) {
    return (
      <View style={styles.wrap} accessible accessibilityLabel={spokenLabel}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Objetivo ${spokenLabel}`}
      accessibilityHint="Toca para ajustar peso, reps o metadatos"
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
    >
      {body}
      <Text style={styles.adjustHint} maxFontSizeMultiplier={1.4}>
        Toca para ajustar
      </Text>
    </Pressable>
  );
}

const GiantTarget = React.memo(GiantTargetImpl);
export default GiantTarget;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  wrapPressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 1,
  },
  // Bespoke hero numeral — sans + tabular for 2 m legibility (RestTimer sets the
  // precedent of a local numeral size that overrides the token family/size).
  value: {
    fontFamily: FontFamily.sans,
    fontSize: 76,
    lineHeight: 80,
    fontWeight: '700',
    letterSpacing: -2,
    color: Colors.ink.primary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    ...Type.numMedium,
    fontSize: 20,
    color: Colors.ink.tertiary,
  },
  separator: {
    fontFamily: FontFamily.sans,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '400',
    color: Colors.ink.muted,
  },
  bodyweight: {
    ...Type.title,
    color: Colors.ink.secondary,
  },
  adjustHint: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
});
