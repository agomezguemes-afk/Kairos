// SetInput — the in-set numeric keypad. Field chips select which metric you're
// editing; the pad writes into it. Two intentional states:
//   • rest        → neutral elevated keys, ink text (calm, legible on white)
//   • input-active → the selected field lifts to a discipline-tinted chip with
//                    an accent border + accent value (context by colour, never
//                    gold — gold stays reserved for Kai)
// Was authored for the old dark chrome; the previous fills (~4–6% warm-white)
// and inverse (white) text washed out to near-invisible on the white canvas.
// Edit rules live in ./lib/numpad so they're unit-tested off-thread.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { FieldDefinition, FieldValue } from '../../types/core';
import { Colors, Type, Spacing, Radius } from '../../theme/tokens';
import { applyNumpadKey, toFieldValue, applyDelta } from './lib/numpad';

interface Props {
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
  onChange: (fieldId: string, value: FieldValue) => void;
  /**
   * Snapshot of the previous set's values. When it holds at least one matching
   * numeric field, a "Repetir anterior" affordance copies those values on tap.
   */
  previousValues?: Record<string, FieldValue>;
  /**
   * Long-press handler on numeric field chips. Receives the field definition and
   * the current numeric value (0 if unset). Parent decides what to do — e.g.
   * open the plate calculator on the weight chip.
   */
  onLongPressField?: (field: FieldDefinition, currentValue: number) => void;
  /**
   * Discipline accent (solid) for the input-active state — border + value colour
   * of the selected field. Defaults to ink so the component stays reusable and
   * never leaks gold.
   */
  accent?: string;
  /** Discipline tint (soft fill) for the selected field chip. Defaults to a
   *  neutral lifted surface. */
  tint?: string;
}

interface KeyDef {
  label: string;
  value: string;
  a11y: string;
}

const KEYS: KeyDef[] = [
  { label: '1', value: '1', a11y: 'Número 1' },
  { label: '2', value: '2', a11y: 'Número 2' },
  { label: '3', value: '3', a11y: 'Número 3' },
  { label: '4', value: '4', a11y: 'Número 4' },
  { label: '5', value: '5', a11y: 'Número 5' },
  { label: '6', value: '6', a11y: 'Número 6' },
  { label: '7', value: '7', a11y: 'Número 7' },
  { label: '8', value: '8', a11y: 'Número 8' },
  { label: '9', value: '9', a11y: 'Número 9' },
  { label: '.', value: '.', a11y: 'Punto decimal' },
  { label: '0', value: '0', a11y: 'Número 0' },
  { label: '⌫', value: 'back', a11y: 'Borrar' },
];

const HELPER_KEYS: { label: string; delta: number }[] = [
  { label: '+2.5', delta: 2.5 },
  { label: '+5', delta: 5 },
];

const PRIMARY_NUMERIC_TYPES = new Set(['number', 'time']);

