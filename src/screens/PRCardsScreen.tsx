// KAIROS — PR Cards Screen
// Album-style list of personal record cards.

import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGamification } from '../context/GamificationContext';
import type { PRCard } from '../types/gamification';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

export default function PRCardsScreen() {
  const insets = useSafeAreaInsets();
  const { prCards } = useGamification();

  const renderItem = ({ item, index }: { item: PRCard; index: number }) => (
    <PRCardItem card={item} index={index} />
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Récords Personales</Text>
        <Text style={styles.subtitle}>
          {prCards.length} {prCards.length === 1 ? 'récord' : 'récords'}
        </Text>
      </View>

      {prCards.length > 0 ? (
        <FlatList
          data={prCards}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏅</Text>
          <Text style={styles.emptyTitle}>Sin récords todavía</Text>
          <Text style={styles.emptyDesc}>
            Completa series para registrar tus mejores marcas.
          </Text>
        </View>
      )}
    </View>
  );
}

function PRCardItem({ card, index }: { card: PRCard; index: number }) {
  const unit = card.unit ? ` ${card.unit}` : '';
  const dateStr = new Date(card.date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Animated.View
      entering={FadeInUp.delay(60 + index * 50).duration(350)}
      style={styles.card}
    >
      {/* Gold accent strip */}
      <View style={styles.cardStrip} />

      <View style={styles.cardBody}>
        {/* Top row: icon + exercise name */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>{card.exerciseIcon}</Text>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardExercise} numberOfLines={1}>
              {card.exerciseName}
            </Text>
            <Text style={styles.cardDate}>{dateStr}</Text>
          </View>
        </View>

        {/* Record value */}
        <View style={styles.cardValueRow}>
          <Text style={styles.cardValue}>
            {card.value}{unit}
          </Text>
          {card.secondaryText && (
            <Text style={styles.cardSecondary}>{card.secondaryText}</Text>
          )}
        </View>

        {/* Celebration message */}
        <Text style={styles.cardMessage}>{card.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  header: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: Spacing.screen.horizontal,
    gap: Spacing.md,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screen.horizontal * 2,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // PR Card
  card: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardStrip: {
    height: 3,
    backgroundColor: Colors.accent.primary,
  },
  cardBody: {
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardExercise: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  cardDate: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  cardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardValue: {
    fontSize: Typography.size.hero,
    fontWeight: Typography.weight.bold,
    color: Colors.accent.primary,
  },
  cardSecondary: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
  },
  cardMessage: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
    color: Colors.semantic.success,
  },
});
