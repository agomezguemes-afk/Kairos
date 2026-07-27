// RestScoreboard — the rest state IS the screen (spec §4): countdown as the
// dominant element with a progress ring, a "siguiente" peek of what comes
// after, saltar / +30s actions, and the quiet per-exercise rest tuning row.
// Auto-advance happens upstream: onComplete fires once at 0 (after the
// Warning haptic — the user doesn't look until it buzzes).
//
// Supersedes RestTimer for the in-session flow: same ring technique, but the
// layout contract changed (peek + scoreboard numeral), so this is a sibling,
// not a patch.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, FontFamily, Radius, Spacing, Type } from '../../theme/tokens';
import type { FormattedTarget } from '../../features/workout/scoreboard/format';

interface Props {
  durationSec: number;
  startTime: number;
  /** State headline — e.g. "Descanso · calentamiento" after a warmup set. */
  label?: string;
  onSkip: () => void;
  /** Fires exactly once when the countdown hits zero (auto-advance). */
  onComplete: () => void;
  onExtend: (seconds: number) => void;
  /** "Siguiente" peek — headline (exercise or set) + optional target line. */
  nextLabel: string | null;
  nextTarget: FormattedTarget | null;
  /** Rest target for the current exercise — powers the −15/+15 tuning row. */
  currentRestSeconds?: number;
  onChangeRestSeconds?: (newRestSeconds: number) => void;
  /**
   * Echo of the just-completed set — "Hecho · 60 kg × 8 · Corregir". Sober
   * (no gold: the gold is the ring's); tapping opens the correction sheet
   * for THAT set without restarting the countdown.
   */
  justCompleted?: {
    label: string;
    target: FormattedTarget | null;
    onCorrect: () => void;
  };
}

const TICK_MS = 250;
const RING_SIZE = 260;
const STROKE_W = 12;
const RADIUS = (RING_SIZE - STROKE_W) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const CENTER = RING_SIZE / 2;
const EXTEND_SECONDS = 30; // spec: "saltar descanso / +30s" (matches the widget)
const REST_ADJUST_STEP = 15;

