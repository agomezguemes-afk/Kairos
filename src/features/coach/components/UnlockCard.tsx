// UnlockCard — a suggestion arrives sealed. Holding it fills a gold bar
// while the seal turns; at full it pops open and the change counts up
// from the old value to the new one. The ritual is the point: the user
// *earns* the reveal with their training, then decides — nothing is
// applied for them.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

import KIcon from '../../../components/icons/KIcon';
import { getMovement, type MovementTarget, type Suggestion } from '../../../lib/adaptive';
import { Brut, Coach, Spacing } from '../../../theme/tokens';
import { springs } from '../../../theme/animations';
import { feedback } from '../feedback';
import { formatValue, stepFor } from '../format';
import { BPress, BTag, BText } from '../ui/brut';

const HOLD_MS = 850;

const CONFIDENCE_LABEL = {
  early: 'PRIMEROS DATOS',
  emerging: 'TENDENCIA',
  solid: 'PATRÓN SÓLIDO',
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
  const special = s.rarity !== 'common';
  const revealed = s.status !== 'locked';
  const resolved = s.status === 'accepted' || s.status === 'adjusted' || s.status === 'dismissed';

  const fill = useSharedValue(0);
  const scale = useSharedValue(1);
  const breathe = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [holding, setHolding] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [custom, setCustom] = useState<number | null>(s.to?.value ?? null);

  useEffect(() => {
    if (revealed || reduceMotion) return;
    // Breathing skeleton: sealed cards feel alive, not disabled.
    breathe.value = withRepeat(
      withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [revealed, reduceMotion, breathe]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const complete = useCallback(() => {
    clearTimers();
    setHolding(false);
    feedback.success();
    scale.value = withSequence(withSpring(1.03, springs.celebrate), withSpring(1, springs.enter));
    fill.value = withTiming(0, { duration: 300 });
    onReveal(s.id);
  }, [fill, onReveal, s.id, scale]);

  const onPressIn = () => {
    if (revealed) return;
    feedback.light();
    setHolding(true);
    fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    // Haptic ticks make the hold feel like a dial being turned.
    [0.33, 0.66].forEach((p) => timers.current.push(setTimeout(feedback.tick, HOLD_MS * p)));
    timers.current.push(setTimeout(complete, HOLD_MS));
  };

  const onPressOut = () => {
    if (revealed) return;
    if (timers.current.length) {
      clearTimers();
      setHolding(false);
      fill.value = withTiming(0, { duration: 220 });
    }
  };

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fill.value * 180}deg` }],
  }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const barStyle = useAnimatedStyle(() => ({ opacity: 0.12 + (1 - breathe.value) * 0.2 }));

  const counted = useCountUp(
    s.from?.value ?? 0,
    s.to?.value ?? 0,
    revealed && !!s.from && !!s.to && !reduceMotion,
  );
  const shownTo = revealed && s.to ? (reduceMotion ? s.to.value : counted) : (s.from?.value ?? 0);
  const replacement = s.replacementMovementId ? getMovement(s.replacementMovementId) : undefined;
  const target = getMovement(s.movementId);
  const pct =
    s.from && s.to && s.from.value > 0
      ? Math.round(((s.to.value - s.from.value) / s.from.value) * 1000) / 10
      : null;
  const Shell = revealed ? View : Pressable;

  if (resolved) {
    const label =
      s.status === 'dismissed' ? 'DESCARTADA' : s.status === 'adjusted' ? 'AJUSTADA' : 'APLICADA';
    return (
      <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.resolved}>
        <BText size={14} color={Brut.muted} numberOfLines={1} style={{ flex: 1 }}>
          {s.title}
        </BText>
        <BTag bg={s.status === 'dismissed' ? 'transparent' : Brut.accent}>{label}</BTag>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.duration(Brut.motion.tab)} style={cardStyle}>
      <View style={[styles.shadow, { backgroundColor: special ? Brut.accent : Brut.ink }]} />
      {/* Once open, the shell must stop being a Pressable: a (disabled)
          pressable parent swallows the action buttons' presses on web. */}
      <Shell
        {...(revealed
          ? { accessibilityLabel: s.title }
          : {
              onPressIn,
              onPressOut,
              accessibilityRole: 'button' as const,
              accessibilityLabel: `${rarity.label} sellada. Mantén pulsado para abrir`,
              accessibilityHint: 'Mantén pulsado un segundo',
            })}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <BText variant="monoBold" size={10}>
            <BText variant="monoBold" size={10} color={special ? Brut.accent : Brut.ink}>
              ■{' '}
            </BText>
            {revealed ? 'ABIERTA' : 'SELLADA'}
            {revealed ? ` · ${CONFIDENCE_LABEL[s.confidence]}` : ''}
          </BText>
          <BTag bg={special ? Brut.accent : 'transparent'}>{rarity.label.toUpperCase()}</BTag>
        </View>

        {!revealed ? (
          <View>
            <View style={styles.sealed}>
              <Animated.View style={[styles.bar, { width: '70%', height: 18 }, barStyle]} />
              <Animated.View style={[styles.bar, { width: '92%' }, barStyle]} />
              <Animated.View style={[styles.bar, { width: '55%' }, barStyle]} />
            </View>
            <View style={styles.hold}>
              <Animated.View pointerEvents="none" style={[styles.holdFill, fillStyle]} />
              <Animated.View style={sealStyle}>
                <KIcon name="lock" size={18} color={Brut.ink} strokeWidth={2.2} />
              </Animated.View>
              <BText variant="bodyBold" size={15}>
                {holding ? 'Abriendo…' : 'Mantén para abrir'}
              </BText>
            </View>
            <BText variant="mono" size={10} color={Brut.muted} style={{ marginTop: 8 }}>
              BASADA EN TUS SESIONES · NADA INVENTADO
            </BText>
          </View>
        ) : (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(Brut.motion.reveal)}
          >
            <BText variant="display" size={26}>
              {s.title.toUpperCase()}
            </BText>

            {s.from && s.to && (
              <View style={styles.deltaRow}>
                <BText variant="bodySemi" size={20} color={Brut.muted} style={styles.strike}>
                  {formatValue(s.from.value, s.from.unit)}
                </BText>
                <BText variant="monoBold" size={14}>
                  →
                </BText>
                <BText variant="display" size={48}>
                  {formatValue(Math.round(shownTo * 100) / 100, s.to.unit)}
                </BText>
                {pct !== null && pct !== 0 && (
                  <View style={{ marginLeft: 'auto' }}>
                    <BTag
                      bg={Brut.accent}
                    >{`${pct > 0 ? '+' : ''}${String(pct).replace('.', ',')}%`}</BTag>
                  </View>
                )}
              </View>
            )}
            {replacement && target && (
              <View style={styles.swap}>
                <BText size={15} color={Brut.muted} style={styles.strike}>
                  {target.name}
                </BText>
                <BText variant="display" size={28}>
                  → {replacement.name.toUpperCase()}
                </BText>
              </View>
            )}
            {!replacement && s.kind === 'new_movement' && target && (
              <BText size={14} color={Brut.muted} style={{ marginTop: Spacing.sm }}>
                {target.cue}
              </BText>
            )}

            <BText size={14} style={{ marginTop: Spacing.md }}>
              {s.rationale}
            </BText>

            <Pressable
              onPress={() => setShowWhy((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.whyBtn}
            >
              <BText variant="monoBold" size={10}>
                {showWhy ? '− OCULTAR DATOS' : '+ ¿EN QUÉ ME BASO?'}
              </BText>
            </Pressable>
            {showWhy && (
              <Animated.View entering={FadeIn.duration(180)} style={styles.evidence}>
                {s.evidence.map((e, i) => (
                  <View key={e} style={[styles.evidenceRow, i > 0 && styles.rule]}>
                    <BText variant="mono" size={11}>
                      {e}
                    </BText>
                  </View>
                ))}
              </Animated.View>
            )}

            {adjusting && s.to && custom !== null ? (
              <View style={styles.actions}>
                <Stepper
                  value={custom}
                  unit={s.to.unit}
                  onChange={(v) => {
                    feedback.tick();
                    setCustom(v);
                  }}
                />
                <BPress
                  bg={Brut.accent}
                  radius={12}
                  style={{ flex: 1 }}
                  contentStyle={styles.action}
                  onPress={() => {
                    feedback.success();
                    onResolve(s.id, 'adjusted', patchFor(s, custom));
                  }}
                  accessibilityRole="button"
                >
                  <BText variant="bodyBold" size={15}>
                    Guardar
                  </BText>
                </BPress>
              </View>
            ) : (
              <>
                <View style={styles.actions}>
                  <BPress
                    bg={Brut.accent}
                    radius={12}
                    style={{ flex: 1 }}
                    contentStyle={styles.action}
                    onPress={() => {
                      feedback.success();
                      onResolve(s.id, 'accepted');
                    }}
                    accessibilityRole="button"
                  >
                    <BText variant="bodyBold" size={15}>
                      Lo pruebo
                    </BText>
                  </BPress>
                  {s.to && (
                    <BPress
                      radius={12}
                      style={{ flex: 1 }}
                      contentStyle={styles.action}
                      onPress={() => setAdjusting(true)}
                      accessibilityRole="button"
                    >
                      <BText variant="bodyBold" size={15}>
                        Ajustar
                      </BText>
                    </BPress>
                  )}
                </View>
                <Pressable
                  onPress={() => {
                    feedback.light();
                    onResolve(s.id, 'dismissed');
                  }}
                  accessibilityRole="button"
                  style={styles.later}
                >
                  <BText variant="bodySemi" size={14} color={Brut.muted}>
                    Ahora no
                  </BText>
                </Pressable>
              </>
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
        <BText variant="bodyBold" size={20} upright>
          −
        </BText>
      </Pressable>
      <BText variant="display" size={20} style={styles.stepValue}>
        {formatValue(value, unit)}
      </BText>
      <Pressable
        style={styles.stepBtn}
        onPress={() => onChange(+(value + step).toFixed(2))}
        accessibilityLabel="Más"
      >
        <BText variant="bodyBold" size={20} upright>
          +
        </BText>
      </Pressable>
    </View>
  );
});

const SHADOW = Brut.shadow.md;

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    top: SHADOW,
    left: SHADOW,
    right: -SHADOW,
    bottom: -SHADOW,
    borderRadius: Brut.radius.xl,
  },
  card: {
    backgroundColor: Brut.surface,
    borderRadius: Brut.radius.xl,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    padding: Spacing.lg,
    marginRight: SHADOW,
    marginBottom: SHADOW,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sealed: { gap: 8 },
  bar: { height: 10, borderRadius: 4, backgroundColor: Brut.ink },
  hold: {
    marginTop: Spacing.md,
    height: 52,
    borderRadius: 14,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  holdFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brut.accent,
    transformOrigin: 'left',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  strike: { textDecorationLine: 'line-through' },
  swap: { marginTop: Spacing.sm, gap: 2 },
  whyBtn: { alignSelf: 'flex-start', marginTop: Spacing.md, paddingVertical: 4 },
  evidence: {
    marginTop: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Brut.ink,
    borderRadius: 10,
    backgroundColor: Brut.accentSoft,
  },
  evidenceRow: { paddingHorizontal: 10, paddingVertical: 7 },
  rule: { borderTopWidth: 1.5, borderTopColor: Brut.ink },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, alignItems: 'center' },
  action: { height: 48, alignItems: 'center', justifyContent: 'center' },
  later: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 2 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.surface,
  },
  stepBtn: { width: 44, height: 46, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 76, textAlign: 'center' },
  resolved: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Brut.radius.md,
    borderWidth: Brut.border,
    borderStyle: 'dashed',
    borderColor: Brut.ink,
    gap: Spacing.md,
  },
});

export default React.memo(UnlockCard);
