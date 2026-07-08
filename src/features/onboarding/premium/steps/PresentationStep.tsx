// KAIROS — PresentationStep: the payoff. Shows the block Kai built + enters.
//
// The flow culminates with the first block already created and *shown*: the user
// sees a real, populated block (name + exercises) before they ever tap in, plus
// a one-line "how Kairos works". This is the moment the promise pays off.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Shadows, Spacing, Type } from '../../../../theme/tokens';
import type { OnboardingGoal } from '../../flow/onboardingFlow';
import { previewStarterBlock } from '../../flow/starterPreview';
import { text } from '../textStyles';
import GoldButton from '../GoldButton';

interface PresentationStepProps {
  name: string | null;
  goal: OnboardingGoal | null;
  onEnter: () => void;
  /** True while the host finishes generating the space after «Entrar». */
  entering?: boolean;
}

export default function PresentationStep({
  name,
  goal,
  onEnter,
  entering = false,
}: PresentationStepProps) {
  const block = previewStarterBlock(goal);
  const accent = Colors.discipline[block.discipline];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={text.eyebrowCenter}>TODO LISTO</Text>
        <Text style={styles.title}>
          {name ? `${name}, Kai ya creó` : 'Kai ya creó'}
          {'\n'}tu <Text style={text.titleAccent}>primer bloque</Text>
        </Text>
      </View>

      {/* The real first block, shown before entering. */}
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.cardTag, { backgroundColor: accent }]} />
          <Text style={styles.cardName}>{block.name}</Text>
        </View>
        <View style={styles.exList}>
          {block.exercises.map((ex, i) => (
            <View
              key={ex.name}
              style={[styles.exRow, i === block.exercises.length - 1 && styles.exRowLast]}
            >
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.exDetail}>{ex.detail}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.note}>
        <View style={styles.noteDot} />
        <Text style={styles.noteText}>
          Kai vive en tu espacio: ajusta el plan y te aconseja a medida que entrenas.
        </Text>
      </View>

      <View style={styles.spacer} />
      <View style={styles.fullWidth}>
        <GoldButton
          label="Entrar a Kairos"
          onPress={onEnter}
          loading={entering}
          loadingLabel="Kai está terminando…"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.sm },
  fullWidth: { width: '100%' },
  spacer: { flex: 1, minHeight: Spacing.lg },

  header: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  title: { ...Type.title, color: Colors.ink.primary, textAlign: 'center' },

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
  cardName: { ...Type.subheading, color: Colors.ink.primary },
  exList: {},
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hair.subtle,
  },
  exRowLast: { borderBottomWidth: 0 },
  exName: { ...Type.body, color: Colors.ink.secondary },
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
