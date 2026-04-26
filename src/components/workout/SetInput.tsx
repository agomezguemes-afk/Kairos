import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { FieldDefinition, FieldValue } from '../../types/core';
import { Colors } from '../../theme/tokens';

interface Props {
  fields: FieldDefinition[];
  values: Record<string, FieldValue>;
  onChange: (fieldId: string, value: FieldValue) => void;
}

const KEYS: { label: string; value: string }[] = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '.', value: '.' },
  { label: '0', value: '0' },
  { label: '⌫', value: 'back' },
];

const HELPER_KEYS: { label: string; delta: number }[] = [
  { label: '+2.5', delta: 2.5 },
  { label: '+5', delta: 5 },
];

const PRIMARY_NUMERIC_TYPES = new Set(['number', 'time']);

export default function SetInput({ fields, values, onChange }: Props) {
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

  const handleKey = useCallback(
    (key: string) => {
      tap();
      if (!activeFieldId) return;
      const current = values[activeFieldId];
      const draft = current == null ? '' : String(current);
      let next = draft;
      if (key === 'back') {
        next = draft.slice(0, -1);
      } else if (key === '.') {
        if (!draft.includes('.')) next = draft + '.';
      } else {
        next = draft + key;
      }
      const num = parseFloat(next);
      onChange(activeFieldId, next === '' ? null : isNaN(num) ? next : num);
    },
    [tap, activeFieldId, values, onChange],
  );

  const handleHelper = useCallback(
    (delta: number) => {
      tap();
      if (!activeFieldId) return;
      const current = values[activeFieldId];
      const base = typeof current === 'number' ? current : 0;
      onChange(activeFieldId, base + delta);
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
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                tap();
                setActiveFieldId(f.id);
              }}
              style={[styles.fieldChip, isActive && styles.fieldChipActive]}
            >
              <Text style={styles.fieldLabel}>
                {f.name}{f.unit ? ` (${f.unit})` : ''}
              </Text>
              <Text style={[styles.fieldValue, isActive && styles.fieldValueActive]}>
                {display}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.helperRow}>
        {HELPER_KEYS.map((k) => (
          <Pressable key={k.label} onPress={() => handleHelper(k.delta)} style={styles.helperKey}>
            <Text style={styles.helperKeyText}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Pressable key={k.label} onPress={() => handleKey(k.value)} style={styles.padKey}>
            <Text style={styles.padKeyText}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const KEY_GAP = 8;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  fieldChip: {
    flex: 1,
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.16)',
    backgroundColor: 'rgba(245,240,232,0.04)',
    gap: 2,
  },
  fieldChipActive: {
    borderColor: Colors.gold[500],
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(245,240,232,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldValue: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text_v2.primary.dark,
    fontVariant: ['tabular-nums'],
  },
  fieldValueActive: {
    color: Colors.gold[500],
  },
  helperRow: {
    flexDirection: 'row',
    gap: KEY_GAP,
  },
  helperKey: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.18)',
    alignItems: 'center',
  },
  helperKeyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold[300],
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
    borderRadius: 14,
    backgroundColor: 'rgba(245,240,232,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text_v2.primary.dark,
  },
});
