import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView, TextInput,
  Dimensions, Platform, KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing, FadeIn,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import type { FieldDefinition, Discipline, FieldType } from '../../../types/core';
import { generateId, DISCIPLINE_CONFIGS } from '../../../types/core';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme/index';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.72;
const TIMING_IN = { duration: 300, easing: Easing.out(Easing.cubic) };
const TIMING_OUT = { duration: 220, easing: Easing.in(Easing.cubic) };

interface FieldCatalogEntry {
  id: string;
  name: string;
  type: FieldType;
  unit: string | null;
  icon: keyof typeof Feather.glyphMap;
  category: string;
  disciplines: Discipline[];
  step?: number;
  min?: number;
  max?: number;
}

const FIELD_CATALOG: FieldCatalogEntry[] = [
  { id: 'weight', name: 'Peso', type: 'number', unit: 'kg', icon: 'database', category: 'Fuerza', disciplines: ['strength', 'general'], step: 2.5 },
  { id: 'reps', name: 'Repeticiones', type: 'number', unit: null, icon: 'repeat', category: 'Fuerza', disciplines: ['strength', 'calisthenics', 'general'], step: 1, min: 1 },
  { id: 'rir', name: 'RIR', type: 'number', unit: null, icon: 'thermometer', category: 'Fuerza', disciplines: ['strength'], min: 0, max: 5, step: 1 },
  { id: 'distance', name: 'Distancia', type: 'number', unit: 'km', icon: 'map-pin', category: 'Cardio', disciplines: ['running', 'cycling', 'swimming'], step: 0.1 },
  { id: 'duration', name: 'Duración', type: 'number', unit: 'min', icon: 'clock', category: 'Cardio', disciplines: ['running', 'cycling', 'swimming', 'mobility', 'team_sport', 'general'], step: 1 },
  { id: 'pace', name: 'Ritmo', type: 'number', unit: 'min/km', icon: 'trending-up', category: 'Cardio', disciplines: ['running', 'cycling'], step: 0.05 },
  { id: 'heartRate', name: 'Frecuencia cardíaca', type: 'number', unit: 'bpm', icon: 'heart', category: 'Cardio', disciplines: ['running', 'cycling', 'swimming', 'team_sport'], step: 1 },
  { id: 'calories', name: 'Calorías', type: 'number', unit: 'kcal', icon: 'zap', category: 'General', disciplines: ['running', 'cycling', 'swimming', 'team_sport', 'general'], step: 10 },
  { id: 'perceivedEffort', name: 'Esfuerzo percibido', type: 'number', unit: '/10', icon: 'activity', category: 'General', disciplines: ['mobility', 'team_sport', 'general'], min: 1, max: 10 },
  { id: 'progression', name: 'Progresión', type: 'number', unit: null, icon: 'trending-up', category: 'Calistenia', disciplines: ['calisthenics'], min: 1, max: 10 },
  { id: 'rpe', name: 'RPE', type: 'number', unit: '/10', icon: 'bar-chart', category: 'Fuerza', disciplines: ['strength', 'calisthenics'], min: 1, max: 10, step: 0.5 },
  { id: 'tempo', name: 'Tempo', type: 'text', unit: null, icon: 'clock', category: 'Fuerza', disciplines: ['strength', 'calisthenics'] },
  { id: 'rest', name: 'Descanso', type: 'number', unit: 'seg', icon: 'pause-circle', category: 'General', disciplines: ['strength', 'calisthenics', 'general'], step: 5 },
  { id: 'notes', name: 'Notas', type: 'text', unit: null, icon: 'edit-3', category: 'General', disciplines: ['strength', 'running', 'calisthenics', 'mobility', 'cycling', 'swimming', 'team_sport', 'general'] },
];

interface FieldConfigSheetProps {
  visible: boolean;
  fields: FieldDefinition[];
  discipline: Discipline;
  onSave: (fields: FieldDefinition[]) => void;
  onClose: () => void;
}

