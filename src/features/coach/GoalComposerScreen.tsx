// GoalComposer — the user says what they want in their own words; the
// interpretation appears live underneath so they see what Kairos
// understood before anything is drafted. The rules parse is instant; when
// an LLM is configured it refines the reading once the user pauses typing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { parseGoal, QUALITY_LABEL, SPORT_LABEL, type ParsedGoal } from '../../lib/adaptive';
import { interpretGoal, isGoalAiAvailable } from '../../lib/ai/goalInterpreter';
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

const AI_DEBOUNCE_MS = 900;
const AI_MIN_CHARS = 8;

export default function GoalComposerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const draftFromGoal = useCoachStore((s) => s.draftFromGoal);
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const [aiOn] = useState(isGoalAiAvailable);
  const [ai, setAi] = useState<{ text: string; goal: ParsedGoal } | null>(null);
  const [thinkingFor, setThinkingFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inflight = useRef<{ text: string; promise: Promise<ParsedGoal> } | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const parsed = useMemo(() => (trimmed.length >= 3 ? parseGoal(trimmed) : null), [trimmed]);
  // An AI reading only counts for the exact text it was computed from.
  const goal = ai && ai.text === trimmed && ai.goal.source === 'ai' ? ai.goal : parsed;
  const thinking = thinkingFor !== null && thinkingFor === trimmed;
  const canDraft = !!goal && !busy;
  const vague = goal && goal.confidence < 0.5;

  const refine = useCallback((t: string): Promise<ParsedGoal> => {
    if (inflight.current?.text === t) return inflight.current.promise;
    setThinkingFor(t);
    const promise = interpretGoal(t).then((g) => {
      if (mounted.current) {
        setAi({ text: t, goal: g });
        setThinkingFor((cur) => (cur === t ? null : cur));
      }
      return g;
    });
    inflight.current = { text: t, promise };
    return promise;
  }, []);

  useEffect(() => {
    if (!aiOn || trimmed.length < AI_MIN_CHARS || ai?.text === trimmed) return;
    const timer = setTimeout(() => void refine(trimmed), AI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ai?.text, aiOn, refine, trimmed]);

  const onDraft = useCallback(async () => {
    if (!canDraft || !parsed) return;
    let final: ParsedGoal = goal ?? parsed;
    // Drafting before the pause-triggered refinement landed: wait for it
    // (bounded by the interpreter's own timeout) rather than draft twice.
    if (aiOn && ai?.text !== trimmed && trimmed.length >= AI_MIN_CHARS) {
      setBusy(true);
      final = await refine(trimmed);
      if (!mounted.current) return;
      setBusy(false);
    }
    feedback.success();
    draftFromGoal(trimmed, final);
    navigation.replace('CoachPlan');
  }, [ai?.text, aiOn, canDraft, draftFromGoal, goal, navigation, parsed, refine, trimmed]);

  const chips = goal
    ? [
        ...goal.sports.map((s) => ({ key: `s-${s}`, label: SPORT_LABEL[s], strong: true })),
        ...goal.qualities.map((q) => ({ key: `q-${q}`, label: QUALITY_LABEL[q], strong: false })),
        { key: 'days', label: `${goal.daysPerWeek} días/sem`, strong: false },
        { key: 'weeks', label: `${goal.horizonWeeks} semanas`, strong: false },
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
          onSubmitEditing={() => void onDraft()}
          accessibilityLabel="Describe tu objetivo"
        />

        {!goal && (
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

        {goal && (
          <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.understood}>
            <View style={styles.understoodRow}>
              <Text style={styles.understoodLabel}>Entiendo</Text>
              {thinking ? (
                <Animated.Text entering={FadeIn} style={styles.aiThinking}>
                  afinando…
                </Animated.Text>
              ) : goal.source === 'ai' ? (
                <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.aiTag}>
                  <Text style={styles.aiTagText}>IA</Text>
                </Animated.View>
              ) : null}
            </View>
            {goal.summary && (
              <Animated.Text entering={FadeIn} style={styles.summary}>
                {goal.summary}
              </Animated.Text>
            )}
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
            {goal.question ? (
              <Text style={styles.question}>{goal.question}</Text>
            ) : (
              vague && (
                <Text style={styles.hint}>
                  Dime el deporte o qué quieres mejorar y afino mucho más la propuesta.
                </Text>
              )
            )}
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => void onDraft()}
          disabled={!canDraft}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            !canDraft && styles.ctaDisabled,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.ctaText}>{busy ? 'Interpretando…' : 'Bocetear plan'}</Text>
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
  understoodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  aiThinking: { ...Type.caption, color: Colors.gold.deep, fontStyle: 'italic' },
  aiTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.gold.base,
  },
  aiTagText: { fontSize: 11, fontWeight: '800', color: Coach.stage, letterSpacing: 0.6 },
  summary: { ...Type.bodyEmph, color: Colors.ink.secondary },
  question: { ...Type.body, color: Colors.gold.deep, fontWeight: '600' },
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
