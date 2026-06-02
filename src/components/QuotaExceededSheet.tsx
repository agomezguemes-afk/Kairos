// KAIROS — QuotaExceededSheet
// Premium-minimal bottom sheet shown when the user hits their AI daily
// cap. Counts down to reset, surfaces the Pro upgrade CTA when the
// tier is free (upgrade hidden for pro users — they've already paid).
//
// The actual subscription flow (RevenueCat / StoreKit) is not wired
// yet. The CTA shows a "Próximamente" toast instead so the sheet works
// end-to-end without the dependency.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { QuotaExceededError } from '../lib/ai/client';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';
import { springs } from '../theme/animations';

interface QuotaExceededSheetProps {
  visible: boolean;
  payload: Pick<
    QuotaExceededError,
    'tier' | 'dailyCap' | 'usedToday' | 'resetsAt' | 'upgradeAvailable'
  > | null;
  onClose: () => void;
  /** Optional callback fired when the user taps "Desbloquear Pro". */
  onUpgrade?: () => void;
}

function formatRemaining(resetsAt: string): string {
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (ms <= 0) return 'disponible ya';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`;
  return `${m}min`;
}

export default function QuotaExceededSheet({
  visible,
  payload,
  onClose,
  onUpgrade,
}: QuotaExceededSheetProps) {
  const insets = useSafeAreaInsets();
  const ctaScale = useSharedValue(1);
  const [, setTick] = useState(0);

  // One-second ticker so the countdown updates while the sheet is open.
  // Cheap — only runs while visible.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const remaining = useMemo(
    () => (payload ? formatRemaining(payload.resetsAt) : ''),
    // Recompute every render while the sheet is open — `setTick` triggers
    // it. Cheap because the body of formatRemaining is trivial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, payload?.resetsAt, visible, setTick],
  );

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  if (!payload) return null;
  const isPro = payload.tier === 'pro';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(180)} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.duration(280).springify().damping(20)}
          exiting={SlideOutDown.duration(220)}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
        >
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.iconHalo}>
            <Feather name={isPro ? 'clock' : 'zap'} size={26} color={Colors.gold.base} />
          </View>

          <Text style={styles.title}>
            {isPro ? 'Te queda poco para el reset' : 'Has llegado a tu límite diario'}
          </Text>

          <Text style={styles.subtitle}>
            {isPro
              ? `Has usado tus ${payload.dailyCap} mensajes Pro de hoy. Vuelven en ${remaining}.`
              : `${payload.usedToday}/${payload.dailyCap} mensajes consumidos. Tu cuota se renueva en ${remaining}.`}
          </Text>

          {/* Progress bar — visualizes used / cap */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    `${Math.min(100, (payload.usedToday / payload.dailyCap) * 100)}%` as `${number}%`,
                  backgroundColor: Colors.gold.base,
                },
              ]}
            />
          </View>

          {/* CTA */}
          {payload.upgradeAvailable && !isPro && (
            <Animated.View style={ctaStyle}>
              <Pressable
                onPressIn={() => {
                  ctaScale.value = withSpring(0.96, springs.tap);
                }}
                onPressOut={() => {
                  ctaScale.value = withSpring(1, springs.bouncy);
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onUpgrade?.();
                }}
                style={styles.ctaPrimary}
              >
                <Feather name="star" size={16} color={Colors.ink.inverse} />
                <Text style={styles.ctaPrimaryText}>Desbloquear Kai Pro</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Value props — only shown for the free → pro upsell */}
          {payload.upgradeAvailable && !isPro && (
            <View style={styles.bullets}>
              <BulletRow icon="message-circle" text="500 mensajes al día" />
              <BulletRow icon="cpu" text="Modelo Claude Sonnet 4.6 (más capaz)" />
              <BulletRow icon="zap" text="Sin colas en horas punta" />
            </View>
          )}

          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text style={styles.dismissText}>{isPro ? 'Entendido' : 'Esperar al reset'}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function BulletRow({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIcon}>
        <Feather name={icon} size={13} color={Colors.gold.base} />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    ...Shadows.elevated,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.lg,
  },
  iconHalo: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.ink.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.body,
    color: Colors.ink.secondary,
    textAlign: 'center',
    lineHeight: Typography.size.body * 1.5,
    marginBottom: Spacing.lg,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.gold.base,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
    shadowColor: Colors.gold.base,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  ctaPrimaryText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.ink.inverse,
    letterSpacing: 0.1,
  },
  bullets: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bulletIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    fontSize: Typography.size.caption,
    color: Colors.ink.secondary,
  },
  dismiss: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  dismissText: {
    fontSize: Typography.size.caption,
    color: Colors.ink.tertiary,
    fontWeight: Typography.weight.medium,
  },
});
