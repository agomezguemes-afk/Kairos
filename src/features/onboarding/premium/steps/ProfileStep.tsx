// KAIROS — ProfileStep: the deeper "about you" config.
//
// More than a name field: training experience (shapes starter intensity) and
// weekly commitment (shapes the plan). Kept tactile — selectable cards + a day
// dial — so it feels like setup, not a form.

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Type } from '../../../../theme/tokens';
import type { ExperienceLevel } from '../../flow/onboardingFlow';
import { MAX_DAYS_PER_WEEK, MIN_DAYS_PER_WEEK } from '../../flow/onboardingFlow';
import { text } from '../textStyles';
import SoftCard from '../SoftCard';
import GoldButton from '../GoldButton';
import { useTactile } from '../motion/useTactile';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ProfileStepProps {
  name: string;
  experience: ExperienceLevel | null;
  daysPerWeek: number | null;
  onChangeName: (t: string) => void;
  onChangeExperience: (e: ExperienceLevel) => void;
  onChangeDays: (n: number) => void;
  onContinue: () => void;
}

const LEVELS: { id: ExperienceLevel; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Principiante', desc: 'Empiezo ahora' },
  { id: 'intermediate', label: 'Intermedio', desc: 'Entreno con constancia' },
  { id: 'advanced', label: 'Avanzado', desc: 'Años de experiencia' },
];

const DAYS = Array.from(
  { length: MAX_DAYS_PER_WEEK - MIN_DAYS_PER_WEEK + 1 },
  (_, i) => MIN_DAYS_PER_WEEK + i,
);

export default function ProfileStep({
  name,
  experience,
  daysPerWeek,
  onChangeName,
  onChangeExperience,
  onChangeDays,
  onContinue,
}: ProfileStepProps) {
  return (
    <View style={styles.root}>
      <Text style={text.eyebrow}>PASO 2 · TÚ</Text>
      <Text style={text.title}>
        Cuéntanos de <Text style={text.titleAccent}>ti</Text>
      </Text>

      <SoftCard padded style={styles.inputCard}>
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder="Tu nombre"
          placeholderTextColor={Colors.ink.muted}
          cursorColor={Colors.gold.base}
          selectionColor={Colors.gold.base}
          style={styles.input}
          autoCapitalize="words"
          maxLength={32}
          returnKeyType="done"
        />
      </SoftCard>

      <Text style={styles.section}>EXPERIENCIA</Text>
      <View style={styles.levels}>
        {LEVELS.map((l) => {
          const selected = experience === l.id;
          return (
            <SoftCard
              key={l.id}
              selected={selected}
              variant={selected ? 'warm' : 'surface'}
              onPress={() => onChangeExperience(l.id)}
              accessibilityLabel={l.label}
              style={styles.levelCard}
            >
              <View style={styles.levelText}>
                <Text style={[styles.levelLabel, selected && { color: Colors.gold.deep }]}>
                  {l.label}
                </Text>
                <Text style={styles.levelDesc}>{l.desc}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </SoftCard>
          );
        })}
      </View>

      <Text style={styles.section}>DÍAS POR SEMANA</Text>
      <View style={styles.days}>
        {DAYS.map((d) => (
          <DayPill key={d} day={d} selected={daysPerWeek === d} onPress={() => onChangeDays(d)} />
        ))}
      </View>

      <View style={styles.spacer} />
      <View style={styles.fullWidth}>
        <GoldButton label="Continuar" onPress={onContinue} />
      </View>
    </View>
  );
}

// One day in the week dial — shares the tactile language (press + select pop).
function DayPill({
  day,
  selected,
  onPress,
}: {
  day: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = useTactile({ selected, pressTo: 0.9 });
  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);
  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${day} días`}
      style={[styles.day, selected ? styles.dayOn : styles.dayOff, animatedStyle]}
    >
      <Text style={[styles.dayNum, selected ? styles.dayNumOn : styles.dayNumOff]}>{day}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fullWidth: { width: '100%' },
  spacer: { flex: 1, minHeight: Spacing.xl },

  inputCard: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  input: { ...Type.subheading, color: Colors.ink.primary, paddingVertical: Spacing.sm },

  section: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    marginBottom: Spacing.md,
  },

  levels: { gap: Spacing.sm, marginBottom: Spacing.xl },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  levelText: { flex: 1, gap: 2 },
  levelLabel: { ...Type.bodyEmph, color: Colors.ink.primary },
  levelDesc: { ...Type.caption, color: Colors.ink.muted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.gold.base },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.gold.base },

  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 38,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayOff: { backgroundColor: Colors.bg.surface, borderColor: Colors.hair.base },
  dayOn: { backgroundColor: Colors.gold.base, borderColor: Colors.gold.base },
  dayNum: { ...Type.numMedium },
  dayNumOff: { color: Colors.ink.secondary },
  dayNumOn: { color: Colors.ink.inverse },
});
