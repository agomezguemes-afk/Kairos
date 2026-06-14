// KAIROS — KaiReflectionCard: the compounding moat, made visible.
//
// Where Kai shows how far you've come (see reflection.ts). Distinct from a
// proposal: this is not a decision, it's a quiet moment to absorb — so it has no
// accept/dismiss buttons, just the reflection and a soft way to put it away. The
// numbers are the hero (editorial Fraunces) because competence-made-visible is
// the point. Voice: KAI_VOICE — specific, earned, no hype.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import { Fonts } from '../../theme/fonts';
import KaiOrb from '../onboarding/premium/KaiOrb';
import type { Reflection } from './reflection';

interface KaiReflectionCardProps {
  reflection: Reflection;
  onDismiss?: () => void;
}

function KaiReflectionCard({ reflection, onDismiss }: KaiReflectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <KaiOrb size={30} />
        <Text style={styles.eyebrow}>HASTA HOY</Text>
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={10}
            onPress={onDismiss}
            style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          >
            <Text style={styles.dismissX}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* The numbers are the hero — competence made visible. */}
      <Text style={styles.headline}>{reflection.headline}</Text>

      <View style={styles.lines}>
        {reflection.lines.map((line, i) => (
          <View key={i} style={styles.lineRow}>
            <View style={styles.dot} />
            <Text style={styles.line}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.warm2,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.gold.light,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  eyebrow: { ...Type.eyebrow, color: Colors.gold.deep, flex: 1 },
  dismiss: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dismissPressed: { opacity: 0.5 },
  dismissX: { fontSize: 14, color: Colors.ink.muted },

  headline: {
    fontFamily: Fonts.serifSemiBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: Colors.ink.primary,
    marginBottom: Spacing.md,
  },

  lines: { gap: Spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.gold.base },
  line: { ...Type.body, fontSize: 15, color: Colors.ink.secondary, flex: 1 },
});

export default React.memo(KaiReflectionCard);
