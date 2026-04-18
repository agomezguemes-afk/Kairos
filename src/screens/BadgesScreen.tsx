// KAIROS — Badges Screen
// Grid of all badges. Unlocked ones in full color, locked ones greyed out.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGamification } from '../context/GamificationContext';
import { BADGE_DEFINITIONS } from '../types/gamification';
import type { BadgeId } from '../types/gamification';
import KairosIcon from '../components/KairosIcon';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const { badges, streak } = useGamification();
  const unlockedIds = new Set<BadgeId>(badges.map((b) => b.id));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Streak banner */}
      <Animated.View entering={FadeInUp.delay(60).duration(350)} style={styles.streakBanner}>
        <View style={styles.streakIconRow}>
          {streak.current >= 1 ? (
            Array.from({ length: streak.current >= 30 ? 3 : streak.current >= 7 ? 2 : 1 }).map((_, i) => (
              <KairosIcon key={i} name="streak" size={28} color={Colors.accent.primary} />
            ))
          ) : (
            <KairosIcon name="sleep" size={28} color={Colors.text.tertiary} />
          )}
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakCount}>
            {streak.current} {streak.current === 1 ? 'día' : 'días'}
          </Text>
          <Text style={styles.streakLabel}>Racha actual</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakInfo}>
          <Text style={styles.streakCount}>{streak.longest}</Text>
          <Text style={styles.streakLabel}>Récord</Text>
        </View>
      </Animated.View>

      {/* Section title */}
      <Text style={styles.sectionTitle}>Insignias</Text>
      <Text style={styles.sectionSub}>
        {badges.length} de {BADGE_DEFINITIONS.length} desbloqueadas
      </Text>

      {/* Badges grid */}
      <View style={styles.grid}>
        {BADGE_DEFINITIONS.map((def, index) => {
          const unlocked = unlockedIds.has(def.id);
          const badge = badges.find((b) => b.id === def.id);

          return (
            <Animated.View
              key={def.id}
              entering={FadeInUp.delay(120 + index * 60).duration(350)}
              style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}
            >
              <View style={styles.badgeIconWrap}>
                <KairosIcon
                  name={def.icon}
                  size={32}
                  color={unlocked ? Colors.accent.primary : Colors.text.disabled}
                />
              </View>
              <Text style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}>
                {def.name}
              </Text>
              <Text style={[styles.badgeDesc, !unlocked && styles.badgeDescLocked]}>
                {def.description}
              </Text>
              {unlocked && badge && (
                <Text style={styles.badgeDate}>
                  {new Date(badge.unlockedAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              )}
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
  },

  // Streak banner
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.gap.sections,
    ...Shadows.card,
  },
  streakIconRow: {
    flexDirection: 'row',
    gap: 2,
    marginRight: Spacing.lg,
  },
  streakInfo: {
    alignItems: 'center',
    flex: 1,
  },
  streakCount: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.accent.primary,
  },
  streakLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  streakDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border.light,
    marginHorizontal: Spacing.md,
  },

  // Section
  sectionTitle: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sectionSub: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xl,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gap.cards,
  },

  // Badge card
  badgeCard: {
    width: '47%',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.subtle,
  },
  badgeCardLocked: {
    opacity: 0.45,
  },
  badgeIconWrap: {
    marginBottom: Spacing.sm,
  },
  badgeName: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  badgeNameLocked: {
    color: Colors.text.tertiary,
  },
  badgeDesc: {
    fontSize: Typography.size.micro,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: Typography.size.micro * Typography.lineHeight.relaxed,
  },
  badgeDescLocked: {
    color: Colors.text.disabled,
  },
  badgeDate: {
    fontSize: Typography.size.micro,
    color: Colors.accent.primary,
    marginTop: Spacing.sm,
    fontWeight: Typography.weight.medium,
  },
});
