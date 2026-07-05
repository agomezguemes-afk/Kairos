// KAIROS — BuildingStep: Kai assembles the first block. The culmination.
//
// A short, living "doing work" moment (not a fake spinner): Kai pulses in
// thinking mode, a single status line advances through the real stages, and a
// determinate gold bar fills. When it completes it calls onDone → the app is
// presented with the block already built. Reduce-motion shortens it.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Spacing, Type, Colors } from '../../../../theme/tokens';
import { text } from '../textStyles';
import KaiFace from '../KaiFace';
import GoldProgressBar from '../GoldProgressBar';

interface BuildingStepProps {
  /** Display name for a personal touch ("Montando el espacio de Álvaro"). */
  name: string | null;
  onDone: () => void;
}

const STAGES = [
  'Analizando tu objetivo',
  'Eligiendo tus ejercicios',
  'Ajustando series y descansos',
  'Montando tu primer bloque',
];

export default function BuildingStep({ name, onDone }: BuildingStepProps) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const per = reduce ? 260 : 720; // ms per stage
    const timers = STAGES.map((_, i) => setTimeout(() => setStage(i), i * per));
    const finish = setTimeout(() => onDoneRef.current(), STAGES.length * per + 360);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [reduce]);

  const progress = (stage + 1) / STAGES.length;

  return (
    <View style={styles.root}>
      <KaiFace size={148} emotion="thinking" />
      <Text style={[text.eyebrowCenter, styles.label]}>KAI ESTÁ TRABAJANDO</Text>
      <Text style={styles.title}>
        {name ? `Preparando el espacio\nde ${name}` : 'Preparando\ntu espacio'}
      </Text>

      <View style={styles.barWrap}>
        <GoldProgressBar progress={progress} height={5} />
      </View>
      <Text style={styles.stage}>{STAGES[stage]}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  label: { marginTop: Spacing.lg, marginBottom: 0 },
  title: { ...Type.title, color: Colors.ink.primary, textAlign: 'center' },
  barWrap: { width: '70%', marginTop: Spacing.md },
  stage: { ...Type.caption, color: Colors.ink.tertiary },
});
