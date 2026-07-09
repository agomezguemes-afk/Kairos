// KAIROS — BuildingStep: Kai assembles the space. The labor-illusion beat.
//
// A short, living "doing work" moment (not a fake spinner): Kai pulses in
// thinking mode, a summary line CITES the user's own answers ("Con 3 días y un
// gimnasio, te monto tu fuerza…"), a single status line advances through the
// real stages, and a determinate gold bar fills. The bar only completes — and
// the step only advances — once the real generation is `ready`, so the theatre
// lasts max(min-theatre, generation) instead of lying. Reduce-motion shortens
// the minimum but still waits for the work.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Spacing, Type, Colors } from '../../../../theme/tokens';
import { text } from '../textStyles';
import KaiFace from '../KaiFace';
import GoldProgressBar from '../GoldProgressBar';

interface BuildingStepProps {
  /** Display name for a personal touch ("para Álvaro"). */
  name: string | null;
  /** Copy that cites the user's answers — the labor illusion, not a spinner. */
  summary: string;
  /** True once real generation resolved; gates the bar's completion + advance. */
  ready: boolean;
  onDone: () => void;
}

const STAGES = [
  'Analizando tu objetivo',
  'Eligiendo tus ejercicios',
  'Ajustando series y descansos',
  'Sembrando tu semana',
] as const;

function BuildingStep({ name, summary, ready, onDone }: BuildingStepProps) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [stagesDone, setStagesDone] = useState(false);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Minimum theatre: ~2.1s at full motion (within the 1.8–2.4s window),
  // ~0.8s under reduce-motion. Advances the status line stage by stage.
  useEffect(() => {
    const per = reduce ? 200 : 520; // ms per stage
    const timers = STAGES.map((_, i) => setTimeout(() => setStage(i), i * per));
    const done = setTimeout(() => setStagesDone(true), STAGES.length * per);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [reduce]);

  // Advance only when BOTH the minimum theatre elapsed AND generation is ready,
  // so the reveal never shows before the plan actually exists.
  useEffect(() => {
    if (!stagesDone || !ready) return;
    const t = setTimeout(() => onDoneRef.current(), reduce ? 120 : 340);
    return () => clearTimeout(t);
  }, [stagesDone, ready, reduce]);

  const complete = stagesDone && ready;
  const progress = complete ? 1 : Math.min(0.92, (stage + 1) / STAGES.length);
  const stageLabel = complete
    ? 'Listo'
    : stagesDone && !ready
      ? 'Ultimando los detalles'
      : STAGES[stage];

  return (
    <View style={styles.root}>
      <KaiFace size={148} emotion="thinking" />
      <Text style={[text.eyebrowCenter, styles.label]}>KAI ESTÁ TRABAJANDO</Text>
      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {summary}
      </Text>
      {name ? <Text style={styles.forWhom}>para {name}</Text> : null}

      <View style={styles.barWrap} accessibilityRole="progressbar">
        <GoldProgressBar progress={progress} height={5} />
      </View>
      <Text style={styles.stage}>{stageLabel}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  label: { marginTop: Spacing.lg, marginBottom: 0 },
  summary: {
    ...Type.title,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.ink.primary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  forWhom: { ...Type.caption, color: Colors.ink.tertiary, marginTop: -Spacing.xs },
  barWrap: { width: '70%', marginTop: Spacing.lg },
  stage: { ...Type.caption, color: Colors.ink.tertiary },
});

export default React.memo(BuildingStep);
