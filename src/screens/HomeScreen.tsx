// KAIROS — Home Screen v3
// Spec: §5.3 — token v3 migration, streak card, today card, insight card.
// Gold: only on "Comenzar Sesión" CTA (moment). OK button demoted to ghost.
// paddingBottom: 88 accounts for the floating tab bar (spec §4.1).

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import KIcon from '../components/icons/KIcon';
import { useWorkoutStore } from '../store/workoutStore';
import { useGamification } from '../context/GamificationContext';
import { Colors, Type, Spacing, Radius, Shadows } from '../theme/tokens';
import { generateWorkoutPlan } from '../lib/ai/coach';
import type { RootStackParamList } from '../types/navigation';
import { calculateBlockStats } from '../types/core';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getGreeting(name?: string): string {
  const h = new Date().getHours();
  const base =
    h < 6   ? 'Buenas noches' :
    h < 13  ? 'Buenos días'   :
    h < 20  ? 'Buenas tardes' :
              'Buenas noches';
  return name && name.trim() ? `${base}, ${name.trim()}` : base;
}

export default function HomeScreen() {
  const insets   = useSafeAreaInsets();
  const nav      = useNavigation<Nav>();

  const userName    = useWorkoutStore((s) => s.userName);
  const setUserName = useWorkoutStore((s) => s.setUserName);
  const blocks      = useWorkoutStore((s) => s.blocks);
  const insights    = useWorkoutStore((s) => s.activeInsights);
  const clearInsight = useWorkoutStore((s) => s.clearInsight);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const { streak }  = useGamification();

  const [nameDraft,  setNameDraft]  = useState('');
  const [generating, setGenerating] = useState(false);

  const todayBlock = useMemo(() => {
    const fav = blocks.find((b) => b.is_favorite);
    if (fav) return fav;
    const recent = [...blocks].sort(
      (a, b) =>
        new Date(b.last_performed_at ?? b.updated_at).getTime() -
        new Date(a.last_performed_at ?? a.updated_at).getTime(),
    )[0];
    return recent ?? null;
  }, [blocks]);

  const todayStats = useMemo(
    () => (todayBlock ? calculateBlockStats(todayBlock) : null),
    [todayBlock],
  );

  const handleStartSession = useCallback(() => {
    if (!todayBlock) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startWorkout(todayBlock.id);
    nav.navigate('ActiveWorkout', { blockId: todayBlock.id });
  }, [todayBlock, startWorkout, nav]);

  const handleQuickAI = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const plan = await generateWorkoutPlan({
        objetivo: 'rutina rápida full body',
        días: 1,
        duración: 30,
      });
      if (plan) {
        startWorkout(plan.id);
        nav.navigate('ActiveWorkout', { blockId: plan.id });
      }
    } catch {
      // silently ignore — UI keeps user on home
    } finally {
      setGenerating(false);
    }
  }, [generating, startWorkout, nav]);

  const handleChooseRoutine = useCallback(() => {
    nav.navigate('Dashboard', { screen: 'WorkoutTab' });
  }, [nav]);

  const handleSaveName = useCallback(() => {
    if (!nameDraft.trim()) return;
    setUserName(nameDraft);
    setNameDraft('');
  }, [nameDraft, setUserName]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop:    insets.top + Spacing.md,
          // 88 = floating tab bar (56) + 16 bottom margin + 16 breathing room
          paddingBottom: insets.bottom + 88,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting — spec §5.3: Type.title serif */}
      <Text style={styles.greeting}>{getGreeting(userName)}</Text>

      {/* Name collection — only shown once */}
      {!userName && (
        <View style={styles.nameCard}>
          <Text style={styles.nameLabel}>¿Cómo te llamas?</Text>
          <View style={styles.nameRow}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Tu nombre"
              placeholderTextColor={Colors.ink.muted}
              style={styles.nameInput}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              accessibilityLabel="Campo de nombre"
            />
            {/* Spec §4.4: OK button is ghost, not gold */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guardar nombre"
              onPress={handleSaveName}
              style={styles.nameBtn}
            >
              <Text style={styles.nameBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Streak card ────────────────────────────────────────────────────── */}
      <View style={styles.streakCard}>
        <View style={styles.streakIconWrap}>
          <KIcon name="zap" size={26} color={Colors.gold.base} />
        </View>
        <View style={styles.streakInfo}>
          {/* Spec §5.3: Type.numLarge for streak number */}
          <Text style={styles.streakNumber}>{streak.current}</Text>
          <Text style={styles.streakLabel}>
            {streak.current === 1 ? 'día consecutivo' : 'días consecutivos'}
          </Text>
        </View>
        <View style={styles.streakBest}>
          <Text style={styles.streakBestLabel}>MEJOR</Text>
          <Text style={styles.streakBestValue}>{streak.longest}</Text>
        </View>
      </View>

      {/* ── Section header — Hoy ────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.eyebrow}>HOY</Text>
        <View style={styles.eyebrowRule} />
      </View>

      {/* ── Today card ─────────────────────────────────────────────────────── */}
      {todayBlock ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comenzar ${todayBlock.name}`}
          onPress={handleStartSession}
          style={({ pressed }) => [styles.todayCard, pressed && styles.todayCardPressed]}
        >
          <View style={styles.todayHead}>
            {/* Spec §5.3: Type.titleSmall serif for card title */}
            <Text style={styles.todayName} numberOfLines={1}>
              {todayBlock.name}
            </Text>
            <View style={[styles.disciplineDot, { backgroundColor: todayBlock.color }]} />
          </View>

          {/* Meta row — spec §5.3: Type.eyebrow for labels, Type.numSmall for values */}
          <View style={styles.todayMeta}>
            <View style={styles.todayMetaItem}>
              <KIcon name="clock" size={13} color={Colors.ink.muted} />
              <Text style={styles.todayMetaValue}>
                {todayStats?.estimated_duration ?? 0}
                <Text style={styles.todayMetaUnit}> min</Text>
              </Text>
            </View>
            <View style={styles.todayMetaItem}>
              <KIcon name="barbell" size={13} color={Colors.ink.muted} />
              <Text style={styles.todayMetaValue}>
                {todayStats?.total_exercises ?? 0}
                <Text style={styles.todayMetaUnit}> ejercicios</Text>
              </Text>
            </View>
          </View>

          {/* CTA — gold (moment action, spec §4.4) */}
          <View style={styles.startCta}>
            <KIcon name="zap" size={18} color={Colors.ink.primary} />
            <Text style={styles.startCtaText}>Comenzar Sesión</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.emptyToday}>
          <Text style={styles.emptyTodayText}>¿Qué quieres entrenar hoy?</Text>
          <View style={styles.emptyTodayActions}>
            {/* Secondary — spec §4.4 border style */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Elegir rutina"
              onPress={handleChooseRoutine}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Elegir Rutina</Text>
            </Pressable>
            {/* Primary — ink.primary (not gold; no "moment" here) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={generating ? 'Generando rutina' : 'Generar rutina rápida con IA'}
              onPress={handleQuickAI}
              disabled={generating}
              style={[styles.primaryBtn, generating && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnText}>
                {generating ? 'Generando…' : 'Rutina Rápida'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Insight of the day ──────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.eyebrow}>KAIROS COACH</Text>
            <View style={styles.eyebrowRule} />
          </View>
          <View style={styles.insightCard}>
            <View style={styles.insightHead}>
              <KIcon name="zap" size={14} color={Colors.gold.base} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar insight"
                onPress={() => clearInsight(insights.length - 1)}
                hitSlop={8}
                style={styles.insightClose}
              >
                <KIcon name="x" size={14} color={Colors.ink.muted} />
              </Pressable>
            </View>
            <Text style={styles.insightText}>{insights[insights.length - 1]}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.void,
  },
  content: {
    paddingHorizontal: Spacing.screen.horizontal,
    gap: Spacing.lg,
  },
  greeting: {
    ...Type.title,
    color: Colors.ink.primary,
  },

  // ── Name card ──
  nameCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.surface,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  nameLabel: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  nameInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.void,
    color: Colors.ink.primary,
    fontSize: 15,
  },
  // Ghost style for OK (spec §4.4: demoted from gold)
  nameBtn: {
    width: 56,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hair.base,
  },
  nameBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink.secondary,
  },

  // ── Streak card ──
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.surface,
    ...Shadows.subtle,
  },
  streakIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold.glow,
  },
  streakInfo: {
    flex: 1,
  },
  // Type.numLarge for streak number (spec §5.3)
  streakNumber: {
    ...Type.numLarge,
    color: Colors.ink.primary,
  },
  streakLabel: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  streakBest: {
    alignItems: 'flex-end',
  },
  streakBestLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    fontSize: 9,
  },
  streakBestValue: {
    ...Type.numMedium,
    color: Colors.ink.secondary,
  },

  // ── Section header (eyebrow + gold rule) — spec §7 point 6 ──
  sectionHeader: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  eyebrowRule: {
    height: 1,
    width: 28,
    backgroundColor: Colors.gold.base,
  },

  // ── Today card ──
  todayCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.surface,
    gap: Spacing.md,
    ...Shadows.card,
  },
  todayCardPressed: {
    // Subtle pressed state; full PressableCard animation is Phase 3
    opacity: 0.94,
  },
  todayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Type.titleSmall serif for card title (spec §5.3)
  todayName: {
    flex: 1,
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
  disciplineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  todayMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    flexWrap: 'wrap',
  },
  todayMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  todayMetaValue: {
    ...Type.numSmall,
    color: Colors.ink.secondary,
  },
  todayMetaUnit: {
    ...Type.caption,
    fontWeight: '400',
    color: Colors.ink.muted,
  },
  // Gold CTA (moment action — spec §4.4)
  startCta: {
    height: 52,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.gold.base,
  },
  startCtaText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.ink.primary,
  },

  // ── Empty today ──
  emptyToday: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.surface,
    gap: Spacing.md,
    alignItems: 'center',
  },
  emptyTodayText: {
    ...Type.subheading,
    color: Colors.ink.primary,
    textAlign: 'center',
  },
  emptyTodayActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.gold.base,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold.deep,
  },
  primaryBtn: {
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.ink.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink.inverse,
  },

  // ── Insight card ──
  insightCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.gold.glow,
    backgroundColor: Colors.bg.warm,
    gap: Spacing.sm,
  },
  insightHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insightClose: {
    marginLeft: 'auto',
  },
  insightText: {
    ...Type.body,
    color: Colors.ink.primary,
  },
});
