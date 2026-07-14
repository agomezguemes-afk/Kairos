// SetCorrectionSheet — the "corregir es secundario pero inmediato" layer
// (spec §3). Opens from a tap on the giant target; hosts the EXISTING SetInput
// numpad untouched, plus the set metadata (tipo / RPE / nota) that left the
// main scoreboard. Same Modal + Reanimated sheet pattern as SetActionSheet —
// @gorhom/bottom-sheet isn't installed and adding it needs a native rebuild.
//
// Edits flow through the parent's draftValues (onChange) so closing the sheet
// and pressing HECHO commits exactly what the user saw. Metadata writes go
// straight to the store (updateSetMetadata), mirroring SetActionSheet.

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import SetInput from './SetInput';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import { useWorkoutStore } from '../../store/workoutStore';
import type { FieldDefinition, FieldValue, SetKind } from '../../types/core';

interface Props {
  visible: boolean;
  exerciseId: string;
  setId: string;
  setIndex: number;
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
  onChange: (fieldId: string, value: FieldValue) => void;
  previousValues?: Record<string, FieldValue>;
  onLongPressField?: (field: FieldDefinition, currentValue: number) => void;
  accent: string;
  tint: string;
  onClose: () => void;
  /**
   * Nested modal slot (PlateCalculator). iOS can't present two sibling RN
   * Modals at once — nesting the inner Modal inside this one is the pattern
   * that works.
   */
  children?: React.ReactNode;
}

