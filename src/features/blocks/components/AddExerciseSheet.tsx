import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
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

import type { Discipline, FieldDefinition, FieldType } from '../../../types/core';
import { DISCIPLINE_CONFIGS } from '../../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

interface AddExerciseSheetProps {
  visible: boolean;
  blockDiscipline: Discipline;
  onAdd: (opts: { name: string; discipline: Discipline; fields?: FieldDefinition[] }) => void;
  onClose: () => void;
}

const DISCIPLINE_LIST: Discipline[] = [
  'strength', 'running', 'calisthenics', 'mobility',
  'cycling', 'swimming', 'team_sport', 'general',
];

const FIELD_TYPE_LIST: FieldType[] = ['number', 'text', 'time'];

const TIMING_IN = { duration: 280, easing: Easing.out(Easing.cubic) };

let _customFieldIdCounter = 0;
function makeCustomFieldId(): string {
  _customFieldIdCounter += 1;
  return `cf_${Date.now().toString(36)}_${_customFieldIdCounter}`;
}

function cloneDefaultFields(discipline: Discipline): FieldDefinition[] {
  return DISCIPLINE_CONFIGS[discipline].defaultFields.map((f, i) => ({ ...f, order: i }));
}

export default function AddExerciseSheet({ visible, blockDiscipline, onAdd, onClose }: AddExerciseSheetProps) {
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<Discipline>(blockDiscipline);
  const [customFields, setCustomFields] = useState<FieldDefinition[]>(() => cloneDefaultFields(blockDiscipline));
  const [customizing, setCustomizing] = useState(false);

  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, TIMING_IN);
      translateY.value = withTiming(0, TIMING_IN);
    }
  }, [visible, backdropOpacity, translateY]);

  // When discipline changes, reset fields to that discipline's defaults.
  useEffect(() => {
    setCustomFields(cloneDefaultFields(discipline));
  }, [discipline]);

  const isDirty = useMemo(() => {
    const defaults = DISCIPLINE_CONFIGS[discipline].defaultFields;
    if (defaults.length !== customFields.length) return true;
    return customFields.some((f, i) => {
      const d = defaults[i];
      return !d || d.id !== f.id || d.name !== f.name || d.type !== f.type || (d.unit ?? null) !== (f.unit ?? null);
    });
  }, [customFields, discipline]);

  const dismissAndCall = (cb: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(400, { duration: 220, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(cb)();
    });
  };

  const resetState = () => {
    setName('');
    setDiscipline(blockDiscipline);
    setCustomFields(cloneDefaultFields(blockDiscipline));
    setCustomizing(false);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const normalized = customFields.map((f, i) => ({ ...f, order: i }));
    const opts = {
      name: name.trim(),
      discipline,
      fields: isDirty ? normalized : undefined,
    };
    resetState();
    dismissAndCall(() => { onAdd(opts); onClose(); });
  };

  const handleClose = () => {
    resetState();
    dismissAndCall(onClose);
  };

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // ===== Field editor handlers =====

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomFields((prev) => [
      ...prev,
      {
        id: makeCustomFieldId(),
        name: 'Nuevo campo',
        type: 'number',
        unit: null,
        isBase: false,
        isPrimary: false,
        order: prev.length,
      },
    ]);
  };

  const handleRenameField = (id: string, newName: string) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
  };

  const handleSetUnit = (id: string, unit: string) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, unit: unit.trim() || null } : f)));
  };

  const handleSetType = (id: string, type: FieldType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomFields((prev) => prev.map((f) => (f.id === id ? { ...f, type } : f)));
  };

  const confirmRemoveField = (id: string) => {
    const target = customFields.find((f) => f.id === id);
    if (!target) return;
    Alert.alert('Eliminar campo', `¿Eliminar "${target.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setCustomFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i })));
        },
      },
    ]);
  };

  const moveField = (id: string, direction: 'up' | 'down') => {
    setCustomFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((f, i) => ({ ...f, order: i }));
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.backdropOverlay, backdropAnimStyle]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Animated.View style={[styles.sheet, sheetAnimStyle]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
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
                  {DISCIPLINE_LIST.map((d) => {
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
                        <Text
                          style={[
                            styles.disciplineText,
                            selected && { color: config.color, fontWeight: Typography.weight.semibold },
                          ]}
                        >
                          {config.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Fields summary + customize toggle */}
              <View style={styles.fieldsHeader}>
                <Text style={styles.sectionLabel}>Columnas</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCustomizing((v) => !v);
                  }}
                  style={styles.customizeBtn}
                >
                  <Feather
                    name={customizing ? 'chevron-up' : 'sliders'}
                    size={13}
                    color={Colors.accent.primary}
                  />
                  <Text style={styles.customizeText}>
                    {customizing ? 'Listo' : 'Personalizar columnas'}
                  </Text>
                </Pressable>
              </View>

              {!customizing && (
                <View style={styles.fieldsPreview}>
                  <Text style={styles.fieldsValue}>
                    {customFields.length === 0
                      ? 'Sin columnas'
                      : customFields.map((f) => f.name + (f.unit ? ` (${f.unit})` : '')).join(', ')}
                  </Text>
                </View>
              )}

              {customizing && (
                <View style={styles.editor}>
                  {customFields.map((f, i) => (
                    <View key={f.id} style={styles.fieldRow}>
                      <View style={styles.fieldRowTop}>
                        <View style={styles.orderBtns}>
                          <Pressable
                            onPress={() => moveField(f.id, 'up')}
                            disabled={i === 0}
                            hitSlop={6}
                            style={[styles.orderBtn, i === 0 && styles.orderBtnDisabled]}
                          >
                            <Feather name="chevron-up" size={14} color={Colors.text.secondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => moveField(f.id, 'down')}
                            disabled={i === customFields.length - 1}
                            hitSlop={6}
                            style={[styles.orderBtn, i === customFields.length - 1 && styles.orderBtnDisabled]}
                          >
                            <Feather name="chevron-down" size={14} color={Colors.text.secondary} />
                          </Pressable>
                        </View>
                        <TextInput
                          style={styles.fieldNameInput}
                          value={f.name}
                          placeholder="Nombre"
                          placeholderTextColor={Colors.text.disabled}
                          onChangeText={(t) => handleRenameField(f.id, t)}
                          returnKeyType="done"
                        />
                        <TextInput
                          style={styles.fieldUnitInput}
                          value={f.unit ?? ''}
                          placeholder="Unidad"
                          placeholderTextColor={Colors.text.disabled}
                          onChangeText={(t) => handleSetUnit(f.id, t)}
                          returnKeyType="done"
                        />
                        <Pressable onPress={() => confirmRemoveField(f.id)} hitSlop={8} style={styles.removeBtn}>
                          <Feather name="trash-2" size={14} color={Colors.semantic.error} />
                        </Pressable>
                      </View>

                      <View style={styles.typeRow}>
                        {FIELD_TYPE_LIST.map((t) => {
                          const selected = f.type === t;
                          return (
                            <Pressable
                              key={t}
                              onPress={() => handleSetType(f.id, t)}
                              style={[styles.typeChip, selected && styles.typeChipSelected]}
                            >
                              <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                                {t}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}

                  <Pressable onPress={handleAddField} style={styles.addFieldBtn}>
                    <Feather name="plus" size={14} color={Colors.accent.primary} />
                    <Text style={styles.addFieldText}>Añadir campo</Text>
                  </Pressable>
                </View>
              )}

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
            </ScrollView>
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
    maxHeight: '90%',
    ...Shadows.modal,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'] + 20,
    paddingTop: Spacing.md,
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
  fieldsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.dim,
  },
  customizeText: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
  },
  fieldsPreview: {
    marginBottom: Spacing.xl,
  },
  fieldsValue: {
    fontSize: Typography.size.micro,
    color: Colors.text.secondary,
  },
  editor: {
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  fieldRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.elevated,
    gap: Spacing.xs,
  },
  fieldRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  orderBtns: {
    flexDirection: 'column',
  },
  orderBtn: {
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  orderBtnDisabled: {
    opacity: 0.3,
  },
  fieldNameInput: {
    flex: 1.3,
    fontSize: Typography.size.caption,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    backgroundColor: Colors.background.surface,
  },
  fieldUnitInput: {
    flex: 0.7,
    fontSize: Typography.size.caption,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    backgroundColor: Colors.background.surface,
  },
  removeBtn: {
    padding: Spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 22,
  },
  typeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.background.surface,
  },
  typeChipSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.dim,
  },
  typeChipText: {
    fontSize: 10,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  typeChipTextSelected: {
    color: Colors.accent.primary,
    fontWeight: Typography.weight.semibold,
  },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.dim,
  },
  addFieldText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
    color: Colors.accent.primary,
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