export default function FieldConfigSheet({ visible, fields, discipline, onSave, onClose }: FieldConfigSheetProps) {
  const [localFields, setLocalFields] = useState<FieldDefinition[]>(fields);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customType, setCustomType] = useState<FieldType>('number');

  const translateY = useSharedValue(SHEET_H);
  const backdropOp = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      setLocalFields(fields);
      backdropOp.value = withTiming(1, TIMING_IN);
      translateY.value = withTiming(0, TIMING_IN);
    }
  }, [visible, fields, backdropOp, translateY]);

  const animateOut = useCallback((cb?: () => void) => {
    backdropOp.value = withTiming(0, TIMING_OUT);
    translateY.value = withTiming(SHEET_H, TIMING_OUT, () => {
      if (cb) runOnJS(cb)();
    });
  }, [backdropOp, translateY]);

  const handleClose = useCallback(() => animateOut(onClose), [animateOut, onClose]);

  const handleSave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave(localFields);
    animateOut(onClose);
  }, [localFields, onSave, animateOut, onClose]);

  const existingIds = useMemo(() => new Set(localFields.map(f => f.id)), [localFields]);

  const availableCatalog = useMemo(() =>
    FIELD_CATALOG.filter(f => !existingIds.has(f.id)),
  [existingIds]);

  const relevantCatalog = useMemo(() => {
    const relevant = availableCatalog.filter(f => f.disciplines.includes(discipline));
    const other = availableCatalog.filter(f => !f.disciplines.includes(discipline));
    return { relevant, other };
  }, [availableCatalog, discipline]);

  const addFieldFromCatalog = useCallback((entry: FieldCatalogEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newField: FieldDefinition = {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      unit: entry.unit,
      isBase: false,
      isPrimary: false,
      order: localFields.length,
      step: entry.step,
      min: entry.min,
      max: entry.max,
    };
    setLocalFields(prev => [...prev, newField]);
  }, [localFields]);

  const removeField = useCallback((fieldId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFields(prev => prev.filter(f => f.id !== fieldId).map((f, i) => ({ ...f, order: i })));
  }, []);

  const togglePrimary = useCallback((fieldId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFields(prev => prev.map(f => ({
      ...f,
      isPrimary: f.id === fieldId ? !f.isPrimary : f.isPrimary,
    })));
  }, []);

  const moveField = useCallback((fieldId: string, dir: 'up' | 'down') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalFields(prev => {
      const idx = prev.findIndex(f => f.id === fieldId);
      if (idx < 0) return prev;
      const newIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const addCustomField = useCallback(() => {
    if (!customName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = `custom_${generateId()}`;
    const newField: FieldDefinition = {
      id,
      name: customName.trim(),
      type: customType,
      unit: customUnit.trim() || null,
      isBase: false,
      isPrimary: false,
      order: localFields.length,
    };
    setLocalFields(prev => [...prev, newField]);
    setCustomName('');
    setCustomUnit('');
    setAddingCustom(false);
  }, [customName, customUnit, customType, localFields]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  if (!visible) return null;

  const disciplineName = DISCIPLINE_CONFIGS[discipline]?.name ?? discipline;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Columnas del ejercicio</Text>
                <Text style={styles.subtitle}>{disciplineName} · {localFields.length} campos</Text>
              </View>
              <Pressable onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionLabel}>CAMPOS ACTIVOS</Text>
              {localFields.map((field, idx) => (
                <Animated.View key={field.id} entering={FadeIn.duration(150)} style={styles.fieldRow}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldName}>{field.name}</Text>
                    {field.unit && <Text style={styles.fieldUnit}>{field.unit}</Text>}
                    {field.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Principal</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.fieldActions}>
                    <Pressable onPress={() => togglePrimary(field.id)} hitSlop={6} style={styles.fieldActionBtn}>
                      <Feather name="star" size={14} color={field.isPrimary ? Colors.accent.primary : Colors.text.disabled} />
                    </Pressable>
                    {idx > 0 && (
                      <Pressable onPress={() => moveField(field.id, 'up')} hitSlop={6} style={styles.fieldActionBtn}>
                        <Feather name="chevron-up" size={14} color={Colors.text.tertiary} />
                      </Pressable>
                    )}
                    {idx < localFields.length - 1 && (
                      <Pressable onPress={() => moveField(field.id, 'down')} hitSlop={6} style={styles.fieldActionBtn}>
                        <Feather name="chevron-down" size={14} color={Colors.text.tertiary} />
                      </Pressable>
                    )}
                    <Pressable onPress={() => removeField(field.id)} hitSlop={6} style={styles.fieldActionBtn}>
                      <Feather name="x" size={14} color={Colors.semantic.error} />
                    </Pressable>
                  </View>
                </Animated.View>
              ))}

              {relevantCatalog.relevant.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>RECOMENDADOS PARA {disciplineName.toUpperCase()}</Text>
                  <View style={styles.chipGrid}>
                    {relevantCatalog.relevant.map(entry => (
                      <Pressable
                        key={entry.id}
                        onPress={() => addFieldFromCatalog(entry)}
                        style={({ pressed }) => [styles.addChip, pressed && styles.addChipPressed]}
                      >
                        <Feather name={entry.icon} size={14} color={Colors.accent.primary} />
                        <Text style={styles.addChipText}>{entry.name}</Text>
                        {entry.unit && <Text style={styles.addChipUnit}>{entry.unit}</Text>}
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {relevantCatalog.other.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>OTROS CAMPOS</Text>
                  <View style={styles.chipGrid}>
                    {relevantCatalog.other.map(entry => (
                      <Pressable
                        key={entry.id}
                        onPress={() => addFieldFromCatalog(entry)}
                        style={({ pressed }) => [styles.addChip, styles.addChipOther, pressed && styles.addChipPressed]}
                      >
                        <Feather name={entry.icon} size={14} color={Colors.text.tertiary} />
                        <Text style={[styles.addChipText, { color: Colors.text.secondary }]}>{entry.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>CAMPO PERSONALIZADO</Text>
              {addingCustom ? (
                <View style={styles.customForm}>
                  <TextInput
                    style={styles.customInput}
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="Nombre del campo"
                    placeholderTextColor={Colors.text.disabled}
                    autoFocus
                    returnKeyType="next"
                  />
                  <View style={styles.customRow}>
                    <TextInput
                      style={[styles.customInput, { flex: 1 }]}
                      value={customUnit}
                      onChangeText={setCustomUnit}
                      placeholder="Unidad (opcional)"
                      placeholderTextColor={Colors.text.disabled}
                      returnKeyType="done"
                    />
                    <View style={styles.typeToggle}>
                      {(['number', 'text'] as FieldType[]).map(t => (
                        <Pressable
                          key={t}
                          onPress={() => setCustomType(t)}
                          style={[styles.typeBtn, customType === t && styles.typeBtnActive]}
                        >
                          <Text style={[styles.typeBtnText, customType === t && styles.typeBtnTextActive]}>
                            {t === 'number' ? '#' : 'Aa'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.customActions}>
                    <Pressable onPress={() => setAddingCustom(false)} style={styles.customCancel}>
                      <Text style={styles.customCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable onPress={addCustomField} style={[styles.customAdd, !customName.trim() && { opacity: 0.4 }]}>
                      <Feather name="plus" size={14} color={Colors.text.inverse} />
                      <Text style={styles.customAddText}>Añadir</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setAddingCustom(true)} style={styles.addCustomBtn}>
                  <Feather name="plus" size={16} color={Colors.accent.primary} />
                  <Text style={styles.addCustomBtnText}>Crear campo personalizado</Text>
                </Pressable>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.background.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: SHEET_H,
    height: SHEET_H,
    paddingTop: Spacing.md,
    ...Shadows.modal,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border.medium, alignSelf: 'center', marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.subtle,
  },
  title: {
    fontSize: Typography.size.subheading, fontWeight: Typography.weight.bold, color: Colors.text.primary,
  },
  subtitle: {
    fontSize: Typography.size.micro, color: Colors.text.tertiary, marginTop: 2,
  },
  saveBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, backgroundColor: Colors.accent.primary,
  },
  saveBtnText: {
    fontSize: Typography.size.caption, fontWeight: Typography.weight.semibold, color: Colors.text.inverse,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: Typography.weight.bold, color: Colors.text.disabled,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.elevated, borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  fieldInfo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1,
  },
  fieldName: {
    fontSize: Typography.size.body, fontWeight: Typography.weight.medium, color: Colors.text.primary,
  },
  fieldUnit: {
    fontSize: Typography.size.micro, color: Colors.text.tertiary,
    paddingHorizontal: Spacing.xs + 2, paddingVertical: 1,
    backgroundColor: Colors.background.overlay, borderRadius: Radius.xs,
  },
  primaryBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 1,
    borderRadius: Radius.full, backgroundColor: Colors.accent.dim,
  },
  primaryBadgeText: {
    fontSize: 9, fontWeight: Typography.weight.bold, color: Colors.accent.primary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldActions: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
  },
  fieldActionBtn: {
    padding: 6,
  },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.accent.light, backgroundColor: Colors.accent.dim,
  },
  addChipOther: {
    borderColor: Colors.border.light, backgroundColor: Colors.background.elevated,
  },
  addChipPressed: {
    backgroundColor: Colors.accent.muted,
  },
  addChipText: {
    fontSize: Typography.size.caption, fontWeight: Typography.weight.medium, color: Colors.accent.primary,
  },
  addChipUnit: {
    fontSize: Typography.size.micro, color: Colors.text.disabled,
  },
  addCustomBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: Colors.accent.light,
  },
  addCustomBtnText: {
    fontSize: Typography.size.body, fontWeight: Typography.weight.medium, color: Colors.accent.primary,
  },
  customForm: {
    gap: Spacing.sm, padding: Spacing.md,
    backgroundColor: Colors.background.elevated, borderRadius: Radius.md,
  },
  customInput: {
    fontSize: Typography.size.body, color: Colors.text.primary,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background.surface, borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border.light,
  },
  customRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
  },
  typeToggle: {
    flexDirection: 'row', borderRadius: Radius.sm, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border.light,
  },
  typeBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.surface,
  },
  typeBtnActive: {
    backgroundColor: Colors.accent.primary,
  },
  typeBtnText: {
    fontSize: Typography.size.caption, fontWeight: Typography.weight.semibold, color: Colors.text.tertiary,
  },
  typeBtnTextActive: {
    color: Colors.text.inverse,
  },
  customActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm,
  },
  customCancel: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  customCancelText: {
    fontSize: Typography.size.caption, color: Colors.text.tertiary,
  },
  customAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, backgroundColor: Colors.accent.primary,
  },
  customAddText: {
    fontSize: Typography.size.caption, fontWeight: Typography.weight.semibold, color: Colors.text.inverse,
  },
});
