// GoalComposer — the user says what they want in their own words; the
// interpretation appears live underneath so they see what Kairos
// understood before anything is drafted. The rules parse is instant; when
// an LLM is configured it refines the reading once the user pauses typing.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import KIcon from '../../components/icons/KIcon';
import { parseGoal, QUALITY_LABEL, SPORT_LABEL, type ParsedGoal } from '../../lib/adaptive';
import { interpretGoal, isGoalAiAvailable } from '../../lib/ai/goalInterpreter';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import { feedback } from './feedback';
import { BBox, BPress, BScreen, BTag, BText } from './ui/brut';

const EXAMPLES = [
  'Mejorar al pádel en resistencia',
  'Ganar fuerza para escalada',
  'Aguantar rutas largas de montaña',
  'Correr un 10k en 3 meses, 4 días',
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AI_DEBOUNCE_MS = 900;
const AI_MIN_CHARS = 8;
const pad2 = (n: number) => String(n).padStart(2, '0');

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

  const tiles = goal
    ? [
        ...goal.qualities.map((q, i) => ({
          key: `q-${q}`,
          label: i === 0 ? 'PRIMERO' : i === 1 ? 'DESPUÉS' : 'TAMBIÉN',
          value: QUALITY_LABEL[q],
        })),
        { key: 'days', label: 'RITMO', value: `${goal.daysPerWeek} días/sem` },
        { key: 'weeks', label: 'HORIZONTE', value: `${goal.horizonWeeks} semanas` },
      ]
    : [];
  // The words that drove the reading, so the user sees it came from them.
  const evidence = goal?.matched
    .slice(0, 3)
    .map((w) => `“${w}”`)
    .join(' · ')
    .toUpperCase();
  const hint =
    goal?.question ??
    (vague ? 'Dime el deporte o qué quieres mejorar y afino mucho más la propuesta.' : null);

  return (
    <BScreen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <BPress
              onPress={() => navigation.goBack()}
              radius={12}
              contentStyle={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <KIcon name="x" size={18} color={Brut.ink} strokeWidth={2.4} />
            </BPress>
            <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
              NUEVO OBJETIVO
            </BText>
          </View>

          <Animated.View entering={FadeInDown.duration(Brut.motion.reveal)}>
            <BText variant="display" size={48} style={{ marginTop: Spacing.lg }}>
              ¿QUÉ QUIERES{'\n'}CONSEGUIR?
            </BText>
          </Animated.View>

          <BText variant="monoBold" size={10} color={Brut.muted} style={styles.label}>
            EN TUS PALABRAS
          </BText>
          <BBox style={{ marginTop: Spacing.sm }} contentStyle={styles.inputBox}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Escríbelo como se lo dirías a un entrenador…"
              placeholderTextColor={Brut.muted}
              style={styles.input}
              multiline
              autoFocus
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => void onDraft()}
              accessibilityLabel="Describe tu objetivo"
              selectionColor={Brut.accent}
            />
          </BBox>

          {!goal && (
            <Animated.View entering={FadeIn.delay(200)} style={styles.examples}>
              {EXAMPLES.map((e) => (
                <BPress
                  key={e}
                  shadow={2}
                  radius={12}
                  onPress={() => {
                    feedback.tick();
                    setText(e);
                  }}
                  contentStyle={styles.example}
                >
                  <BText size={14}>{e}</BText>
                </BPress>
              ))}
            </Animated.View>
          )}

          {goal && (
            <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.reading}>
              <View style={styles.readingHead}>
                <BText variant="monoBold" size={10}>
                  LECTURA
                </BText>
                {thinking ? (
                  <BTag>AFINANDO…</BTag>
                ) : (
                  <BTag bg={goal.source === 'ai' ? Brut.accent : 'transparent'}>
                    {`${goal.source === 'ai' ? 'IA' : 'REGLAS'} · ${goal.confidence
                      .toFixed(2)
                      .replace('.', ',')}`}
                  </BTag>
                )}
              </View>

              {goal.summary && (
                <BText variant="bodySemi" size={16} style={{ marginTop: Spacing.sm }}>
                  {goal.summary}
                </BText>
              )}

              <Animated.View
                entering={ZoomIn.duration(Brut.motion.reveal)}
                layout={LinearTransition}
              >
                <BBox
                  bg={Brut.accent}
                  radius={Brut.radius.md}
                  style={{ marginTop: Spacing.md }}
                  contentStyle={styles.sportTile}
                >
                  <View style={{ gap: 4, flex: 1 }}>
                    <BText variant="monoBold" size={10} color={Brut.onAccent}>
                      01 DEPORTE
                    </BText>
                    <BText variant="display" size={32} color={Brut.onAccent}>
                      {goal.sports.map((s) => SPORT_LABEL[s].toUpperCase()).join(' + ')}
                    </BText>
                  </View>
                  {!!evidence && (
                    <BText
                      variant="monoBold"
                      size={10}
                      color={Brut.onAccent}
                      style={styles.evidence}
                    >
                      {evidence}
                    </BText>
                  )}
                </BBox>
              </Animated.View>

              <View style={styles.grid}>
                {tiles.map((t, i) => (
                  <Animated.View
                    key={t.key}
                    style={styles.cell}
                    entering={ZoomIn.delay(60 + i * 50).duration(Brut.motion.reveal)}
                    layout={LinearTransition}
                  >
                    <BBox radius={Brut.radius.md} contentStyle={styles.tile}>
                      <BText variant="monoBold" size={10} color={Brut.muted}>
                        {pad2(i + 2)} {t.label}
                      </BText>
                      <BText variant="display" size={22}>
                        {t.value.toUpperCase()}
                      </BText>
                    </BBox>
                  </Animated.View>
                ))}
                <View style={styles.cell}>
                  <BBox dashed shadow={0} radius={Brut.radius.md} contentStyle={styles.tile}>
                    <BText variant="monoBold" size={10} color={Brut.muted}>
                      TU NIVEL
                    </BText>
                    <BText variant="bodyBold" size={14}>
                      Lo aprendo en tus 3 primeras sesiones
                    </BText>
                  </BBox>
                </View>
              </View>

              {hint && (
                <BBox
                  shadow={0}
                  bg={Brut.accentSoft}
                  style={{ marginTop: Spacing.md }}
                  contentStyle={styles.note}
                >
                  <BText variant="bodySemi" size={15}>
                    {hint}
                  </BText>
                </BBox>
              )}
            </Animated.View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <BPress
            onPress={() => void onDraft()}
            disabled={!canDraft}
            bg={Brut.ink}
            shadowColor={Brut.accent}
            shadow={Brut.shadow.md}
            radius={Brut.radius.xl}
            contentStyle={styles.cta}
            accessibilityRole="button"
          >
            <BText variant="bodyBold" size={17} color={Brut.bg}>
              {busy ? 'Interpretando…' : 'Bocetear mi semana'}
            </BText>
            <BText variant="bodyBold" size={20} color={Brut.bg} upright>
              →
            </BText>
          </BPress>
          <BText variant="mono" size={10} color={Brut.muted} style={styles.footnote}>
            BORRADOR · TÚ DECIDES QUÉ SE QUEDA
          </BText>
        </View>
      </KeyboardAvoidingView>
    </BScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 170 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: Spacing.xl, letterSpacing: 1.4 },
  inputBox: { padding: Spacing.md, minHeight: 112 },
  input: {
    fontFamily: Brut.font.bodySemi,
    fontSize: 20,
    lineHeight: 27,
    color: Brut.ink,
    minHeight: 84,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', fontStyle: 'italic' } as object) : null),
  },
  examples: { gap: Spacing.sm, marginTop: Spacing.lg, alignItems: 'flex-start' },
  example: { paddingHorizontal: Spacing.md, paddingVertical: 10 },
  reading: { marginTop: Spacing.xl },
  readingHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sportTile: { padding: Spacing.md, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  evidence: { maxWidth: '45%', textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.sm, marginHorizontal: -3 },
  cell: { width: '50%', padding: 3 },
  tile: { padding: Spacing.md, gap: 8, minHeight: 82 },
  note: { padding: Spacing.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Brut.bg,
    gap: Spacing.sm,
  },
  cta: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  footnote: { textAlign: 'center' },
});