export default function SetInput({
  fields,
  values,
  onChange,
  previousValues,
  onLongPressField,
  accent,
  tint,
}: Props) {
  const activeColor = accent ?? Colors.ink.primary;
  const activeFill = tint ?? Colors.bg.surface;

  const numericFields = useMemo(
    () => fields.filter((f) => PRIMARY_NUMERIC_TYPES.has(f.type)).sort((a, b) => a.order - b.order),
    [fields],
  );

  const [activeFieldId, setActiveFieldId] = useState<string>(
    () => numericFields[0]?.id ?? fields[0]?.id ?? '',
  );

  const tap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // Numeric fields that carry a usable previous value to copy. Hide the
  // affordance unless at least one intersects.
  const repeatableFieldIds = useMemo(() => {
    if (!previousValues) return [] as string[];
    const ids: string[] = [];
    for (const f of numericFields) {
      const v = previousValues[f.id];
      if (v != null && v !== '') ids.push(f.id);
    }
    return ids;
  }, [previousValues, numericFields]);

  const handleRepeat = useCallback(() => {
    if (!previousValues) return;
    Haptics.selectionAsync().catch(() => {});
    for (const id of repeatableFieldIds) {
      onChange(id, previousValues[id]);
    }
  }, [previousValues, repeatableFieldIds, onChange]);

  const handleKey = useCallback(
    (key: string) => {
      tap();
      if (!activeFieldId) return;
      const current = values[activeFieldId];
      const draft = current == null ? '' : String(current);
      const next = applyNumpadKey(draft, key);
      onChange(activeFieldId, toFieldValue(next));
    },
    [tap, activeFieldId, values, onChange],
  );

  const handleHelper = useCallback(
    (delta: number) => {
      tap();
      if (!activeFieldId) return;
      onChange(activeFieldId, applyDelta(values[activeFieldId], delta));
    },
    [tap, activeFieldId, values, onChange],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.fieldRow}>
        {fields.map((f) => {
          const isActive = f.id === activeFieldId;
          const v = values[f.id];
          const display = v == null || v === '' ? '—' : String(v);
          const spoken = v == null || v === '' ? 'vacío' : String(v);
          const isNumeric = PRIMARY_NUMERIC_TYPES.has(f.type);
          // Forward long-press only for numeric fields — parent decides whether
          // to act (e.g. open plate calc when the chip is `weight`).
          const longPress =
            isNumeric && onLongPressField
              ? () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  const n = typeof v === 'number' ? v : 0;
                  onLongPressField(f, n);
                }
              : undefined;
          return (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${f.name}${f.unit ? ` en ${f.unit}` : ''}, ${spoken}${
                isActive ? ', campo activo' : ''
              }`}
              accessibilityHint={
                longPress ? 'Mantén pulsado para la calculadora de discos' : undefined
              }
              onPress={() => {
                tap();
                setActiveFieldId(f.id);
              }}
              onLongPress={longPress}
              delayLongPress={longPress ? 350 : undefined}
              style={[
                styles.fieldChip,
                isActive && { backgroundColor: activeFill, borderColor: activeColor },
              ]}
            >
              <Text
                style={[styles.fieldLabel, isActive && { color: activeColor }]}
                maxFontSizeMultiplier={1.4}
                numberOfLines={1}
              >
                {f.name}
                {f.unit ? ` (${f.unit})` : ''}
              </Text>
              <Text
                style={[styles.fieldValue, isActive && { color: activeColor }]}
                maxFontSizeMultiplier={1.4}
                numberOfLines={1}
              >
                {display}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {repeatableFieldIds.length > 0 && (
        <Pressable
          onPress={handleRepeat}
          style={({ pressed }) => [styles.repeatBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Repetir valores del set anterior"
        >
          <Text style={styles.repeatText} maxFontSizeMultiplier={1.5}>
            ↺ Repetir anterior
          </Text>
        </Pressable>
      )}

      <View style={styles.helperRow}>
        {HELPER_KEYS.map((k) => (
          <Pressable
            key={k.label}
            onPress={() => handleHelper(k.delta)}
            accessibilityRole="button"
            accessibilityLabel={`Sumar ${k.label.replace('+', '')}`}
            style={({ pressed }) => [styles.helperKey, pressed && styles.keyPressed]}
          >
            <Text style={styles.helperKeyText} maxFontSizeMultiplier={1.4}>
              {k.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pad}>
        {KEYS.map((k) => {
          const isBack = k.value === 'back';
          return (
            <Pressable
              key={k.label}
              onPress={() => handleKey(k.value)}
              accessibilityRole="button"
              accessibilityLabel={k.a11y}
              style={({ pressed }) => [styles.padKey, pressed && styles.keyPressed]}
            >
              <Text
                style={[styles.padKeyText, isBack && styles.padKeyBack]}
                maxFontSizeMultiplier={1.3}
              >
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const KEY_GAP = Spacing.sm;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  // Rest state: a legible neutral chip on the white canvas.
  fieldChip: {
    flex: 1,
    minWidth: 72,
    minHeight: 44, // HIG tap target
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.elevated,
    gap: 2,
  },
  fieldLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldValue: {
    ...Type.numMedium,
    fontSize: 22,
    lineHeight: 26,
    color: Colors.ink.primary,
  },
  repeatBtn: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  repeatText: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    fontWeight: '600',
  },
  helperRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
  },
  helperKey: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperKeyText: {
    ...Type.numMedium,
    color: Colors.ink.secondary,
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: KEY_GAP,
  },
  padKey: {
    width: '31%',
    flexGrow: 1,
    minHeight: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pressed state: darken via the ink-overlay hairline so the key reads as held.
  keyPressed: {
    backgroundColor: Colors.hair.strong,
  },
  padKeyText: {
    ...Type.numLarge,
    fontSize: 22,
    lineHeight: 26,
    color: Colors.ink.primary,
  },
  padKeyBack: {
    color: Colors.ink.tertiary,
  },
});
