// KAIROS — Loading theatre de generación (U2)
// 4 pasos narrados con checks oro en cadencia de 650ms — nunca hay silencio
// > 2s y nunca un spinner. Idéntico en camino IA y fallback de plantilla:
// el usuario no distingue el origen. Kai (mascota) preside la construcción.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import KaiMascot from '../../components/onboarding/KaiMascot';
import { Colors, Type, Spacing, Radius, Animation } from '../../theme/tokens';
import { THEATRE_STEP_INTERVAL_MS } from './onboardingFlow';

interface GenerationTheatreProps {
  steps: string[];
  /** true cuando generación + mínimo percibido (2.6s) han terminado. */
  finished: boolean;
  error: string | null;
  userName: string;
  reduceMotion: boolean;
  onRetry: () => void;
}

export default function GenerationTheatre({
  steps,
  finished,
  error,
  userName,
  reduceMotion,
  onRetry,
}: GenerationTheatreProps) {
  // Nº de pasos completados. Los intermedios avanzan por timer; el último
  // espera a que la generación real (con gate de 2.6s) resuelva.
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (error) return; // congela la narración en error
    if (done >= steps.length - 1) return;
    const t = setTimeout(() => {
      setDone((d) => Math.min(d + 1, steps.length - 1));
    }, THEATRE_STEP_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [done, steps.length, error]);

  useEffect(() => {
    if (finished) setDone(steps.length);
  }, [finished, steps.length]);

  // Haptic sutil por check — la contención es premium (04-ux §S8).
  useEffect(() => {
    if (done > 0) Haptics.selectionAsync().catch(() => {});
  }, [done]);

  const message =
    userName.trim().length > 0
      ? `Estoy montando tu espacio, ${userName.trim()}…`
      : 'Estoy montando tu espacio…';

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(Animation.duration.normal)}
      style={styles.root}
      accessibilityLabel="Kai está montando tu espacio"
    >
      <View style={styles.kaiWrap}>
        <KaiMascot message={message} />
      </View>

      <View style={styles.stepsCard}>
        {steps.map((label, i) => {
          const isDone = i < done;
          return (
            <View key={label} style={styles.stepRow}>
              <View style={styles.stepIconSlot}>
                {isDone ? (
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeIn.duration(Animation.duration.fast)}
                  >
                    <Feather name="check" size={16} color={Colors.gold.base} />
                  </Animated.View>
                ) : (
                  <View style={styles.pendingDot} />
                )}
              </View>
              <Text style={[styles.stepText, isDone && styles.stepTextDone]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {error !== null && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(Animation.duration.normal)}
          style={styles.errorWrap}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            accessibilityHint="Vuelve a intentar montar tu espacio"
            onPress={onRetry}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
          >
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.xl,
  },
  kaiWrap: {
    paddingHorizontal: Spacing.sm,
  },
  stepsCard: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
  },
  stepText: {
    ...Type.body,
    color: Colors.ink.muted,
    flexShrink: 1,
  },
  stepTextDone: {
    color: Colors.ink.primary,
  },
  errorWrap: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    ...Type.caption,
    color: Colors.semantic.error,
    textAlign: 'center',
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing['2xl'],
    borderRadius: Radius['3xl'],
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnPressed: {
    opacity: 0.92,
  },
  retryText: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
});