function RestScoreboardImpl({
  durationSec,
  startTime,
  label,
  onSkip,
  onComplete,
  onExtend,
  nextLabel,
  nextTarget,
  currentRestSeconds,
  onChangeRestSeconds,
  justCompleted,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [startTime, durationSec]);

  const remainingMs = Math.max(0, startTime + durationSec * 1000 - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, '0');
  const ss = (remainingSec % 60).toString().padStart(2, '0');
  const pct =
    durationSec > 0 ? Math.min(1, (durationSec * 1000 - remainingMs) / (durationSec * 1000)) : 1;
  const dashOffset = CIRC * (1 - pct);

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      // Warning notification = "look at the phone now" — preserved vocabulary.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      onComplete();
    }
  }, [remainingMs, onComplete]);

  const handleExtend = () => {
    Haptics.selectionAsync().catch(() => {});
    onExtend(EXTEND_SECONDS);
  };

  const handleSkip = () => {
    Haptics.selectionAsync().catch(() => {});
    onSkip();
  };

  const showRestAdjust =
    typeof currentRestSeconds === 'number' && typeof onChangeRestSeconds === 'function';
  const handleAdjustRest = (delta: number) => {
    if (!onChangeRestSeconds || typeof currentRestSeconds !== 'number') return;
    Haptics.selectionAsync().catch(() => {});
    onChangeRestSeconds(Math.max(0, currentRestSeconds + delta));
  };

  const nextTargetLine =
    nextTarget != null
      ? nextTarget.segments
          .map((s) => (s.unit ? `${s.value} ${s.unit}` : s.value))
          .join(` ${nextTarget.separator} `)
      : null;

  const doneTargetLine =
    justCompleted?.target != null
      ? justCompleted.target.segments
          .map((s) => (s.unit ? `${s.value} ${s.unit}` : s.value))
          .join(` ${justCompleted.target.separator} `)
      : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} accessibilityRole="text">
        {label ?? 'Descanso'}
      </Text>

      <View
        style={styles.ringWrap}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 1, now: pct }}
        accessibilityLabel={`Descanso, quedan ${mm}:${ss}`}
      >
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={Colors.hair.strong}
            strokeWidth={STROKE_W}
            fill="none"
            opacity={0.5}
          />
          {/* Progress fill is motion — reduce-motion keeps the static track +
              the ticking numeral (which is content, not decoration). */}
          {!reduceMotion ? (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke={Colors.gold.base}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          ) : null}
        </Svg>
        <View style={styles.numeralWrap} pointerEvents="none">
          <Text style={styles.timer} maxFontSizeMultiplier={1.2}>
            {mm}:{ss}
          </Text>
        </View>
      </View>

      {/* "Siguiente" peek — the one piece of context worth a glance mid-rest. */}
      {nextLabel ? (
        <View
          style={styles.nextWrap}
          accessible
          accessibilityLabel={`Siguiente: ${nextLabel}${nextTarget ? `, ${nextTarget.spoken}` : ''}`}
        >
          <Text style={styles.nextEyebrow} maxFontSizeMultiplier={1.6}>
            Siguiente
          </Text>
          <Text style={styles.nextName} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {nextLabel}
          </Text>
          {nextTargetLine ? (
            <Text style={styles.nextTarget} maxFontSizeMultiplier={1.6}>
              {nextTargetLine}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Echo of the just-completed set — the fix-it-when-you-notice-it row.
          Sober ink on elevated bg; no gold (the ring owns the gold moment). */}
      {justCompleted ? (
        <Pressable
          onPress={justCompleted.onCorrect}
          accessibilityRole="button"
          accessibilityLabel={`Corregir la serie recién hecha: ${justCompleted.label}${
            justCompleted.target ? ` ${justCompleted.target.spoken}` : ''
          }`}
          style={({ pressed }) => [styles.doneRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.doneText} numberOfLines={1} maxFontSizeMultiplier={1.6}>
            Hecho{doneTargetLine ? ` · ${doneTargetLine}` : ''} ·{' '}
            <Text style={styles.doneCorrect}>Corregir</Text>
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleExtend}
          accessibilityRole="button"
          accessibilityLabel="Añadir 30 segundos de descanso"
          style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.extendText} maxFontSizeMultiplier={1.5}>
            +30s
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Saltar descanso"
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.skipText} maxFontSizeMultiplier={1.5}>
            Saltar descanso
          </Text>
        </Pressable>
      </View>

      {showRestAdjust ? (
        <View style={styles.adjustRow}>
          <Text style={styles.adjustLabel} maxFontSizeMultiplier={1.6}>
            Próximo descanso: <Text style={styles.adjustValue}>{currentRestSeconds}s</Text>
          </Text>
          <View style={styles.adjustBtns}>
            <Pressable
              onPress={() => handleAdjustRest(-REST_ADJUST_STEP)}
              accessibilityRole="button"
              accessibilityLabel="Reducir descanso 15 segundos"
              hitSlop={8}
              style={({ pressed }) => [styles.adjustBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.adjustBtnText}>−15</Text>
            </Pressable>
            <Pressable
              onPress={() => handleAdjustRest(REST_ADJUST_STEP)}
              accessibilityRole="button"
              accessibilityLabel="Aumentar descanso 15 segundos"
              hitSlop={8}
              style={({ pressed }) => [styles.adjustBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.adjustBtnText}>+15</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const RestScoreboard = React.memo(RestScoreboardImpl);
export default RestScoreboard;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  label: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeralWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Scoreboard numeral — sans tabular, sized for a 2 m glance.
  timer: {
    fontFamily: FontFamily.sans,
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '600',
    letterSpacing: -1.5,
    color: Colors.ink.primary,
    fontVariant: ['tabular-nums'],
  },
  nextWrap: {
    alignItems: 'center',
    gap: 2,
  },
  nextEyebrow: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
  },
  nextName: {
    ...Type.subheading,
    color: Colors.ink.primary,
    textAlign: 'center',
  },
  nextTarget: {
    ...Type.numMedium,
    color: Colors.ink.tertiary,
  },
  doneRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  doneText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontVariant: ['tabular-nums'],
  },
  doneCorrect: {
    color: Colors.ink.secondary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  // +30s pill — gold ghost matches the rest state's gold ring (the rest screen
  // is the one gold moment of the session flow).
  extendBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.glow,
  },
  extendText: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
    fontVariant: ['tabular-nums'],
  },
  skipBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    ...Type.bodyEmph,
    color: Colors.ink.tertiary,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  adjustLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  adjustValue: {
    color: Colors.ink.secondary,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  adjustBtns: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  adjustBtn: {
    minHeight: 32,
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  adjustBtnText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
