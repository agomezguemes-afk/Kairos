// KAIROS — Onboarding Chat Screen
// Conversational questionnaire driven by the AI mascot "Kai".
// Each question appears as a chat message; answers are tappable chips.
// After the final question, Kai says goodbye and the user enters the app.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KaiMascot from '../components/onboarding/KaiMascot';
import OptionChip from '../components/onboarding/OptionChip';
import UserBubble from '../components/onboarding/UserBubble';
import { useUserProfile } from '../context/UserProfileContext';

import type { Discipline } from '../types/core';
import type { FitnessLevel, FitnessGoal } from '../types/profile';
import {
  FITNESS_LEVEL_OPTIONS,
  FITNESS_GOAL_OPTIONS,
  DISCIPLINE_OPTIONS,
  FREQUENCY_OPTIONS,
} from '../types/profile';

import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/index';

// ======================== STEP DEFINITIONS ========================

type StepId = 'greeting' | 'goal' | 'level' | 'disciplines' | 'frequency' | 'body' | 'done';

interface ChatEntry {
  type: 'kai' | 'user';
  text: string;
}

// ======================== SCREEN ========================

export default function OnboardingChatScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const {
    setPrimaryGoal,
    setFitnessLevel,
    setDisciplines,
    setWeeklyFrequency,
    setBodyStats,
    completeOnboarding,
    profile,
  } = useUserProfile();

  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<StepId>('greeting');
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Discipline[]>([]);

  // Body stats inputs (optional step)
  const [ageInput, setAgeInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');

  // Scroll to bottom whenever history or step changes
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(t);
  }, [history.length, step]);

  // Push a user answer + Kai's next message, then advance
  const advanceStep = useCallback(
    (userAnswer: string, nextStep: StepId, kaiMessage: string) => {
      setHistory((prev) => [
        ...prev,
        { type: 'user', text: userAnswer },
        { type: 'kai', text: kaiMessage },
      ]);
      setStep(nextStep);
    },
    [],
  );

  // ======================== HANDLERS ========================

  const handleGoal = useCallback(
    (goal: FitnessGoal, label: string, emoji: string) => {
      setPrimaryGoal(goal);
      advanceStep(
        `${emoji} ${label}`,
        'level',
        '¡Perfecto! ¿Cuál es tu nivel de experiencia?',
      );
    },
    [setPrimaryGoal, advanceStep],
  );

  const handleLevel = useCallback(
    (level: FitnessLevel, label: string, emoji: string) => {
      setFitnessLevel(level);
      advanceStep(
        `${emoji} ${label}`,
        'disciplines',
        'Genial. ¿Qué actividades te interesan? Puedes elegir varias.',
      );
    },
    [setFitnessLevel, advanceStep],
  );

  const handleToggleDiscipline = useCallback((d: Discipline) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }, []);

  const handleConfirmDisciplines = useCallback(() => {
    if (selectedDisciplines.length === 0) return;
    setDisciplines(selectedDisciplines);
    const labels = selectedDisciplines
      .map((d) => {
        const opt = DISCIPLINE_OPTIONS.find((o) => o.value === d);
        return opt ? `${opt.emoji} ${opt.label}` : d;
      })
      .join(', ');
    advanceStep(
      labels,
      'frequency',
      '¿Cuántos días a la semana quieres entrenar?',
    );
  }, [selectedDisciplines, setDisciplines, advanceStep]);

  const handleFrequency = useCallback(
    (freq: number, label: string) => {
      setWeeklyFrequency(freq);
      advanceStep(
        label,
        'body',
        'Último paso (opcional): ¿quieres compartir tus datos físicos? Esto me ayudará a darte mejores recomendaciones. Si no, puedes omitir este paso.',
      );
    },
    [setWeeklyFrequency, advanceStep],
  );

  const handleSubmitBody = useCallback(() => {
    const age = ageInput ? parseInt(ageInput, 10) : undefined;
    const weight = weightInput ? parseFloat(weightInput) : undefined;
    const height = heightInput ? parseInt(heightInput, 10) : undefined;
    if (age || weight || height) {
      setBodyStats({ age, weight, height });
    }
    const parts: string[] = [];
    if (age) parts.push(`${age} años`);
    if (weight) parts.push(`${weight} kg`);
    if (height) parts.push(`${height} cm`);
    const answer = parts.length > 0 ? parts.join(' · ') : 'Omitir';

    setHistory((prev) => [
      ...prev,
      { type: 'user', text: answer },
      {
        type: 'kai',
        text: '¡Listo! He configurado tu espacio basándome en tus respuestas. Puedes cambiar todo más adelante. ¿Preparado?',
      },
    ]);
    setStep('done');
  }, [ageInput, weightInput, heightInput, setBodyStats]);

  const handleFinish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding();
    navigation.replace('Dashboard');
  }, [completeOnboarding, navigation]);

  // ======================== RENDER HELPERS ========================

  const renderCurrentStep = () => {
    switch (step) {
      case 'greeting':
        return (
          <View>
            <KaiMascot
              message="¡Hola! Soy Kai, tu copiloto de bienestar. Vamos a configurar tu espacio. ¿Cuál es tu objetivo principal?"
              delay={300}
            />
            <View style={styles.optionsGrid}>
              {FITNESS_GOAL_OPTIONS.map((opt, i) => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  emoji={opt.emoji}
                  index={i}
                  onPress={() => handleGoal(opt.value, opt.label, opt.emoji)}
                />
              ))}
            </View>
          </View>
        );

      case 'goal':
        // Transitional — handled by advanceStep
        return null;

      case 'level':
        return (
          <View>
            <View style={styles.optionsGrid}>
              {FITNESS_LEVEL_OPTIONS.map((opt, i) => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  emoji={opt.emoji}
                  index={i}
                  onPress={() => handleLevel(opt.value, opt.label, opt.emoji)}
                />
              ))}
            </View>
          </View>
        );

      case 'disciplines':
        return (
          <View>
            <View style={styles.optionsWrap}>
              {DISCIPLINE_OPTIONS.map((opt, i) => (
                <OptionChip
                  key={opt.value}
                  label={opt.label}
                  emoji={opt.emoji}
                  selected={selectedDisciplines.includes(opt.value)}
                  index={i}
                  onPress={() => handleToggleDiscipline(opt.value)}
                />
              ))}
            </View>
            {selectedDisciplines.length > 0 && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Pressable
                  onPress={handleConfirmDisciplines}
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  <Text style={styles.confirmBtnText}>
                    Confirmar ({selectedDisciplines.length})
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>
        );

      case 'frequency':
        return (
          <View style={styles.optionsGrid}>
            {FREQUENCY_OPTIONS.map((opt, i) => (
              <OptionChip
                key={opt.value}
                label={opt.label}
                index={i}
                onPress={() => handleFrequency(opt.value, opt.label)}
              />
            ))}
          </View>
        );

      case 'body':
        return (
          <Animated.View entering={FadeInUp.delay(100).duration(300)} style={styles.bodyForm}>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Edad</Text>
                <TextInput
                  style={styles.input}
                  placeholder="—"
                  placeholderTextColor={Colors.text.disabled}
                  keyboardType="numeric"
                  maxLength={2}
                  value={ageInput}
                  onChangeText={setAgeInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="—"
                  placeholderTextColor={Colors.text.disabled}
                  keyboardType="numeric"
                  maxLength={5}
                  value={weightInput}
                  onChangeText={setWeightInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Altura (cm)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="—"
                  placeholderTextColor={Colors.text.disabled}
                  keyboardType="numeric"
                  maxLength={3}
                  value={heightInput}
                  onChangeText={setHeightInput}
                />
              </View>
            </View>
            <View style={styles.bodyActions}>
              <Pressable
                onPress={handleSubmitBody}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.confirmBtnText}>
                  {ageInput || weightInput || heightInput ? 'Continuar' : 'Omitir'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        );

      case 'done':
        return (
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Pressable
              onPress={handleFinish}
              style={({ pressed }) => [
                styles.startBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={styles.startBtnText}>Entrar a Kairos</Text>
            </Pressable>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  // ======================== MAIN RENDER ========================

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Kai</Text>
        <Text style={styles.headerSubtitle}>Tu copiloto de bienestar</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Render chat history */}
        {history.map((entry, i) =>
          entry.type === 'kai' ? (
            <KaiMascot key={`h-${i}`} message={entry.text} />
          ) : (
            <UserBubble key={`h-${i}`} text={entry.text} />
          ),
        )}

        {/* Current step */}
        {renderCurrentStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ======================== STYLES ========================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background.void,
  },
  header: {
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.background.surface,
  },
  headerTitle: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.accent.primary,
  },
  headerSubtitle: {
    fontSize: Typography.size.micro,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen.horizontal,
    paddingTop: Spacing.xl,
  },
  optionsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  confirmBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
    ...Shadows.subtle,
  },
  confirmBtnText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.inverse,
  },

  // Body stats form
  bodyForm: {
    gap: Spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: Typography.size.micro,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.background.surface,
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    ...Shadows.subtle,
  },
  bodyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },

  // Final CTA
  startBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
    shadowColor: Colors.accent.primary,
  },
  startBtnText: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.bold,
    color: Colors.text.inverse,
  },
});