const KIND_OPTIONS: { value: SetKind; label: string }[] = [
  { value: 'working', label: 'Normal' },
  { value: 'warmup', label: 'Warmup' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Fallo' },
];

const RPE_VALUES: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const NOTE_MAX = 200;

function SetCorrectionSheetImpl({
  visible,
  exerciseId,
  setId,
  setIndex,
  fields,
  values,
  onChange,
  previousValues,
  onLongPressField,
  accent,
  tint,
  onClose,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const set = useWorkoutStore(
    (s) =>
      s.activeWorkout?.exercises
        .find((e) => e.id === exerciseId)
        ?.sets.find((x) => x.id === setId) ?? null,
  );
  const updateSetMetadata = useWorkoutStore((s) => s.updateSetMetadata);

  // Per-open UI state, keyed by the target set instead of synced via effect:
  // when the key doesn't match (fresh open / different set) the derived values
  // fall back to defaults, so no reset effect is needed.
  const [ui, setUi] = useState<{ key: string | null; note: string; showMeta: boolean }>({
    key: null,
    note: '',
    showMeta: false,
  });
  const isCurrentUi = visible && ui.key === setId;
  const noteDraft = isCurrentUi ? ui.note : (set?.notes ?? '');
  const showMeta = isCurrentUi ? ui.showMeta : false;

  const setNoteDraft = useCallback(
    (text: string) => {
      setUi((prev) => ({
        key: setId,
        note: text,
        showMeta: prev.key === setId ? prev.showMeta : false,
      }));
    },
    [setId],
  );

  const kind: SetKind = set?.kind ?? 'working';
  const rpe = set?.rpe;

  const handleKind = useCallback(
    (next: SetKind) => {
      Haptics.selectionAsync().catch(() => {});
      updateSetMetadata(exerciseId, setId, { kind: kind === next ? 'working' : next });
    },
    [kind, exerciseId, setId, updateSetMetadata],
  );

  const handleRpe = useCallback(
    (next: number) => {
      Haptics.selectionAsync().catch(() => {});
      updateSetMetadata(exerciseId, setId, { rpe: rpe === next ? null : next });
    },
    [rpe, exerciseId, setId, updateSetMetadata],
  );

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

  const toggleMeta = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setUi((prev) => ({ ...prev, showMeta: !prev.showMeta }));
  }, []);

  const metaSummary =
    (kind !== 'working' ? 1 : 0) + (rpe != null ? 1 : 0) + (noteDraft.length > 0 ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar ajuste del set"
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            entering={
              reduceMotion
                ? FadeIn.duration(200)
                : SlideInDown.duration(280).easing(Easing.out(Easing.cubic))
            }
            exiting={
              reduceMotion
                ? FadeOut.duration(160)
                : SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))
            }
            style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>Ajustar set {setIndex + 1}</Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              {/* The numpad, exactly as it exists — field chips + keys. */}
              <SetInput
                fields={fields}
                values={values}
                onChange={onChange}
                previousValues={previousValues}
                onLongPressField={onLongPressField}
                accent={accent}
                tint={tint}
              />

              {/* Metadata lives one fold deeper — a quiet disclosure so the
                  sheet opens straight onto the numbers (the 90% case). */}
              <Pressable
                onPress={toggleMeta}
                accessibilityRole="button"
                accessibilityLabel={
                  showMeta ? 'Ocultar tipo, RPE y nota' : 'Mostrar tipo, RPE y nota'
                }
                accessibilityState={{ expanded: showMeta }}
                style={({ pressed }) => [styles.metaToggle, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.metaToggleText} maxFontSizeMultiplier={1.6}>
                  {showMeta ? 'Ocultar detalles' : 'Tipo · RPE · nota'}
                  {!showMeta && metaSummary > 0 ? `  (${metaSummary})` : ''}
                </Text>
              </Pressable>

              {showMeta ? (
                <View style={styles.metaBlock}>
                  <Text style={styles.sectionLabel}>Tipo de set</Text>
                  <View style={styles.kindRow}>
                    {KIND_OPTIONS.map((opt) => {
                      const active = kind === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => handleKind(opt.value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Tipo ${opt.label}`}
                          style={({ pressed }) => [
                            styles.kindPill,
                            active && styles.kindPillActive,
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <Text
                            style={[styles.kindPillText, active && styles.kindPillTextActive]}
                            maxFontSizeMultiplier={1.5}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>RPE</Text>
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
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`RPE ${value}`}
                          style={({ pressed }) => [
                            styles.rpePill,
                            active && styles.rpePillActive,
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <Text
                            style={[styles.rpePillText, active && styles.rpePillTextActive]}
                            maxFontSizeMultiplier={1.4}
                          >
                            {value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Nota</Text>
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
                      accessibilityLabel="Nota del set"
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Ink pill — Design v2 primary. Gold stays out of this sheet. */}
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Listo, volver al marcador"
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.ctaText} maxFontSizeMultiplier={1.4}>
                Listo
              </Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
      {children}
    </Modal>
  );
}

const SetCorrectionSheet = React.memo(SetCorrectionSheetImpl);
export default SetCorrectionSheet;

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.background.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    maxHeight: '88%',
    ...Shadows.modal,
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
    marginBottom: Spacing.sm,
  },
  body: {
    paddingBottom: Spacing.md,
  },
  metaToggle: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  metaToggleText: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
  metaBlock: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    ...Type.eyebrow,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.xs,
  },
  sectionLabelSpaced: {
    marginTop: Spacing.lg,
  },
  kindRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  kindPill: {
    flex: 1,
    minHeight: 44,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  kindPillActive: {
    backgroundColor: Colors.ink.primary,
  },
  kindPillText: {
    ...Type.caption,
    color: Colors.ink.secondary,
  },
  kindPillTextActive: {
    color: Colors.ink.inverse,
    fontWeight: '600',
  },
  rpeRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  rpePill: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpePillActive: {
    backgroundColor: Colors.ink.primary,
  },
  rpePillText: {
    ...Type.bodyEmph,
    color: Colors.ink.secondary,
    fontVariant: ['tabular-nums'],
  },
  rpePillTextActive: {
    color: Colors.ink.inverse,
  },
  noteWrap: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  noteInput: {
    ...Type.body,
    color: Colors.ink.primary,
    minHeight: 56,
    textAlignVertical: 'top',
    padding: 0,
  },
  cta: {
    minHeight: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
  },
});
