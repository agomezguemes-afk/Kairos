// SetActionSheet — long-press menu on a set row to annotate the set:
// kind (working / warmup / drop / failure), RPE 1..10, and a freeform note.
// Same Modal + Reanimated pattern as PlateCalculator; token-only.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../theme/tokens';
import { useWorkoutStore } from '../../store/workoutStore';
import type { SetKind } from '../../types/core';

interface Props {
  visible: boolean;
  exerciseId: string;
  setId: string;
  onClose: () => void;
}

const KIND_OPTIONS: { value: SetKind; label: string }[] = [
  { value: 'working', label: 'Normal' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Fallo' },
];

const RPE_VALUES: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const RPE_HINTS: Record<number, string> = {
  10: 'RPE 10 — esfuerzo máximo, no más reps',
  9: 'RPE 9 — me quedó 1 rep',
  8: 'RPE 8 — me quedaron 2 reps',
  7: 'RPE 7 — me quedaron 3 reps',
  6: 'RPE 6 — me quedaron 4 reps',
  5: 'RPE 5 — esfuerzo medio',
  4: 'RPE 4 — fácil',
  3: 'RPE 3 — muy fácil',
  2: 'RPE 2 — calentamiento ligero',
  1: 'RPE 1 — apenas esfuerzo',
};

const NOTE_MAX = 200;

function stripZero(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}

export default function SetActionSheet({ visible, exerciseId, setId, onClose }: Props) {
  const insets = useSafeAreaInsets();

  // Subscribe to the specific set so kind/rpe toggles are reflected immediately.
  // .find() is fine here — same reference unless the underlying set mutated.
  const set = useWorkoutStore(
    (s) =>
      s.activeWorkout?.exercises
        .find((e) => e.id === exerciseId)
        ?.sets.find((x) => x.id === setId) ?? null,
  );

  const updateSetMetadata = useWorkoutStore((s) => s.updateSetMetadata);

  const [noteDraft, setNoteDraft] = useState<string>('');

  // Reset note draft whenever a different set opens, or when reopening the
  // same set after a remote update (e.g., another action sheet edit).
  useEffect(() => {
    if (!visible) return;
    setNoteDraft(set?.notes ?? '');
  }, [visible, setId, set?.notes]);

  const kind: SetKind = set?.kind ?? 'working';
  const rpe = set?.rpe;

  const setOrderLabel = useMemo(() => {
    if (!set) return 'Set';
    return `Set ${set.order + 1}`;
  }, [set]);

  // Sober one-liner under the title — completed weight × reps, or "Pendiente".
  const subtitle = useMemo(() => {
    if (!set) return 'Pendiente';
    if (!set.completed) return 'Pendiente';
    const w = typeof set.values['weight'] === 'number' ? (set.values['weight'] as number) : null;
    const r = typeof set.values['reps'] === 'number' ? (set.values['reps'] as number) : null;
    const parts: string[] = [];
    if (w != null) parts.push(`${stripZero(w)} kg`);
    if (r != null) parts.push(`× ${r}`);
    return parts.length > 0 ? parts.join(' ') : 'Completado';
  }, [set]);

  const handleKind = useCallback(
    (next: SetKind) => {
      Haptics.selectionAsync().catch(() => {});
      // Toggle: tapping the active kind reverts to 'working'.
      const value: SetKind = kind === next ? 'working' : next;
      updateSetMetadata(exerciseId, setId, { kind: value });
    },
    [kind, exerciseId, setId, updateSetMetadata],
  );

  const handleRpe = useCallback(
    (next: number) => {
      Haptics.selectionAsync().catch(() => {});
      // Toggle: tapping the active RPE clears it.
      if (rpe === next) {
        updateSetMetadata(exerciseId, setId, { rpe: null });
      } else {
        updateSetMetadata(exerciseId, setId, { rpe: next });
      }
    },
    [rpe, exerciseId, setId, updateSetMetadata],
  );

  const handleClearRpe = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    updateSetMetadata(exerciseId, setId, { rpe: null });
  }, [exerciseId, setId, updateSetMetadata]);

  // Persist note on blur and on close so the user never loses a draft they
  // typed but didn't explicitly save.
  const flushNote = useCallback(() => {
    if (!set) return;
    const next = noteDraft.length > 0 ? noteDraft : null;
    if ((set.notes ?? null) === next) return;
    updateSetMetadata(exerciseId, setId, { notes: next });
  }, [set, noteDraft, exerciseId, setId, updateSetMetadata]);

  const handleClose = useCallback(() => {
    flushNote();
    onClose();
  }, [flushNote, onClose]);

  const rpeHint = rpe != null ? RPE_HINTS[rpe] : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />

          {/* Header */}
          <Text style={styles.title}>{setOrderLabel}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {/* Section 1 — Tipo de set */}
            <Text style={styles.sectionLabel}>TIPO DE SET</Text>
            <View style={styles.kindRow}>
              {KIND_OPTIONS.map((opt) => {
                const active = kind === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleKind(opt.value)}
                    style={({ pressed }) => [
                      styles.kindPill,
                      active && styles.kindPillActive,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Tipo ${opt.label}`}
                  >
                    <Text style={[styles.kindPillText, active && styles.kindPillTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Section 2 — RPE */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>RPE</Text>
              {rpe != null ? (
                <Pressable onPress={handleClearRpe} hitSlop={6}>
                  <Text style={styles.clearLink}>Quitar RPE</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rpeRow}
            >
              {RPE_VALUES.map((value) => {
                const active = rpe === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => handleRpe(value)}
                    style={({ pressed }) => [
                      styles.rpePill,
                      active && styles.rpePillActive,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`RPE ${value}`}
                  >
                    <Text style={[styles.rpePillText, active && styles.rpePillTextActive]}>
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {rpeHint ? <Text style={styles.rpeHint}>{rpeHint}</Text> : null}

            {/* Section 3 — Nota */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>NOTA</Text>
            <View style={styles.noteWrap}>
              <TextInput
                value={noteDraft}
                onChangeText={(t) => setNoteDraft(t.slice(0, NOTE_MAX))}
                onBlur={flushNote}
                placeholder="Nota del set (opcional)"
                placeholderTextColor={Colors.ink.muted}
                multiline
                style={styles.noteInput}
                maxLength={NOTE_MAX}
              />
              <Text style={styles.noteCount}>
                {noteDraft.length}/{NOTE_MAX}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom CTA */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="Listo"
          >
            <Text style={styles.ctaText}>Listo</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.paper.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
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
  title: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  subtitle: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  body: {
    paddingBottom: Spacing.md,
  },
  sectionLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  sectionLabelSpaced: {
    marginTop: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing.lg,
  },
  clearLink: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
  },

  // Kind segmented row — 4 pills full width.
  kindRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  kindPill: {
    flex: 1,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  kindPillActive: {
    backgroundColor: Colors.gold.glow,
  },
  kindPillText: {
    ...Type.caption,
    color: Colors.ink.secondary,
  },
  kindPillTextActive: {
    color: Colors.gold.deep,
    fontWeight: '600',
  },

  // RPE pills scroll horizontally.
  rpeRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  rpePill: {
    minWidth: 40,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpePillActive: {
    backgroundColor: Colors.gold.base,
  },
  rpePillText: {
    ...Type.bodyEmph,
    color: Colors.ink.secondary,
    fontVariant: ['tabular-nums'],
  },
  rpePillTextActive: {
    color: Colors.ink.inverse,
  },
  rpeHint: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: Spacing.xs,
  },

  // Note input — multiline with live char count anchored bottom-right.
  noteWrap: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  noteInput: {
    ...Type.body,
    color: Colors.ink.primary,
    minHeight: 64,
    textAlignVertical: 'top',
    padding: 0,
  },
  noteCount: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },

  // CTA — gold solid full width.
  cta: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  ctaText: {
    ...Type.bodyEmph,
    color: Colors.ink.inverse,
  },
});
