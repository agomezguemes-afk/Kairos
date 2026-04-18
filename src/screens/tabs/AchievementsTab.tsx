// KAIROS — Achievements Tab
// Hub for gamification: streak, badges, and PR cards.
// Uses a nested native stack for BadgesScreen and PRCardsScreen.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useGamification } from '../../context/GamificationContext';
import { useTree } from '../../context/TreeContext';
import { BADGE_DEFINITIONS } from '../../types/gamification';
import type { BadgeId } from '../../types/gamification';
import { TREE_CONFIGS } from '../../types/tree';
import KairosIcon from '../../components/KairosIcon';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme/index';

export default function AchievementsTab({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { streak, badges, prCards } = useGamification();
  const { treeType, progress } = useTree();
  const unlockedIds = new Set<BadgeId>(badges.map((b) => b.id));

  const treeConfig = treeType ? TREE_CONFIGS[treeType] : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Logros</Text>

      {/* Streak card */}
      <Animated.View entering={FadeInUp.delay(60).duration(350)} style={styles.streakCard}>
        <View style={styles.streakIconRow}>
          {streak.current >= 1 ? (
            Array.from({ length: streak.current >= 30 ? 3 : streak.current >= 7 ? 2 : 1 }).map((_, i) => (
              <KairosIcon key={i} name="streak" size={24} color={Colors.accent.primary} />
            ))
          ) : (
            <KairosIcon name="sleep" size={24} color={Colors.text.tertiary} />
          )}
        </View>
        <View>
          <Text style={styles.streakValue}>
            {streak.current} {streak.current === 1 ? 'día' : 'días'} de racha
          </Text>
          <Text style={styles.streakSub}>Récord: {streak.longest} días</Text>
        </View>
      </Animated.View>

      {/* Progress tree */}
      <Animated.View entering={FadeInUp.delay(90).duration(350)}>
        <Pressable
          onPress={() => navigation.navigate('ProgressTree')}
          style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.sectionHeader}>
            <KairosIcon name={treeConfig ? 'tree' : 'seedling'} size={20} color={Colors.accent.primary} />
            <Text style={styles.sectionTitle}>
              {treeConfig ? `${treeConfig.name}` : 'Tu Árbol'}
            </Text>
            {progress && (
              <Text style={styles.sectionCount}>Nivel {progress.level}/5</Text>
            )}
            <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
          </View>
          <Text style={styles.prPreview}>
            {treeConfig
              ? `${treeConfig.symbol} · Crece con ${treeConfig.metricLabel.toLowerCase()}`
              : 'Elige un árbol para empezar'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Badges preview */}
      <Animated.View entering={FadeInUp.delay(150).duration(350)}>
        <Pressable
          onPress={() => navigation.navigate('Badges')}
          style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="award" size={20} color={Colors.accent.primary} />
            <Text style={styles.sectionTitle}>Insignias</Text>
            <Text style={styles.sectionCount}>
              {badges.length}/{BADGE_DEFINITIONS.length}
            </Text>
            <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
          </View>
          {/* Mini badge preview row */}
          <View style={styles.badgePreview}>
            {BADGE_DEFINITIONS.slice(0, 6).map((def) => (
              <KairosIcon
                key={def.id}
                name={def.icon}
                size={22}
                color={unlockedIds.has(def.id) ? Colors.accent.primary : Colors.text.disabled}
                style={styles.badgeMini}
              />
            ))}
          </View>
        </Pressable>
      </Animated.View>

      {/* PR Cards */}
      <Animated.View entering={FadeInUp.delay(210).duration(350)}>
        <Pressable
          onPress={() => navigation.navigate('PRCards')}
          style={({ pressed }) => [styles.sectionCard, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="zap" size={20} color={Colors.accent.primary} />
            <Text style={styles.sectionTitle}>Récords Personales</Text>
            <Text style={styles.sectionCount}>{prCards.length}</Text>
            <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
          </View>
          {prCards.length > 0 ? (
            <Text style={styles.prPreview}>
              Último: {prCards[0].exerciseName} — {prCards[0].value}
              {prCards[0].unit ? ` ${prCards[0].unit}` : ''}
            </Text>
          ) : (
            <Text style={styles.prPreview}>Completa series para desbloquear récords</Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
    paddingHorizontal: Spacing.screen.horizontal,
  },
  title: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
  },

  // Streak
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  streakIconRow: {
    flexDirection: 'row',
    gap: 2,
    marginRight: Spacing.md,
  },
  streakValue: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  streakSub: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  // Section cards
  sectionCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.subtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  sectionCount: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
    marginRight: Spacing.xs,
  },

  // Badge preview
  badgePreview: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  badgeMini: {
    fontSize: 24,
  },
  badgeMiniLocked: {
    opacity: 0.25,
  },

  // PR preview
  prPreview: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
});
