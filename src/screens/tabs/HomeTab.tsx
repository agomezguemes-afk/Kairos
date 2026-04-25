// KAIROS — Home Tab
// The "daily command centre" — a calm, focused morning brief
// that answers: where are you, and what's next?

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import KairosIcon from '../../components/KairosIcon';
import { useWorkoutStore } from '../../store/workoutStore';
import { useGamification } from '../../context/GamificationContext';
import { useMission } from '../../context/MissionContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { getInitialGreeting } from '../../services/aiChatService';
import type { AIChatContext } from '../../services/aiChatService';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme/index';
import type { WorkoutBlock, Discipline } from '../../types/core';
import { getBlockExercises } from '../../types/core';

// ======================== CONSTANTS ========================

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  strength: 'Fuerza',
  running: 'Running',
  calisthenics: 'Calistenia',
  mobility: 'Movilidad',
  team_sport: 'Equipo',
  cycling: 'Ciclismo',
  swimming: 'Natación',
  general: 'General',
};

// ======================== SCREEN ========================

export default function HomeTab({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const blocks = useWorkoutStore((s) => s.blocks);
  const { streak, badges, prCards } = useGamification();
  const { activeMission } = useMission();
  const { profile } = useUserProfile();

  // ---- Greeting line ----
  const greetingWord = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Buenos días,';
    if (hour >= 12 && hour < 18) return 'Buenas tardes,';
    return 'Buenas noches,';
  }, []);

  const displayName = profile.displayName?.trim() || 'Atleta';

  // ---- Kai brief (computed once per mount from live store state) ----
  const kaiBrief = useMemo(() => {
    const ctx: AIChatContext = {
      blocks,
      streak,
      badges,
      prCards,
      activeMission,
    };
    return getInitialGreeting(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Suggested block (most recently updated) ----
  const suggestedBlock = useMemo<WorkoutBlock | null>(() => {
    if (blocks.length === 0) return null;
    return [...blocks].sort((a, b) => {
      const ta = new Date(a.updated_at).getTime();
      const tb = new Date(b.updated_at).getTime();
      return tb - ta;
    })[0];
  }, [blocks]);

  // ---- Mission progress ----
  const missionPct = useMemo(() => {
    if (!activeMission) return 0;
    if (activeMission.targetValue <= 0) return 0;
    return Math.min(
      100,
      Math.round((activeMission.currentValue / activeMission.targetValue) * 100),
    );
  }, [activeMission]);

  // ---- Stats ----
  const streakCount = streak.current;
  const prCount = prCards.length;
  const badgeCount = badges.length;

  // ======================== NAVIGATION HANDLERS ========================

  const goToLogros = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('AchievementsTab');
  };

  const goToAILab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('AILabTab');
  };

  const goToBloques = (blockId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (blockId) {
      navigation.navigate('WorkoutTab', { highlightBlockId: blockId });
    } else {
      navigation.navigate('WorkoutTab');
    }
  };

  // ======================== MOUNT ANIMATIONS ========================

  const sectionCount = 5;
  const opacities = useRef(
    Array.from({ length: sectionCount }, () => new Animated.Value(0)),
  ).current;
  const translations = useRef(
    Array.from({ length: sectionCount }, () => new Animated.Value(10)),
  ).current;

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const delays = [0, 70, 140, 210, 280];
      opacities.forEach((op, i) => {
        Animated.parallel([
          Animated.timing(op, {
            toValue: 1,
            duration: 320,
            delay: delays[i],
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translations[i], {
            toValue: 0,
            duration: 320,
            delay: delays[i],
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
    return () => task.cancel();
  }, [opacities, translations]);

  const sectionStyle = (i: number) => ({
    opacity: opacities[i],
    transform: [{ translateY: translations[i] }],
  });

  // ======================== BREATHING DOT ========================

  const dotScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          toValue: 1.3,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotScale]);

  // ======================== MISSION PROGRESS BAR ========================

  const missionProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(missionProgress, {
      toValue: missionPct,
      duration: 700,
      delay: 210 + 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [missionPct, missionProgress]);

  const missionFillWidth = missionProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // ======================== RENDER ========================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── SECTION 1: HEADER ─────────────────────────────────── */}
      <Animated.View style={[styles.sectionWrap, sectionStyle(0)]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>{greetingWord}</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>

          <Pressable
            onPress={goToLogros}
            style={({ pressed }) => [
              styles.streakPill,
              pressed && { opacity: 0.75 },
            ]}
          >
            <KairosIcon name="streak" size={14} color={Colors.accent.primary} />
            <Text style={styles.streakPillText}>
              {' '}
              {streakCount} días
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ─── SECTION 2: KAI BRIEF ──────────────────────────────── */}
      <Animated.View style={[styles.sectionWrap, sectionStyle(1)]}>
        <View style={styles.card}>
          <View style={styles.kaiTopRow}>
            <Text style={styles.kaiLabel}>KAI</Text>
            <Animated.View
              style={[styles.kaiDot, { transform: [{ scale: dotScale }] }]}
            />
          </View>
          <Text style={styles.kaiBody}>{kaiBrief}</Text>
          <Pressable
            onPress={goToAILab}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Text style={styles.kaiCta}>Hablar con Kai →</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ─── SECTION 3: SUGGESTED BLOCK ────────────────────────── */}
      <Animated.View style={[styles.sectionWrap, sectionStyle(2)]}>
        <Text style={styles.sectionLabel}>Sugerido para hoy</Text>
        {suggestedBlock ? (
          <View style={styles.card}>
            <Text style={styles.blockTitle} numberOfLines={1}>
              {suggestedBlock.name}
            </Text>
            <Text style={styles.blockMeta}>
              {getBlockExercises(suggestedBlock).length}
              {getBlockExercises(suggestedBlock).length === 1 ? ' ejercicio' : ' ejercicios'}
              {' · '}
              {DISCIPLINE_LABEL[suggestedBlock.discipline] ?? suggestedBlock.discipline}
            </Text>
            <View style={styles.tagRow}>
              <View style={styles.tagPill}>
                <Text style={styles.tagPillText}>
                  {DISCIPLINE_LABEL[suggestedBlock.discipline] ?? suggestedBlock.discipline}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => goToBloques(suggestedBlock.id)}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Empezar entrenamiento</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>Sin bloques todavía</Text>
            <Text style={styles.emptyHint}>Pídele a Kai que cree uno</Text>
            <Pressable
              onPress={goToAILab}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <Text style={styles.emptyCta}>Abrir AI Lab →</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* ─── SECTION 4: MISSION ────────────────────────────────── */}
      {activeMission && (
        <Animated.View style={[styles.sectionWrap, sectionStyle(3)]}>
          <Text style={styles.sectionLabel}>Misión activa</Text>
          <View style={styles.card}>
            <View style={styles.missionHeaderRow}>
              <KairosIcon
                name={activeMission.icon}
                size={20}
                color={Colors.accent.primary}
              />
              <Text style={styles.missionTitle} numberOfLines={1}>
                {activeMission.title}
              </Text>
            </View>
            <Text style={styles.missionDesc} numberOfLines={2}>
              {activeMission.description}
            </Text>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, { width: missionFillWidth }]}
              />
            </View>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>
                {activeMission.currentValue}/{activeMission.targetValue}
              </Text>
              <Text style={styles.progressLabel}>{missionPct}%</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ─── SECTION 5: STATS ROW ──────────────────────────────── */}
      <Animated.View
        style={[
          styles.sectionWrap,
          sectionStyle(4),
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        <Text style={styles.sectionLabel}>Resumen</Text>
        <View style={styles.statsRow}>
          <StatCard value={streakCount} label="Racha" onPress={goToLogros} />
          <StatCard value={prCount} label="Récords" onPress={goToLogros} />
          <StatCard value={badgeCount} label="Logros" onPress={goToLogros} />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ======================== STAT CARD ========================

function StatCard({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

// ======================== STYLES ========================

const CARD: object = {
  backgroundColor: Colors.background.surface,
  borderRadius: Radius.lg,
  padding: Spacing.xl,
  ...Shadows.card,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
  },
  sectionWrap: {
    marginBottom: Spacing.xl,
  },

  // ---- Header ----
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.regular,
    color: Colors.text.tertiary,
  },
  name: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginTop: 2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.muted,
    borderWidth: 1,
    borderColor: Colors.accent.muted,
  },
  streakPillText: {
    fontSize: 12,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
  },

  // ---- Card base ----
  card: CARD,

  // ---- Kai brief ----
  kaiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  kaiLabel: {
    fontSize: 9,
    fontWeight: Typography.weight.bold,
    color: Colors.accent.primary,
    letterSpacing: 1.5,
  },
  kaiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.primary,
  },
  kaiBody: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  kaiCta: {
    fontSize: 12,
    fontWeight: Typography.weight.medium,
    color: Colors.accent.primary,
  },

  // ---- Section label ----
  sectionLabel: {
    fontSize: 11,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // ---- Suggested block ----
  blockTitle: {
    fontSize: 15,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  blockMeta: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  tagPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.muted,
    borderWidth: 1,
    borderColor: Colors.accent.muted,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
  },
  primaryBtn: {
    marginTop: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md - 2,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.onAccent,
  },

  // ---- Empty state ----
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border.medium,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
  },
  emptyHint: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  emptyCta: {
    fontSize: 12,
    fontWeight: Typography.weight.medium,
    color: Colors.accent.primary,
  },

  // ---- Mission ----
  missionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  missionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  missionDesc: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 4,
    lineHeight: 18,
  },
  progressTrack: {
    height: 5,
    backgroundColor: Colors.border.subtle,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: Colors.accent.primary,
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.text.tertiary,
  },

  // ---- Stats row ----
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.card,
  },
  statValue: {
    fontSize: 24,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
});
