// KAIROS — AI Lab Screen
// Main AI tab: active mission widget, quick stats, and access to chat.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import AIAvatar from '../components/AIAvatar';
import type { AvatarMood } from '../components/AIAvatar';
import KairosIcon from '../components/KairosIcon';
import { useMission } from '../context/MissionContext';
import { useGamification } from '../context/GamificationContext';
import { useTree } from '../context/TreeContext';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

export default function AILabScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { activeMission, skipsRemaining, skipMission, completedMissions } = useMission();
  const { streak, badges, prCards } = useGamification();
  const { progress } = useTree();
  const [avatarMood, setAvatarMood] = useState<AvatarMood>('idle');

  const isMissionDone = activeMission?.status === 'completed';

  const handleSkip = async () => {
    if (skipsRemaining <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAvatarMood('thinking');
    await skipMission();
    setTimeout(() => setAvatarMood('idle'), 600);
  };

  const handleOpenChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('AIChat');
  };

  // Mission progress percentage
  const missionPct = activeMission
    ? Math.min(100, Math.round((activeMission.currentValue / activeMission.targetValue) * 100))
    : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp.delay(60).duration(350)} style={styles.header}>
        <View style={styles.headerLeft}>
          <AIAvatar size={40} mood={avatarMood} />
          <View style={styles.headerText}>
            <Text style={styles.title}>AI Lab</Text>
            <Text style={styles.subtitle}>Tu asistente Kai</Text>
          </View>
        </View>
      </Animated.View>

      {/* Chat CTA */}
      <Animated.View entering={FadeInUp.delay(100).duration(350)}>
        <Pressable
          onPress={handleOpenChat}
          style={({ pressed }) => [styles.chatCta, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Feather name="message-circle" size={20} color={Colors.accent.primary} />
          <View style={styles.chatCtaText}>
            <Text style={styles.chatCtaTitle}>Habla con Kai</Text>
            <Text style={styles.chatCtaSub}>Pregúntale sobre tu entrenamiento</Text>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.text.tertiary} />
        </Pressable>
      </Animated.View>

      {/* Mission Card */}
      <Animated.View entering={FadeInUp.delay(180).duration(350)}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Misión semanal</Text>
          {completedMissions.length > 0 && (
            <Text style={styles.sectionCount}>
              {completedMissions.length} completada{completedMissions.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {activeMission ? (
          <View style={[styles.missionCard, isMissionDone && styles.missionCardDone]}>
            <View style={styles.missionHeader}>
              <KairosIcon name={activeMission.icon} size={28} color={Colors.accent.primary} />
              <View style={styles.missionHeaderText}>
                <Text style={[styles.missionTitle, isMissionDone && styles.missionTitleDone]}>
                  {activeMission.title}
                </Text>
                {isMissionDone && (
                  <View style={styles.missionDoneBadgeRow}>
                    <KairosIcon name="checkmark" size={14} color={Colors.semantic.success} />
                    <Text style={styles.missionDoneBadge}> Completada</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.missionDesc}>{activeMission.description}</Text>

            {/* Progress bar */}
            <View style={styles.missionProgressContainer}>
              <View style={styles.missionProgressTrack}>
                <Animated.View
                  style={[
                    styles.missionProgressFill,
                    { width: `${missionPct}%` as `${number}%` },
                    isMissionDone && styles.missionProgressFillDone,
                  ]}
                />
              </View>
              <Text style={styles.missionProgressText}>
                {activeMission.currentValue}/{activeMission.targetValue} ({missionPct}%)
              </Text>
            </View>

            {/* Skip button */}
            {!isMissionDone && (
              <View style={styles.missionActions}>
                <Pressable
                  onPress={handleSkip}
                  disabled={skipsRemaining <= 0}
                  style={({ pressed }) => [
                    styles.skipBtn,
                    pressed && { opacity: 0.7 },
                    skipsRemaining <= 0 && styles.skipBtnDisabled,
                  ]}
                >
                  <Feather name="refresh-cw" size={14} color={skipsRemaining > 0 ? Colors.text.secondary : Colors.text.disabled} />
                  <Text
                    style={[
                      styles.skipBtnText,
                      skipsRemaining <= 0 && styles.skipBtnTextDisabled,
                    ]}
                  >
                    Cambiar ({skipsRemaining} restantes)
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.missionCard}>
            <Text style={styles.missionDesc}>
              Cargando misión...
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Quick Stats */}
      <Animated.View entering={FadeInUp.delay(280).duration(350)}>
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Resumen</Text>
        <View style={styles.statsRow}>
          <StatBubble icon="streak" value={String(streak.current)} label="Racha" />
          <StatBubble icon="badge" value={String(badges.length)} label="Insignias" />
          <StatBubble icon="bolt" value={String(prCards.length)} label="Récords" />
          <StatBubble
            icon={progress ? 'tree' : 'seedling'}
            value={progress ? `Nv.${progress.level}` : '—'}
            label="Árbol"
          />
        </View>
      </Animated.View>

      {/* Completed missions list */}
      {completedMissions.length > 0 && (
        <Animated.View entering={FadeInUp.delay(350).duration(350)}>
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
            Misiones completadas
          </Text>
          {completedMissions.slice(0, 5).map((m) => (
            <View key={m.id} style={styles.completedItem}>
              <KairosIcon name={m.icon} size={20} color={Colors.accent.primary} />
              <View style={styles.completedText}>
                <Text style={styles.completedTitle} numberOfLines={1}>
                  {m.title}
                </Text>
                <Text style={styles.completedDate}>
                  {new Date(m.completedAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <KairosIcon name="checkmark" size={18} color={Colors.semantic.success} />
            </View>
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ======================== STAT BUBBLE ========================

function StatBubble({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.statBubble}>
      <KairosIcon name={icon} size={22} color={Colors.accent.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: {},
  title: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 1,
  },

  // Chat CTA
  chatCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    ...Shadows.subtle,
  },
  chatCtaText: {
    flex: 1,
  },
  chatCtaTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  chatCtaSub: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  sectionCount: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
  },

  // Mission card
  missionCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadows.card,
  },
  missionCardDone: {
    borderWidth: 2,
    borderColor: Colors.semantic.success,
    backgroundColor: Colors.semantic.successMuted,
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  missionEmoji: {
    fontSize: 32,
  },
  missionHeaderText: {
    flex: 1,
  },
  missionTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  missionTitleDone: {
    color: Colors.semantic.success,
  },
  missionDoneBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  missionDoneBadge: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.semantic.success,
  },
  missionDesc: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    lineHeight: Typography.size.body * Typography.lineHeight.relaxed,
    marginBottom: Spacing.lg,
  },

  // Progress
  missionProgressContainer: {
    marginBottom: Spacing.md,
  },
  missionProgressTrack: {
    height: 8,
    backgroundColor: Colors.background.elevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  missionProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent.primary,
    borderRadius: 4,
  },
  missionProgressFillDone: {
    backgroundColor: Colors.semantic.success,
  },
  missionProgressText: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    textAlign: 'right',
  },

  // Actions
  missionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background.elevated,
  },
  skipBtnDisabled: {
    opacity: 0.5,
  },
  skipBtnText: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
  },
  skipBtnTextDisabled: {
    color: Colors.text.disabled,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  statBubble: {
    flex: 1,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Shadows.subtle,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.accent.primary,
  },
  statLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  // Completed missions
  completedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  completedEmoji: {
    fontSize: 20,
  },
  completedText: {
    flex: 1,
  },
  completedTitle: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },
  completedDate: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  completedCheck: {
    fontSize: 16,
  },
});
