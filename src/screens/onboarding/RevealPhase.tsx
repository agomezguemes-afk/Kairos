// KAIROS — Reveal del espacio generado (U3): el momento aha del onboarding.
// Único uso legítimo de los 480ms (layout shift reservado) y de
// Shadows.cardWarm. Oro sólido SOLO en el CTA primario. Haptic Success una
// vez al aparecer. El usuario ve bloque + ejercicios + semana ANTES del
// Dashboard.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { Colors, Type, Spacing, Radius, Shadows, Animation } from '../../theme/tokens';
import { springs } from '../../theme/animations';
import { getBlockExercises, type WorkoutBlock } from '../../types/core';
import type { OnboardingSpaceResult } from './onboardingFlow';

const MAX_VISIBLE_EXERCISES = 4;

// Semana lunes-first para display; weekday del contrato: 0=domingo…6=sábado.
const WEEK_DISPLAY: { weekday: number; short: string; long: string }[] = [
  { weekday: 1, short: 'L', long: 'lunes' },
  { weekday: 2, short: 'M', long: 'martes' },
  { weekday: 3, short: 'X', long: 'miércoles' },
  { weekday: 4, short: 'J', long: 'jueves' },
  { weekday: 5, short: 'V', long: 'viernes' },
  { weekday: 6, short: 'S', long: 'sábado' },
  { weekday: 0, short: 'D', long: 'domingo' },
];

interface RevealPhaseProps {
  result: OnboardingSpaceResult;
  userName: string;
  regenerateUsed: boolean;
  onStart: () => void;
  onAdjust: (blockId: string) => void;
  onRegenerate: () => void;
}

