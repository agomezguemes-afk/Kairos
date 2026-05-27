// PlateCalculator — bottom-sheet plate solver with SVG barbell visualization.
// Triggered by long-press on the weight cell of the active set.
// Token-only, no hex literals (with one exception: real-world plate color
// codes per IPF convention, scoped to this component — see PLATE_COLOR).

import React, { useMemo, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import Svg, { Rect, G, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../theme/tokens';
import { solvePlates, DEFAULT_KG_PLATES, formatPlateList, type PlateSolution } from './lib/plates';

interface Props {
  visible: boolean;
  /** Initial target weight (kg). */
  initialTarget: number;
  /** Initial bar weight (kg). Default 20 (Olympic). */
  initialBar?: number;
  /** Called when the user confirms a target. The active set's weight field is updated upstream. */
  onConfirm: (target: number) => void;
  onClose: () => void;
}

const BAR_OPTIONS = [
  { label: '20 kg', value: 20 },
  { label: '15 kg', value: 15 },
  { label: '10 kg', value: 10 },
  { label: '7 kg', value: 7 }, // training bar
];

const STEPPER_DELTAS = [2.5, 5, 10];

const SCREEN_W = Dimensions.get('window').width;
const SVG_HEIGHT = 140;

// Color per plate size (IPF-like convention, calmed). Scoped to this
// component because these represent real-world barbell color codes, not
// the brand's visual identity — they don't belong in tokens.ts.
const PLATE_COLOR: Record<number, string> = {
  25: '#C9302C', // red
  20: '#1F6FB5', // blue
  15: '#EBA833', // yellow
  10: '#3A9B47', // green
  5: '#F5F5F5',
  2.5: '#D4D4D4',
  1.25: '#9B9B9B',
  0.5: '#636363',
};

export default function PlateCalculator({
  visible,
  initialTarget,
  initialBar = 20,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [target, setTarget] = useState<number>(roundTo(initialTarget, 0.5));
  const [bar, setBar] = useState<number>(initialBar);

  // Reset on each open
  React.useEffect(() => {
    if (visible) {
      setTarget(roundTo(initialTarget, 0.5));
      setBar(initialBar);
    }
  }, [visible, initialTarget, initialBar]);

  const solution: PlateSolution = useMemo(
    () => solvePlates({ target, bar, inventory: DEFAULT_KG_PLATES }),
    [target, bar],
  );

  const bump = useCallback((delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setTarget((t) => Math.max(0, roundTo(t + delta, 0.5)));
  }, []);

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm(roundTo(target, 0.5));
    onClose();
  }, [target, onConfirm, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Calculadora de discos</Text>
          <Text style={styles.subtitle}>Mantén pulsado el peso para ajustar.</Text>

          {/* SVG barbell visualization */}
          <View style={styles.svgWrap}>
            <BarbellSvg solution={solution} bar={bar} />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Stat label="Por lado" value={`${stripZero(solution.perSideKg)} kg`} />
            <Stat label="Total" value={`${stripZero(solution.totalKg)} kg`} />
            <Stat label="Barra" value={`${bar} kg`} />
          </View>

          {/* Warning */}
          {solution.warning === 'odd-target' && (
            <Text style={styles.warning}>
              Falta {stripZero(solution.shortBy)} kg para llegar al objetivo con los discos
              disponibles.
            </Text>
          )}
          {solution.warning === 'below-bar' && (
            <Text style={styles.warning}>El objetivo es menor que la barra.</Text>
          )}

          {/* Plate list */}
          <Text style={styles.plateList}>{formatPlateList(solution.plates)}</Text>

          {/* Target controls */}
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>OBJETIVO</Text>
            <Text style={styles.targetValue}>{stripZero(target)} kg</Text>
          </View>
          <View style={styles.stepperRow}>
            {STEPPER_DELTAS.map((d) => (
              <StepperButton key={`down-${d}`} label={`−${d}`} onPress={() => bump(-d)} />
            ))}
            {STEPPER_DELTAS.map((d) => (
              <StepperButton key={`up-${d}`} label={`+${d}`} onPress={() => bump(d)} />
            ))}
          </View>

          {/* Bar selector */}
          <Text style={styles.sectionLabel}>BARRA</Text>
          <View style={styles.barRow}>
            {BAR_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setBar(opt.value);
                }}
                style={({ pressed }) => [
                  styles.barPill,
                  bar === opt.value && styles.barPillActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.barPillText, bar === opt.value && styles.barPillTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Confirm */}
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>Aplicar {stripZero(target)} kg</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── SVG barbell ─────────────────────────────────────────────────────────

function BarbellSvg({ solution, bar: _bar }: { solution: PlateSolution; bar: number }) {
  const w = SCREEN_W - Spacing.screen.horizontal * 2;
  const h = SVG_HEIGHT;

  // Layout: bar runs full width, plates load symmetric from center sleeve outward.
  const cx = w / 2;
  const sleeveLen = 36; // pixels from center to inside of plate stack
  const plateMaxH = h * 0.85;
  const plateMinH = h * 0.35;

  // Plate height scales with weight: larger plate = taller render.
  const allSizes = solution.plates.map((p) => p.size);
  const maxSize = Math.max(...allSizes, 25);

  const PLATE_WIDTH = 16; // px each
  const PLATE_GAP = 2;

  // Generate plate descriptors for ONE side, ordered largest → smallest from sleeve outward.
  const plateOrder = solution.plates.flatMap((p) => Array.from({ length: p.count }, () => p));

  let runningX = sleeveLen;
  const rightPlates = plateOrder.map((p, idx) => {
    const heightRatio = plateMinH + (p.size / maxSize) * (plateMaxH - plateMinH);
    const xOffset = runningX;
    runningX += PLATE_WIDTH + PLATE_GAP;
    return { p, idx, xOffset, heightRatio };
  });

  return (
    <Svg width={w} height={h}>
      {/* Bar shaft — runs full width */}
      <Rect x={0} y={h / 2 - 4} width={w} height={8} rx={2} fill={Colors.ink.tertiary} />
      {/* Center collar (visual anchor) */}
      <Rect x={cx - 14} y={h / 2 - 14} width={28} height={28} rx={3} fill={Colors.ink.secondary} />

      {/* Right-side plates */}
      <G>
        {rightPlates.map(({ p, idx, xOffset, heightRatio }) => {
          const color = PLATE_COLOR[p.size] ?? Colors.ink.tertiary;
          const px = cx + xOffset;
          return (
            <Rect
              key={`r-${idx}`}
              x={px}
              y={h / 2 - heightRatio / 2}
              width={PLATE_WIDTH}
              height={heightRatio}
              rx={3}
              fill={color}
              stroke={Colors.hair.strong}
              strokeWidth={0.75}
            />
          );
        })}
      </G>

      {/* Left-side plates (mirror) */}
      <G>
        {rightPlates.map(({ p, idx, xOffset, heightRatio }) => {
          const color = PLATE_COLOR[p.size] ?? Colors.ink.tertiary;
          const px = cx - xOffset - PLATE_WIDTH;
          return (
            <Rect
              key={`l-${idx}`}
              x={px}
              y={h / 2 - heightRatio / 2}
              width={PLATE_WIDTH}
              height={heightRatio}
              rx={3}
              fill={color}
              stroke={Colors.hair.strong}
              strokeWidth={0.75}
            />
          );
        })}
      </G>

      {/* Empty bar hint — dashed centerline guide when no plates loaded */}
      {plateOrder.length === 0 && (
        <Line
          x1={cx - sleeveLen * 2}
          y1={h / 2}
          x2={cx + sleeveLen * 2}
          y2={h / 2}
          stroke={Colors.hair.strong}
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}
    </Svg>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stepperBtn, pressed && { opacity: 0.75 }]}
    >
      <Text style={styles.stepperBtnText}>{label}</Text>
    </Pressable>
  );
}

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function stripZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  title: { ...Type.titleSmall, color: Colors.ink.primary },
  subtitle: { ...Type.caption, color: Colors.ink.tertiary, marginTop: 2, marginBottom: Spacing.lg },

  svgWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statValue: { ...Type.bodyEmph, color: Colors.ink.primary, fontSize: 18 },
  statLabel: { ...Type.micro, color: Colors.ink.tertiary, marginTop: 2 },

  warning: {
    ...Type.caption,
    color: Colors.semantic.warning,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },

  plateList: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing.md,
  },
  targetLabel: { ...Type.micro, color: Colors.ink.tertiary, letterSpacing: 1.2 },
  targetValue: { ...Type.titleSmall, fontSize: 28, color: Colors.ink.primary },

  stepperRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stepperBtn: {
    flex: 1,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  stepperBtnText: { ...Type.bodyEmph, color: Colors.ink.primary },

  sectionLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  barRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.lg },
  barPill: {
    flex: 1,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    paddingVertical: 8,
    alignItems: 'center',
  },
  barPillActive: { backgroundColor: Colors.gold.glow },
  barPillText: { ...Type.caption, color: Colors.ink.secondary },
  barPillTextActive: { color: Colors.gold.deep, fontWeight: '600' },

  cta: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  ctaText: { ...Type.bodyEmph, color: Colors.ink.inverse },
});
