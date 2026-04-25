import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import FieldInput from './FieldInput';
import type { ExerciseSet, FieldDefinition, FieldValue } from '../../../types/core';
import { Colors, Typography, Spacing, Radius } from '../../../theme/index';
import { springs } from '../../../theme/animations';

interface SetRowProps {
  set: ExerciseSet;
  setIndex: number;
  fields: FieldDefinition[];
  onUpdateValue: (setIndex: number, fieldId: string, value: FieldValue) => void;
  onToggleComplete: (setIndex: number) => void;
  onRemove: (setIndex: number) => void;
  compact?: boolean;
}

function SetRowInner({ set, setIndex, fields, onUpdateValue, onToggleComplete, onRemove, compact }: SetRowProps) {
  const checkScale = useSharedValue(1);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handleToggle = useCallback(() => {
    checkScale.value = withSequence(
      withSpring(1.3, springs.pop),
      withSpring(1, springs.bouncy),
    );
    onToggleComplete(setIndex);
  }, [setIndex, onToggleComplete]);

  const handleFieldChange = useCallback((fieldId: string, value: FieldValue) => {
    onUpdateValue(setIndex, fieldId, value);
  }, [setIndex, onUpdateValue]);

  const maxFields = compact ? 2 : 4;
  const visibleFields = fields
    .filter(f => f.type !== 'boolean' || f.isPrimary)
    .sort((a, b) => a.order - b.order)
    .slice(0, maxFields);

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      style={[styles.row, compact && styles.rowCompact, set.completed && styles.rowCompleted]}
    >
      {/* Set number */}
      <Text style={[styles.setNumber, compact && styles.setNumberCompact, set.completed && styles.setNumberCompleted]}>
        {setIndex + 1}
      </Text>

      {/* Field inputs */}
      <View style={[styles.fieldsRow, compact && styles.fieldsRowCompact]}>
        {visibleFields.map(field => (
          <View key={field.id} style={styles.fieldCell}>
            <FieldInput
              field={field}
              value={set.values[field.id]}
              onChange={handleFieldChange}
              isCompleted={set.completed}
            />
          </View>
        ))}
      </View>

      {/* Check button */}
      <Pressable onPress={handleToggle} hitSlop={8} style={[styles.checkBtn, compact && styles.checkBtnCompact]}>
        <Animated.View style={checkStyle}>
          <View style={[styles.checkbox, compact && styles.checkboxCompact, set.completed && styles.checkboxDone]}>
            {set.completed && <Feather name="check" size={compact ? 10 : 14} color={Colors.text.inverse} />}
          </View>
        </Animated.View>
      </Pressable>

      {/* Delete */}
      {!compact && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRemove(setIndex);
          }}
          hitSlop={8}
          style={styles.deleteBtn}
        >
          <Feather name="x" size={14} color={Colors.text.disabled} />
        </Pressable>
      )}
    </Animated.View>
  );
}

export default React.memo(SetRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: Radius.sm,
  },
  rowCompleted: {
    backgroundColor: Colors.semantic.successMuted,
  },
  setNumber: {
    width: 28,
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  setNumberCompleted: {
    color: Colors.semantic.success,
  },
  fieldsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  fieldCell: {
    flex: 1,
  },
  checkBtn: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.semantic.success,
    borderColor: Colors.semantic.success,
  },
  deleteBtn: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    gap: Spacing.xs,
  },
  setNumberCompact: {
    width: 18,
    fontSize: 10,
  },
  fieldsRowCompact: {
    gap: 2,
  },
  checkBtnCompact: {
    width: 26,
  },
  checkboxCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