export default function RevealPhase({
  result,
  userName,
  regenerateUsed,
  onStart,
  onAdjust,
  onRegenerate,
}: RevealPhaseProps) {
  const reduceMotion = useReducedMotion();
  const celebratedRef = useRef(false);

  // Una sola celebración háptica, aunque el componente re-renderice.
  useEffect(() => {
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const trimmedName = userName.trim();
  const title =
    trimmedName.length > 0 ? `${trimmedName}, este es tu espacio` : 'Este es tu espacio';
  const assignedDays = new Set(result.weekAssignments.map((a) => a.weekday));
  const hasBlocks = result.blocks.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(Animation.duration.normal)}
          style={styles.headerBlock}
        >
          <Text style={styles.eyebrow}>TU ESPACIO ESTÁ LISTO</Text>
          <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.5}>
            {title}
          </Text>
        </Animated.View>

        {hasBlocks ? (
          result.blocks.map((block, i) => (
            <RevealBlockCard key={block.id} block={block} index={i} reduceMotion={reduceMotion} />
          ))
        ) : (
          // Estado degradado: la generación devolvió 0 bloques pero el flujo
          // no se rompe — el usuario entra a un espacio listo para construir.
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(Animation.duration.normal)}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyTitle}>Tu lienzo está en blanco</Text>
            <Text style={styles.emptyBody}>
              Entra y crea tu primer bloque a tu manera — Kai te acompaña.
            </Text>
          </Animated.View>
        )}

        {result.weekAssignments.length > 0 && (
          <Animated.View
            entering={
              reduceMotion ? undefined : FadeInDown.delay(240).duration(Animation.duration.normal)
            }
            style={styles.weekBlock}
          >
            <Text style={styles.sectionLabel}>TU SEMANA</Text>
            <View style={styles.weekRow}>
              {WEEK_DISPLAY.map((day) => {
                const active = assignedDays.has(day.weekday);
                return (
                  <View
                    key={day.weekday}
                    accessibilityLabel={
                      active ? `${day.long}: entrenamiento asignado` : `${day.long}: descanso`
                    }
                    style={[styles.dayCell, active ? styles.dayCellActive : styles.dayCellIdle]}
                  >
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>
                      {day.short}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.weekCaption}>
              {assignedDays.size} {assignedDays.size === 1 ? 'día' : 'días'} a la semana — puedes
              moverlos cuando quieras.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      <Animated.View
        entering={
          reduceMotion ? undefined : FadeInDown.delay(320).duration(Animation.duration.normal)
        }
        style={styles.actions}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Empezar"
          accessibilityHint="Acepta tu espacio y entra en Kairos"
          onPress={onStart}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressedDim]}
        >
          <Text style={styles.primaryText}>Empezar</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          {hasBlocks && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajustar"
              accessibilityHint="Abre tu primer bloque en el editor"
              onPress={() => onAdjust(result.blocks[0].id)}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressedDim]}
            >
              <Text style={styles.ghostText}>Ajustar</Text>
            </Pressable>
          )}
          {regenerateUsed ? (
            <View style={styles.regenSpent}>
              <Text style={styles.regenSpentText}>Espacio regenerado</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Regenerar"
              accessibilityHint="Pide a Kai otra propuesta de espacio"
              onPress={onRegenerate}
              style={({ pressed }) => [styles.textBtn, pressed && styles.pressedDim]}
            >
              <Feather name="rotate-ccw" size={14} color={Colors.ink.tertiary} />
              <Text style={styles.textBtnLabel}>Regenerar</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function RevealBlockCard({
  block,
  index,
  reduceMotion,
}: {
  block: WorkoutBlock;
  index: number;
  reduceMotion: boolean;
}) {
  // Entrada reservada de 480ms (scale 0.95→1 + fade) SOLO para este card —
  // es el layout shift del momento aha (norma CLAUDE.md).
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.95);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      scale.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: Animation.duration.slow,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withSpring(1, springs.gentle);
  }, [progress, scale, reduceMotion]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: scale.value }],
  }));

  const exercises = getBlockExercises(block);
  const visible = exercises.slice(0, MAX_VISIBLE_EXERCISES);
  const hiddenCount = exercises.length - visible.length;
  const disciplineColor = Colors.discipline[block.discipline] ?? Colors.discipline.general;

  return (
    <Animated.View style={[styles.blockCard, cardStyle]}>
      <View style={styles.blockHeader}>
        <View style={[styles.disciplineDot, { backgroundColor: disciplineColor }]} />
        <Text style={styles.blockName} numberOfLines={1}>
          {block.name}
        </Text>
        <Text style={styles.blockMeta}>
          {exercises.length} {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
        </Text>
      </View>

      {visible.map((ex, i) => (
        <Animated.View
          key={ex.id}
          entering={
            reduceMotion ? undefined : FadeInDown.delay(160 + index * 120 + i * 50).duration(240)
          }
          style={styles.exerciseRow}
        >
          <View style={styles.exerciseTick} />
          <Text style={styles.exerciseName} numberOfLines={1}>
            {ex.name}
          </Text>
          <Text style={styles.exerciseSets}>{ex.sets.length}×</Text>
        </Animated.View>
      ))}

      {hiddenCount > 0 && <Text style={styles.moreText}>+{hiddenCount} más</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  headerBlock: {
    gap: Spacing.sm,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  title: {
    ...Type.title,
    color: Colors.ink.primary,
  },
  blockCard: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.cardWarm,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    marginBottom: Spacing.xs,
  },
  disciplineDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  blockName: {
    ...Type.subheading,
    color: Colors.ink.primary,
    flex: 1,
  },
  blockMeta: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  exerciseTick: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.hair.strong,
  },
  exerciseName: {
    ...Type.body,
    color: Colors.ink.secondary,
    flex: 1,
  },
  exerciseSets: {
    ...Type.numSmall,
    color: Colors.ink.muted,
  },
  moreText: {
    ...Type.caption,
    color: Colors.ink.muted,
    marginLeft: Spacing.lg + 2,
  },
  emptyCard: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  emptyBody: {
    ...Type.body,
    color: Colors.ink.tertiary,
  },
  weekBlock: {
    gap: Spacing.md,
  },
  sectionLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
  },
  weekRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dayCell: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellIdle: {
    backgroundColor: 'transparent',
    borderColor: Colors.hair.base,
  },
  dayCellActive: {
    backgroundColor: Colors.gold.glow,
    borderColor: Colors.gold.base,
  },
  dayText: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  dayTextActive: {
    color: Colors.ink.primary,
  },
  weekCaption: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  actions: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  primaryBtn: {
    height: 56,
    borderRadius: Radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold.base,
    ...Shadows.card,
    shadowColor: Colors.gold.base,
  },
  primaryText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  ghostBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius['3xl'],
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
  },
  textBtnLabel: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  regenSpent: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenSpentText: {
    ...Type.micro,
    color: Colors.ink.muted,
  },
  pressedDim: {
    opacity: 0.92,
  },
});
