import React, { useState, useCallback } from 'react';
import { TextInput, StyleSheet, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { FieldDefinition, FieldValue } from '../../../types/core';
import { Colors, Typography, Spacing, Radius } from '../../../theme/index';

interface FieldInputProps {
  field: FieldDefinition;
  value: FieldValue;
  onChange: (fieldId: string, value: FieldValue) => void;
  isCompleted: boolean;
}

function FieldInputInner({ field, value, onChange, isCompleted }: FieldInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = value != null ? String(value) : '';

  const handleStartEdit = useCallback(() => {
    if (field.type === 'boolean') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(field.id, !value);
      return;
    }
    setDraft(displayValue);
    setEditing(true);
  }, [field, value, displayValue, onChange]);

  const handleEndEdit = useCallback(() => {
    setEditing(false);
    if (field.type === 'number') {
      const num = parseFloat(draft);
      onChange(field.id, isNaN(num) ? null : num);
    } else {
      onChange(field.id, draft || null);
    }
  }, [field, draft, onChange]);

  if (field.type === 'boolean') {
    return (
      <Pressable onPress={handleStartEdit} style={styles.booleanContainer}>
        <View style={[styles.booleanBox, !!value && styles.booleanBoxChecked]}>
          {value && <Text style={styles.booleanCheck}>✓</Text>}
        </View>
      </Pressable>
    );
  }

  if (editing) {
    return (
      <TextInput
        style={[styles.input, isCompleted && styles.inputCompleted]}
        value={draft}
        onChangeText={setDraft}
        onBlur={handleEndEdit}
        onSubmitEditing={handleEndEdit}
        keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        placeholder="—"
        placeholderTextColor={Colors.text.disabled}
      />
    );
  }

  return (
    <Pressable onPress={handleStartEdit} style={[styles.valueContainer, isCompleted && styles.valueCompleted]}>
      <Text
        style={[styles.valueText, !displayValue && styles.valuePlaceholder, isCompleted && styles.valueTextCompleted]}
        numberOfLines={1}
      >
        {displayValue || '—'}
      </Text>
    </Pressable>
  );
}

export default React.memo(FieldInputInner);

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minWidth: 44,
    height: 32,
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.primary,
  },
  inputCompleted: {
    backgroundColor: Colors.semantic.successMuted,
  },
  valueContainer: {
    flex: 1,
    minWidth: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing.xs,
  },
  valueCompleted: {
    backgroundColor: Colors.semantic.successMuted,
  },
  valueText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.primary,
  },
  valueTextCompleted: {
    color: Colors.semantic.success,
  },
  valuePlaceholder: {
    color: Colors.text.disabled,
  },
  booleanContainer: {
    flex: 1,
    minWidth: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  booleanBox: {
    width: 22,
    height: 22,
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  booleanBoxChecked: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  booleanCheck: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: Typography.weight.bold,
  },
});
