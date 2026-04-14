// KAIROS — Profile Setup Screen
// Shown after first sign-up (or when profile is incomplete).
// Scrollable form that upserts to Supabase and syncs local UserProfileContext.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../store/useAuthStore';
import { useUserProfile } from '../context/UserProfileContext';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';
import type { FitnessLevel, FitnessGoal, WorkoutPlace } from '../types/profile';

// ======================== OPTION SETS ========================

const GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
  { value: 'strength', label: 'Fuerza' },
  { value: 'muscle_gain', label: 'Ganar músculo' },
  { value: 'endurance', label: 'Resistencia' },
  { value: 'weight_loss', label: 'Perder grasa' },
  { value: 'wellness', label: 'Bienestar' },
  { value: 'flexibility', label: 'Flexibilidad' },
];

const LEVEL_OPTIONS: { value: FitnessLevel; label: string }[] = [
  { value: 'beginner', label: 'Principiante' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
];

const FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '2 días' },
  { value: 3, label: '3 días' },
  { value: 4, label: '4 días' },
  { value: 5, label: '5 días' },
  { value: 6, label: '6 días' },
  { value: 7, label: 'Todos' },
];

const PLACE_OPTIONS: { value: WorkoutPlace; label: string }[] = [
  { value: 'gym', label: 'Gimnasio' },
  { value: 'home', label: 'Casa' },
  { value: 'outdoors', label: 'Al aire libre' },
  { value: 'mixed', label: 'Mixto' },
];

// ======================== CHIP ========================

