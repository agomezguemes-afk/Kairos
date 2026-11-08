// UnlockCard — a suggestion arrives sealed. Holding it fills a gold
// shutter; at full it pops open and the change counts up from the old
// value to the new one. The ritual is the point: the user *earns* the
// reveal with their training, then decides — nothing is applied for them.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import KIcon from '../../../components/icons/KIcon';
import { getMovement, type MovementTarget, type Suggestion } from '../../../lib/adaptive';
import { Coach, Colors, Radius, Spacing, Type } from '../../../theme/tokens';
import { springs } from '../../../theme/animations';
import { feedback } from '../feedback';
import { formatValue, stepFor } from '../format';

const HOLD_MS = 850;

const CONFIDENCE_LABEL = {
  early: 'Primeros datos',
  emerging: 'Tendencia',
  solid: 'Patrón sólido',
} as const;

interface Props {
  suggestion: Suggestion;
  onReveal: (id: string) => void;
  onResolve: (
    id: string,
    outcome: 'accepted' | 'adjusted' | 'dismissed',
    override?: Partial<MovementTarget>,
  ) => void;
}

function useCountUp(from: number, to: number, run: boolean, duration = 700): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (!run) return;
    const start = Date.now();
    let raf: ReturnType<typeof requestAnimationFrame>;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, run, duration]);
  return run ? value : from;
}

function UnlockCard({ suggestion: s, onReveal, onResolve }: Props) {
  const reduceMotion = useReducedMotion();
  const rarity = Coach.rarity[s.rarity];
  const revealed = s.status !== 'locked';
  const resolved = s.status === 'accepted' || s.status === 'adjusted' || s.status === 'dismissed';

  const fill = useSharedValue(0);
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [custom, setCustom] = useState<number | null>(s.to?.value ?? null);

  useEffect(() => {
    if (revealed || reduceMotion) return;
    // Breathing edge glow: sealed cards feel alive, not disabled.
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [revealed, reduceMotion, pulse]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const complete = useCallback(() => {
    clearTimers();
    feedback.success();
    scale.value = withSequence(withSpring(1.04, springs.celebrate), withSpring(1, springs.enter));
    fill.value = withTiming(0, { duration: 420 });
    onReveal(s.id);
  }, [fill, onReveal, s.id, scale]);

  const onPressIn = () => {
    if (revealed) return;
    feedback.light();
    fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    // Haptic ticks make the hold feel like a dial being turned.
    [0.33, 0.66].forEach((p) => timers.current.push(setTimeout(feedback.tick, HOLD_MS * p)));
    timers.current.push(setTimeout(complete, HOLD_MS));
  };

  const onPressOut = () => {
    if (revealed) return;
    if (timers.current.length) {
      clearTimers();
      fill.value = withTiming(0, { duration: 220 });
    }
  };

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.65 }));

  const counted = useCountUp(
    s.from?.value ?? 0,
    s.to?.value ?? 0,
    revealed && !!s.from && !!s.to && !reduceMotion,
  );
  const shownTo = revealed && s.to ? (reduceMotion ? s.to.value : counted) : (s.from?.value ?? 0);
  const replacement = s.replacementMovementId ? getMovement(s.replacementMovementId) : undefined;
  const target = getMovement(s.movementId);
  const Shell = revealed ? View : Pressable;

  if (resolved) {
    const label =
      s.status === 'dismissed'
        ? 'Descartado'
        : s.status === 'adjusted'
          ? 'Ajustado y aplicado'
          : 'Aplicado al plan';
    return (
      <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.resolved}>
        <Text style={styles.resolvedTitle} numberOfLines={1}>
          {s.title}
        </Text>
        <Text
          style={[styles.resolvedLabel, s.status !== 'dismissed' && { color: Colors.gold.base }]}
        >
          {label}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)} style={cardStyle}>
      {/* Once open, the shell must stop being a Pressable: a (disabled)
          pressable parent swallows the action buttons' presses on web. */}
      <Shell
        {...(revealed
          ? { accessibilityLabel: s.title }
          : {
              onPressIn,
              onPressOut,
              accessibilityRole: 'button' as const,
              accessibilityLabel: `${rarity.label} bloqueada. Mantén pulsado para desbloquear`,
              accessibilityHint: 'Mantén pulsado un segundo',
            })}
        style={[styles.card, { borderColor: rarity.edge }]}
      >
        {!revealed && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.glow,
              { shadowColor: rarity.edge, backgroundColor: rarity.glow },
              glowStyle,
            ]}
          />
        )}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.fill, fillStyle]}
        >
          <LinearGradient
            colors={[Colors.gold.deep, Colors.gold.base, Colors.gold.light]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.headerRow}>
          <View style={[styles.rarityPill, { borderColor: rarity.edge }]}>
            <KIcon name={revealed ? 'unlock' : 'lock'} size={12} color={rarity.edge} />
            <Text style={[styles.rarityText, { color: rarity.edge }]}>{rarity.label}</Text>
          </View>
          {revealed && <Text style={styles.confidence}>{CONFIDENCE_LABEL[s.confidence]}</Text>}
        </View>

        {!revealed ? (
          <View style={styles.sealed}>
            <View style={[styles.bar, { width: '72%' }]} />
            <View style={[styles.bar, { width: '48%', opacity: 0.6 }]} />
            <Text style={styles.holdHint}>Mantén pulsado para desbloquear</Text>
          </View>
        ) : (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(18)}>
            <Text style={styles.title}>{s.title}</Text>

            {s.from && s.to && (
              <View style={styles.deltaRow}>
                <Text style={styles.fromValue}>{formatValue(s.from.value, s.from.unit)}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text
                  style={[styles.toValue, s.rarity !== 'common' && { color: Colors.gold.light }]}
                >
                  {formatValue(Math.round(shownTo * 100) / 100, s.to.unit)}
                </Text>
              </View>
            )}
            {replacement && target && (
              <View style={styles.swapRow}>
                <Text style={styles.swapFrom}>{target.name}</Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.swapTo}>{replacement.name}</Text>
              </View>
            )}
            {!replacement && s.kind === 'new_movement' && target && (
              <Text style={styles.cue}>{target.cue}</Text>
            )}

            <Text style={styles.rationale}>{s.rationale}</Text>

            <Pressable onPress={() => setShowWhy((v) => !v)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.why}>{showWhy ? 'Ocultar datos' : '¿En qué me baso?'}</Text>
            </Pressable>
            {showWhy && (
              <Animated.View entering={FadeIn.duration(180)} style={styles.evidence}>
                {s.evidence.map((e) => (
                  <Text key={e} style={styles.evidenceLine}>
                    · {e}
                  </Text>
                ))}
              </Animated.View>
            )}

            {adjusting && s.to && custom !== null ? (
              <View style={styles.adjustRow}>
                <Stepper
                  value={custom}
                  unit={s.to.unit}
                  onChange={(v) => {
                    feedback.tick();
                    setCustom(v);
                  }}
                />
                <ActionButton
                  label="Guardar"
                  primary
                  onPress={() => {
                    feedback.success();
                    onResolve(s.id, 'adjusted', patchFor(s, custom));
                  }}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <ActionButton
                  label="Aplicar"
                  primary
                  onPress={() => {
                    feedback.success();
                    onResolve(s.id, 'accepted');
                  }}
                />
                {s.to && <ActionButton label="Ajustar" onPress={() => setAdjusting(true)} />}
                <ActionButton
                  label="Ahora no"
                  ghost
                  onPress={() => {
                    feedback.light();
                    onResolve(s.id, 'dismissed');
                  }}
                />
              </View>
            )}
          </Animated.View>
        )}
      </Shell>
    </Animated.View>
  );
}

