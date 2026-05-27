// src/features/onboarding/tour/BlockPreviewMock.tsx
// Illustrative card for tour page 1 ("Bloques"). Mimics the real DayCard +
// BlockPreview composition without pulling live store data — keeps the tour
// independent of user state. Tokens only.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Shadows, Spacing, Type } from '../../../theme/tokens';
import KIcon from '../../../components/icons/KIcon';

const EXERCISES = ['Press banca', 'Sentadilla', 'Peso muerto'];

export default function BlockPreviewMock() {
  return (
    <View style={styles.outer}>
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.card}>
        <View style={[styles.stripe, { backgroundColor: Colors.discipline.strength }]} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>Empuje superior</Text>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>45 min</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>9 sets</Text>
            </View>
          </View>
          <View style={styles.list}>
            {EXERCISES.map((name) => (
              <View key={name} style={styles.row}>
                <KIcon name="barbell" size={14} color={Colors.ink.muted} />
                <Text style={styles.rowText} numberOfLines={1}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft warm aura behind the card — gives the "premium" feel without
  // committing to a real shadow vibe; tokenized warm bg + scale of 1.04.
  glow: {
    position: 'absolute',
    width: 320,
    height: 240,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.bg.warm,
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  card: {
    width: 280,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    ...Shadows.card,
  },
  stripe: {
    width: 3,
  },
  body: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    fontSize: 17,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
  },
  pillText: {
    ...Type.micro,
    color: Colors.ink.secondary,
  },
  list: {
    marginTop: Spacing.md,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowText: {
    ...Type.body,
    color: Colors.ink.tertiary,
  },
});