function Chip<T extends string | number>({
  value,
  label,
  selected,
  onPress,
}: {
  value: T;
  label: string;
  selected: boolean;
  onPress: (v: T) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress(value);
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ======================== SECTION HEADER ========================

function Section({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? (
        <Text style={styles.sectionDesc}>{description}</Text>
      ) : null}
    </View>
  );
}

// ======================== SCREEN ========================

export default function ProfileSetupScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { upsertProfile, isLoading, error } = useAuthStore();
  const { updateProfile, completeOnboarding } = useUserProfile();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [injuries, setInjuries] = useState('');
  const [goal, setGoal] = useState<FitnessGoal | null>(null);
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [place, setPlace] = useState<WorkoutPlace | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setLocalError(null);
    if (!name.trim()) {
      setLocalError('El nombre es obligatorio.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const profileUpdate = {
      displayName: name.trim(),
      age: age ? parseInt(age, 10) : null,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      injuries: injuries.trim() || null,
      primaryGoal: goal,
      fitnessLevel: level,
      weeklyFrequency: frequency,
      workoutPlace: place,
      onboardingCompletedAt: new Date().toISOString(),
    };

    // Sync to Supabase
    const authError = await upsertProfile(profileUpdate);
    if (authError) {
      setLocalError(authError.message);
      return;
    }

    // Keep local context in sync (used by AI + gamification)
    await updateProfile(profileUpdate);
    await completeOnboarding();

    // Navigation is driven by AppNavigator's auth state check
  }, [
    name,
    age,
    weight,
    height,
    injuries,
    goal,
    level,
    frequency,
    place,
    upsertProfile,
    updateProfile,
    completeOnboarding,
  ]);

  const displayError = localError ?? error;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).duration(350)} style={styles.header}>
          <Text style={styles.headerTitle}>Cuéntame sobre ti</Text>
          <Text style={styles.headerSubtitle}>
            Kai usará estos datos para personalizar tus entrenamientos.
            Todo es opcional excepto el nombre.
          </Text>
        </Animated.View>

        {/* Name */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={styles.card}>
          <Section title="Tu nombre" />
          <TextInput
            style={styles.textInput}
            placeholder="¿Cómo te llamas?"
            placeholderTextColor={Colors.text.disabled}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Animated.View>

        {/* Body stats */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={styles.card}>
          <Section title="Estadísticas físicas" description="Ayudan a Kai a ajustar la carga de trabajo." />
          <View style={styles.statsRow}>
            <View style={styles.statField}>
              <Text style={styles.statLabel}>Edad</Text>
              <TextInput
                style={styles.statInput}
                placeholder="—"
                placeholderTextColor={Colors.text.disabled}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={styles.statField}>
              <Text style={styles.statLabel}>Peso (kg)</Text>
              <TextInput
                style={styles.statInput}
                placeholder="—"
                placeholderTextColor={Colors.text.disabled}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>
            <View style={styles.statField}>
              <Text style={styles.statLabel}>Altura (cm)</Text>
              <TextInput
                style={styles.statInput}
                placeholder="—"
                placeholderTextColor={Colors.text.disabled}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>
          </View>
        </Animated.View>

        {/* Goal */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)} style={styles.card}>
          <Section title="Objetivo principal" />
          <View style={styles.chips}>
            {GOAL_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                value={o.value}
                label={o.label}
                selected={goal === o.value}
                onPress={setGoal}
              />
            ))}
          </View>
        </Animated.View>

        {/* Level */}
        <Animated.View entering={FadeInDown.delay(240).duration(350)} style={styles.card}>
          <Section title="Nivel de entrenamiento" />
          <View style={styles.chips}>
            {LEVEL_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                value={o.value}
                label={o.label}
                selected={level === o.value}
                onPress={setLevel}
              />
            ))}
          </View>
        </Animated.View>

        {/* Frequency */}
        <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.card}>
          <Section title="Frecuencia semanal" description="¿Cuántos días por semana entrenas?" />
          <View style={styles.chips}>
            {FREQUENCY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                value={o.value}
                label={o.label}
                selected={frequency === o.value}
                onPress={setFrequency}
              />
            ))}
          </View>
        </Animated.View>

        {/* Place */}
        <Animated.View entering={FadeInDown.delay(360).duration(350)} style={styles.card}>
          <Section title="Lugar de entrenamiento" />
          <View style={styles.chips}>
            {PLACE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                value={o.value}
                label={o.label}
                selected={place === o.value}
                onPress={setPlace}
              />
            ))}
          </View>
        </Animated.View>

        {/* Injuries */}
        <Animated.View entering={FadeInDown.delay(420).duration(350)} style={styles.card}>
          <Section
            title="Lesiones o limitaciones"
            description="Opcional. Kai las tendrá en cuenta al generar planes."
          />
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Ej: dolor de rodilla izquierda, hernia lumbar…"
            placeholderTextColor={Colors.text.disabled}
            value={injuries}
            onChangeText={setInjuries}
            multiline
            numberOfLines={3}
          />
        </Animated.View>

        {/* Error */}
        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        {/* Save */}
        <Animated.View entering={FadeInDown.delay(480).duration(350)}>
          <Pressable
            onPress={handleSave}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
              isLoading && { opacity: 0.7 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <Text style={styles.saveBtnText}>Guardar y empezar</Text>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              // Skip — mark onboarding complete without filling details
              await completeOnboarding();
            }}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Ahora no, completar después</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  scroll: {
    paddingHorizontal: Spacing.screen.horizontal,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: Typography.size.body,
    color: Colors.text.secondary,
    lineHeight: Typography.size.body * 1.55,
  },
  card: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.subtle,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
  },
  sectionDesc: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 3,
  },
  textInput: {
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statField: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.medium,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  statInput: {
    backgroundColor: Colors.background.elevated,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    fontSize: Typography.size.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  chipText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.medium,
    color: Colors.text.secondary,
  },
  chipTextSelected: {
    color: Colors.text.inverse,
    fontWeight: Typography.weight.semibold,
  },
  errorBox: {
    backgroundColor: `${Colors.semantic.error}18`,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.semantic.error}40`,
  },
  errorText: {
    fontSize: Typography.size.caption,
    color: Colors.semantic.error,
  },
  saveBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    ...Shadows.card,
    shadowColor: Colors.accent.primary,
  },
  saveBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  skipText: {
    fontSize: Typography.size.body,
    color: Colors.text.tertiary,
  },
});
