import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { Discipline } from '../../../types/core';
import { DISCIPLINE_CONFIGS } from '../../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface AddExerciseSheetProps {
  visible: boolean;
  blockDiscipline: Discipline;
  onAdd: (opts: { name: string; discipline: Discipline }) => void;
  onClose: () => void;
}

const DISCIPLINE_LIST: Discipline[] = [
  'strength', 'running', 'calisthenics', 'mobility',
  'cycling', 'swimming', 'team_sport', 'general',
];

const TIMING_IN = { duration: 280, easing: Easing.out(Easing.cubic) };

export default function AddExerciseSheet({ visible, blockDiscipline, onAdd, onClose }: AddExerciseSheetProps) {
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<Discipline>(blockDiscipline);
  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, TIMING_IN);
      translateY.value = withTiming(0, TIMING_IN);
    }
  }, [visible, backdropOpacity, translateY]);

  const dismissAndCall = (cb: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(400, { duration: 220, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(cb)();
    });
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const opts = { name: name.trim(), discipline };
    setName('');
    setDiscipline(blockDiscipline);
    dismissAndCall(() => { onAdd(opts); onClose(); });
  };

  const handleClose = () => {
    setName('');
    setDiscipline(blockDiscipline);
    dismissAndCall(onClose);
  };

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.backdropOverlay, backdropAnimStyle]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Animated.View style={[styles.sheet, sheetAnimStyle]}>
            <View style={styles.handle} />

            <Text style={styles.title}>Nuevo ejercicio</Text>

            {/* Name input */}
            <TextInput
              style={styles.nameInput}
              placeholder="Nombre del ejercicio"
              placeholderTextColor={Colors.text.disabled}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            {/* Discipline picker */}
            <Text style={styles.sectionLabel}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.disciplineScroll}>
              <View style={styles.disciplineRow}>
                {DISCIPLINE_LIST.map(d => {
                  const config = DISCIPLINE_CONFIGS[d];
                  const selected = d === discipline;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setDiscipline(d);
                      }}
                      style={[
                        styles.disciplineChip,
                        selected && { backgroundColor: config.color + '18', borderColor: config.color },
                      ]}
                    >
                      <Text style={[
                        styles.disciplineText,
                        selected && { color: config.color, fontWeight: Typography.weight.semibold },
                      ]}>
                        {config.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Fields preview */}
            <View style={styles.fieldsPreview}>
              <Text style={styles.fieldsLabel}>Campos: </Text>
              <Text style={styles.fieldsValue}>
                {DISCIPLINE_CONFIGS[discipline].defaultFields.map(f => f.name).join(', ')}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable onPress={handleClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                style={[styles.addBtn, !name.trim() && styles.addBtnDisabled]}
                disabled={!name.trim()}
              >
                <Feather name="plus" size={16} color={Colors.text.inverse} />
                <Text style={styles.addBtnText}>Crear</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  kav: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'] + 20,
    paddingTop: Spacing.md,
    ...Shadows.modal,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size.heading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
  },
  nameInput: {
    fontSize: Typography.size.subheading,
    color: Colors.text.primary,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border.light,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.tracking.caps,
    marginBottom: Spacing.md,
  },
  disciplineScroll: {
    marginBottom: Spacing.lg,
  },
  disciplineRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  disciplineChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.elevated,
  },
  disciplineText: {
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
  },
  fieldsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.xl,
  },
  fieldsLabel: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    fontWeight: Typography.weight.semibold,
  },
  fieldsValue: {
    fontSize: Typography.size.micro,
    color: Colors.text.secondary,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.background.elevated,
  },
  cancelText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.accent.primary,
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },
});
