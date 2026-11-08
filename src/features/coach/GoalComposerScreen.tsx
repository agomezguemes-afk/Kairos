// GoalComposer — the user says what they want in their own words; the
// interpretation appears live underneath so they see what Kairos
// understood before anything is drafted.

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { parseGoal, QUALITY_LABEL, SPORT_LABEL } from '../../lib/adaptive';
import { useCoachStore } from '../../store/coachStore';
import { Coach, Colors, Radius, Spacing, Type } from '../../theme/tokens';
import { feedback } from './feedback';

const EXAMPLES = [
  'Mejorar al pádel en resistencia',
  'Ganar fuerza para escalada',
  'Aguantar rutas largas de montaña',
  'Correr un 10k en 3 meses, 4 días',
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GoalComposerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const draftFromGoal = useCoachStore((s) => s.draftFromGoal);
  const [text, setText] = useState('');

  const parsed = useMemo(() => (text.trim().length >= 3 ? parseGoal(text) : null), [text]);
  const canDraft = !!parsed;
  const vague = parsed && parsed.confidence < 0.5;

  const onDraft = useCallback(() => {
    if (!canDraft) return;
    feedback.success();
    draftFromGoal(text.trim());
    navigation.replace('CoachPlan');
  }, [canDraft, draftFromGoal, navigation, text]);

  const chips = parsed
    ? [
        ...parsed.sports.map((s) => ({ key: `s-${s}`, label: SPORT_LABEL[s], strong: true })),
        ...parsed.qualities.map((q) => ({ key: `q-${q}`, label: QUALITY_LABEL[q], strong: false })),
        { key: 'days', label: `${parsed.daysPerWeek} días/sem`, strong: false },
        { key: 'weeks', label: `${parsed.horizonWeeks} semanas`, strong: false },
      ]
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Text style={styles.close}>Cerrar</Text>
        </Pressable>

        <Animated.Text entering={FadeInDown.springify().damping(18)} style={styles.eyebrow}>
          NUEVO OBJETIVO
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(60).springify().damping(18)}
          style={styles.display}
        >
          ¿Qué quieres conseguir?
        </Animated.Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escríbelo como se lo dirías a un entrenador…"
          placeholderTextColor={Colors.ink.muted}
          style={styles.input}
          multiline
          autoFocus
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={onDraft}
          accessibilityLabel="Describe tu objetivo"
        />

        {!parsed && (
          <Animated.View entering={FadeIn.delay(200)} style={styles.examples}>
            {EXAMPLES.map((e) => (
              <Pressable
                key={e}
                onPress={() => {
                  feedback.tick();
                  setText(e);
                }}
                style={({ pressed }) => [styles.example, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.exampleText}>{e}</Text>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {parsed && (
          <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.understood}>
            <Text style={styles.understoodLabel}>Entiendo</Text>
            <View style={styles.chips}>
              {chips.map((c, i) => (
                <Animated.View
                  key={c.key}
                  entering={ZoomIn.delay(i * 40)
                    .springify()
                    .damping(16)}
                  layout={LinearTransition}
                >
                  <View style={[styles.chip, c.strong && styles.chipStrong]}>
                    <Text style={[styles.chipText, c.strong && styles.chipTextStrong]}>
                      {c.label}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
            {vague && (
              <Text style={styles.hint}>
                Dime el deporte o qué quieres mejorar y afino mucho más la propuesta.
              </Text>
            )}
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={onDraft}
          disabled={!canDraft}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            !canDraft && styles.ctaDisabled,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.ctaText}>Bocetear plan</Text>
        </Pressable>
        <Text style={styles.footnote}>Será un borrador: tú decides qué se queda.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 160 },
  close: { ...Type.bodyEmph, color: Colors.ink.tertiary, marginBottom: Spacing['3xl'] },
  eyebrow: { ...Type.micro, color: Colors.gold.deep, letterSpacing: 2, fontWeight: '700' },
  display: { ...Coach.display, color: Colors.ink.primary, marginTop: Spacing.sm },
  input: {
    marginTop: Spacing['2xl'],
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: Colors.ink.primary,
    minHeight: 110,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  examples: { gap: Spacing.sm, marginTop: Spacing.lg },
  example: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bg.surface,
    borderWidth: 1,
    borderColor: Colors.hair.base,
  },
  exampleText: { ...Type.body, color: Colors.ink.secondary },
  understood: { marginTop: Spacing.xl, gap: Spacing.md },
  understoodLabel: {
    ...Type.micro,
    color: Colors.ink.muted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bg.surface,
    borderWidth: 1,
    borderColor: Colors.hair.strong,
  },
  chipStrong: { backgroundColor: Coach.stage, borderColor: Coach.stage },
  chipText: { ...Type.bodyEmph, color: Colors.ink.primary },
  chipTextStrong: { color: Coach.stageInk },
  hint: { ...Type.caption, color: Colors.ink.tertiary },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg.void,
    gap: Spacing.sm,
  },
  cta: {
    backgroundColor: Coach.stage,
    borderRadius: Radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.25 },
  ctaText: { fontSize: 17, fontWeight: '700', color: Coach.stageInk, letterSpacing: -0.2 },
  footnote: { ...Type.caption, color: Colors.ink.muted, textAlign: 'center' },
});