function patchFor(s: Suggestion, value: number): Partial<MovementTarget> {
  switch (s.kind) {
    case 'increase_load':
    case 'deload':
      return { loadKg: value };
    case 'extend_duration':
      return { durationMin: value };
    case 'extend_distance':
      return { distanceKm: value };
    case 'add_interval':
      return s.patch?.intervals ? { intervals: { ...s.patch.intervals, reps: value } } : {};
    default:
      return {};
  }
}

const Stepper = React.memo(function Stepper({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const step = stepFor(unit, value);
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(Math.max(0, +(value - step).toFixed(2)))}
        accessibilityLabel="Menos"
      >
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{formatValue(value, unit)}</Text>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(+(value + step).toFixed(2))}
        accessibilityLabel="Más"
      >
        <Text style={styles.stepGlyph}>+</Text>
      </Pressable>
    </View>
  );
});

const ActionButton = React.memo(function ActionButton({
  label,
  onPress,
  primary,
  ghost,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  ghost?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        ghost && styles.actionGhost,
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Coach.stageRaised,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    overflow: 'hidden',
    minHeight: 168,
  },
  glow: {
    borderRadius: Radius.xl,
    shadowOpacity: 0.8,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  fill: { transformOrigin: 'left', opacity: 0.9 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  rarityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rarityText: { ...Type.micro, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700' },
  confidence: { ...Type.micro, color: Coach.stageMuted, letterSpacing: 0.4 },
  sealed: { gap: 10, paddingTop: Spacing.xs },
  bar: { height: 14, borderRadius: 7, backgroundColor: Coach.stageLine },
  holdHint: { ...Type.caption, color: Coach.stageMuted, marginTop: Spacing.md },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Coach.stageInk,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
  },
  fromValue: {
    fontSize: 22,
    fontWeight: '600',
    color: Coach.stageFaint,
    textDecorationLine: 'line-through',
  },
  arrow: { fontSize: 22, color: Coach.stageMuted },
  toValue: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: Coach.stageInk,
    fontVariant: ['tabular-nums'],
  },
  swapRow: { marginTop: Spacing.md, gap: 4 },
  swapFrom: { ...Type.body, color: Coach.stageFaint, textDecorationLine: 'line-through' },
  swapTo: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: Colors.gold.light },
  cue: { ...Type.body, color: Coach.stageMuted, marginTop: Spacing.sm },
  rationale: { ...Type.body, color: Coach.stageMuted, marginTop: Spacing.md },
  why: { ...Type.caption, color: Colors.gold.base, marginTop: Spacing.md, fontWeight: '600' },
  evidence: { marginTop: Spacing.sm, gap: 2 },
  evidenceLine: { ...Type.caption, color: Coach.stageMuted, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl, flexWrap: 'wrap' },
  action: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Coach.stageLine,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionPrimary: { backgroundColor: Colors.gold.base, borderColor: Colors.gold.base },
  actionGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  actionText: { ...Type.bodyEmph, color: Coach.stageInk },
  actionTextPrimary: { color: Coach.stage },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Coach.stageLine,
  },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 22, color: Coach.stageInk, fontWeight: '600' },
  stepValue: {
    ...Type.bodyEmph,
    color: Coach.stageInk,
    minWidth: 76,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resolved: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Coach.stageLine,
    gap: Spacing.md,
  },
  resolvedTitle: { ...Type.body, color: Coach.stageMuted, flex: 1 },
  resolvedLabel: { ...Type.caption, color: Coach.stageFaint, fontWeight: '600' },
});

export default React.memo(UnlockCard);
