// KAIROS — CoachStep: meet Kai, your copilot. The novel heart of onboarding.
//
// Instead of one more form, the user *talks* to the AI that will live in the app
// day to day. Kai introduces itself, the user describes — in their own words —
// what they want and how they train, and that free text (aiPrompt) shapes the
// starter space. Suggestion chips make it a one-tap if they'd rather not type.

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '../../../../theme/tokens';
import { MAX_AI_PROMPT_LEN } from '../../flow/onboardingFlow';
import { text } from '../textStyles';
import GoldButton from '../GoldButton';
import PressableScale from '../motion/PressableScale';
import KaiOrb from '../KaiOrb';

interface CoachStepProps {
  value: string;
  onChange: (t: string) => void;
  onContinue: () => void;
}

// One-tap starters. Tapping sets the prompt (the user can keep editing).
const SUGGESTIONS = [
  'Ganar masa muscular',
  'Volver a entrenar tras un parón',
  'Correr un 10k',
  'Ganar movilidad y evitar lesiones',
  'Perder grasa y tonificar',
];

export default function CoachStep({ value, onChange, onContinue }: CoachStepProps) {
  const remaining = MAX_AI_PROMPT_LEN - value.length;
  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <KaiOrb size={72} />
        <Text style={[text.eyebrowCenter, styles.kaiLabel]}>KAI · TU COPILOTO</Text>
        <Text style={styles.kaiTitle}>
          Cuéntame qué <Text style={text.titleAccent}>buscas</Text>
        </Text>
        <Text style={[text.subtitleCenter, styles.kaiSub]}>
          Qué quieres, qué no te está funcionando, cómo entrenas. Con eso pienso tu plan.
        </Text>
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.slice(0, MAX_AI_PROMPT_LEN))}
          placeholder="Ej: Quiero ganar fuerza en tren superior, entreno en casa con mancuernas 3 días por semana…"
          placeholderTextColor={Colors.ink.muted}
          cursorColor={Colors.gold.base}
          selectionColor={Colors.gold.base}
          style={styles.input}
          multiline
          textAlignVertical="top"
          maxLength={MAX_AI_PROMPT_LEN}
        />
        <Text style={styles.counter}>{remaining}</Text>
      </View>

      <Text style={styles.orPick}>O elige un punto de partida</Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => (
          <PressableScale
            key={s}
            haptic="selection"
            pressScale={0.95}
            accessibilityRole="button"
            accessibilityLabel={s}
            onPress={() => onChange(s)}
            style={styles.chip}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {s}
            </Text>
          </PressableScale>
        ))}
      </View>

      <View style={styles.spacer} />
      <View style={styles.fullWidth}>
        <GoldButton
          label={value.trim() ? 'Crear con Kai' : 'Sorpréndeme'}
          hint={value.trim() ? undefined : 'Kai elegirá por ti'}
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.sm },
  fullWidth: { width: '100%' },
  spacer: { flex: 1, minHeight: Spacing.lg },

  intro: { alignItems: 'center', gap: Spacing.sm },
  kaiLabel: { marginTop: Spacing.md, marginBottom: 0 },
  kaiTitle: { ...Type.title, color: Colors.ink.primary, textAlign: 'center' },
  kaiSub: { paddingHorizontal: Spacing.lg },

  inputWrap: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.base,
    padding: Spacing.lg,
    minHeight: 120,
  },
  input: {
    ...Type.body,
    fontSize: 16,
    lineHeight: 23,
    color: Colors.ink.primary,
    flex: 1,
    minHeight: 84,
  },
  counter: { ...Type.micro, color: Colors.ink.muted, alignSelf: 'flex-end' },

  orPick: {
    ...Type.caption,
    color: Colors.ink.muted,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.bg.warm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.gold.light,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 1,
  },
  chipText: { ...Type.caption, color: Colors.gold.deep },
});
