// KAIROS — MeetKaiStep: the companion introduction. The "meet your character".
//
// The emotional beat of onboarding: Kai materialises and speaks to you, the way
// a game introduces the companion who'll be at your side the whole journey. The
// orb scales in, dialogue types out (tap anywhere to fast-forward), and only
// once Kai has spoken does the CTA appear. Sets up Kai as a character, not a
// feature.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Type } from '../../../../theme/tokens';
import { text } from '../textStyles';
import KaiOrb from '../KaiOrb';
import KaiSpeech from '../KaiSpeech';
import GoldButton from '../GoldButton';

interface MeetKaiStepProps {
  name: string | null;
  onContinue: () => void;
}

const LINES = (name: string | null) => [
  name ? `Hola, ${name}. Soy Kai.` : 'Hola. Soy Kai.',
  'Tu copiloto. Voy a acompañarte en cada entrenamiento.',
  'Construyamos tu espacio juntos.',
];

export default function MeetKaiStep({ name, onContinue }: MeetKaiStepProps) {
  const reduce = useReducedMotion();
  const [revealAll, setRevealAll] = useState(false);
  const [spoke, setSpoke] = useState(false);

  // The orb materialises: scales up from small with a soft settle.
  const arrive = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    arrive.value = withDelay(120, withSpring(1, { damping: 16, stiffness: 140, mass: 1 }));
  }, [reduce, arrive]);
  const orbStyle = useAnimatedStyle(() => ({
    opacity: arrive.value,
    transform: [{ scale: 0.6 + arrive.value * 0.4 }],
  }));

  // CTA fades up once Kai has finished speaking.
  const ctaIn = useSharedValue(0);
  useEffect(() => {
    if (spoke) ctaIn.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [spoke, ctaIn]);
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: (1 - ctaIn.value) * 10 }],
  }));

  return (
    <Pressable style={styles.root} onPress={() => setRevealAll(true)} accessibilityRole="none">
      <View style={styles.stage}>
        <Animated.View style={orbStyle}>
          <KaiOrb size={120} />
        </Animated.View>

        <Text style={[text.eyebrowCenter, styles.label]}>TU COPILOTO</Text>

        <KaiSpeech
          lines={LINES(name)}
          revealAll={revealAll}
          onComplete={() => setSpoke(true)}
          lineStyle={styles.speech}
        />
      </View>

      <View style={styles.bottom}>
        {spoke ? (
          <Animated.View style={[styles.fullWidth, ctaStyle]}>
            <GoldButton label="Encantado, Kai" onPress={onContinue} />
          </Animated.View>
        ) : (
          <Text style={styles.skipHint}>Toca para saltar</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingBottom: Spacing.lg },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  label: { marginTop: Spacing.md, marginBottom: 0 },
  speech: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  bottom: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  fullWidth: { width: '100%' },
  skipHint: { ...Type.micro, color: Colors.ink.muted },
});
