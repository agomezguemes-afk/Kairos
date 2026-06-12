// KAIROS — PremiumOnboarding: the Behance-informed, goal-first onboarding.
//
// A visually rich, <2-minute flow that shows off the premium language from
// docs/UIUX_STUDY_BEHANCE.md (oversized editorial greeting, one gold accent,
// soft cards, pill controls, calm gold progress, state-reactive + reduce-motion
// aware entrances). Composes the pure flow logic (onboardingFlow) and the
// primitives. Presentational by design: it never imports navigation or the
// store — the parent passes onComplete and handles persistence/navigation.
//
// Mount (one line, e.g. in a screen the navigator already owns):
//   <PremiumOnboarding onComplete={(draft) => { persist(draft); goToDashboard(); }} />
// `draft` is already first-value-ready (smart defaults applied).

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import KIcon, { type KIconName } from '../../../components/icons/KIcon';
import { Colors, Radius, Spacing, Type } from '../../../theme/tokens';
import {
  applySmartDefaults,
  EMPTY_DRAFT,
  makeTtfvTracker,
  normalizeName,
  skipToValue,
  type OnboardingDraft,
  type OnboardingGoal,
  type OnboardingStepId,
} from '../flow/onboardingFlow';
import SkipToValueButton from '../flow/SkipToValueButton';
import GoldProgressBar from './GoldProgressBar';
import PillChip from './PillChip';
import Reveal from './Reveal';
import SoftCard from './SoftCard';

interface PremiumOnboardingProps {
  /** Receives a first-value-ready draft (smart defaults already applied). */
  onComplete: (draft: OnboardingDraft) => void;
}

const GOALS: { id: OnboardingGoal; label: string; icon: KIconName }[] = [
  { id: 'strength', label: 'Fuerza', icon: 'barbell' },
  { id: 'endurance', label: 'Resistencia', icon: 'running' },
  { id: 'flexibility', label: 'Flexibilidad', icon: 'mat' },
  { id: 'health', label: 'Salud general', icon: 'zap' },
];

const EQUIPMENT: { id: string; label: string }[] = [
  { id: 'bodyweight', label: 'Peso corporal' },
  { id: 'dumbbells', label: 'Mancuernas' },
  { id: 'barbell_plates', label: 'Barra + discos' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'resistance_bands', label: 'Bandas' },
  { id: 'pull_up_bar', label: 'Dominadas' },
  { id: 'machines_full_gym', label: 'Gimnasio' },
  { id: 'yoga_mat', label: 'Esterilla' },
];

const STEP_ORDER: OnboardingStepId[] = ['welcome', 'goal', 'name', 'equipment'];

export default function PremiumOnboarding({ onComplete }: PremiumOnboardingProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStepId>('welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const ttfv = useRef(makeTtfvTracker(Date.now()));

  const progress = useMemo(() => (STEP_ORDER.indexOf(step) + 1) / STEP_ORDER.length, [step]);

  const finish = useCallback(
    (d: OnboardingDraft) => {
      const ready = applySmartDefaults(d);
      const sample = ttfv.current.reached();
      if (__DEV__) {
        // Prove the 2-minute promise in dev logs; wire to analytics later.
        console.log('[onboarding] TTFV', sample.elapsedMs, 'ms', sample.withinMax ? 'OK' : 'OVER');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onComplete(ready);
    },
    [onComplete],
  );

  const handleSkip = useCallback(() => finish(skipToValue(draft)), [draft, finish]);

  const selectGoal = useCallback((id: OnboardingGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDraft((d) => ({ ...d, goal: id }));
    setStep('name');
  }, []);

  const toggleEquipment = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setDraft((d) => ({
      ...d,
      equipment: d.equipment.includes(id)
        ? d.equipment.filter((x) => x !== id)
        : [...d.equipment, id],
    }));
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      {step !== 'welcome' && (
        <View style={styles.progressWrap}>
          <GoldProgressBar progress={progress} />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* key=step remounts content so the staggered entrance replays per step */}
          <View key={step} style={styles.stepBody}>
            {step === 'welcome' && (
              <WelcomeStep onPersonalize={() => setStep('goal')} onSkip={handleSkip} />
            )}
            {step === 'goal' && <GoalStep value={draft.goal} onSelect={selectGoal} />}
            {step === 'name' && (
              <NameStep
                value={draft.name ?? ''}
                onChange={(t) => setDraft((d) => ({ ...d, name: t }))}
                onContinue={() => setStep('equipment')}
              />
            )}
            {step === 'equipment' && (
              <EquipmentStep
                selected={draft.equipment}
                onToggle={toggleEquipment}
                onFinish={() => finish(draft)}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────────

function WelcomeStep({ onPersonalize, onSkip }: { onPersonalize: () => void; onSkip: () => void }) {
  return (
    <View style={styles.welcome}>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>BIENVENIDO A KAIROS</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.hero}>Tu entrenamiento,{'\n'}tu espacio.</Text>
      </Reveal>
      <Reveal index={2}>
        <Text style={styles.subtitle}>
          El primer lienzo que se adapta a ti, no al revés. Empieza en segundos.
        </Text>
      </Reveal>

      <View style={styles.welcomeCtas}>
        <Reveal index={3} style={styles.fullWidth}>
          <SkipToValueButton onSkip={onSkip} label="Empezar ahora" hint="Listo en 30 segundos" />
        </Reveal>
        <Reveal index={4} style={styles.fullWidth}>
          <Pressable
            accessibilityRole="button"
            onPress={onPersonalize}
            style={({ pressed }) => [styles.ghostCta, pressed && styles.ghostPressed]}
          >
            <Text style={styles.ghostText}>Personalizar mi espacio</Text>
          </Pressable>
        </Reveal>
      </View>
    </View>
  );
}

function GoalStep({
  value,
  onSelect,
}: {
  value: OnboardingGoal | null;
  onSelect: (id: OnboardingGoal) => void;
}) {
  return (
    <View>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>PASO 1 · OBJETIVO</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.title}>¿Cuál es tu objetivo?</Text>
      </Reveal>
      <View style={styles.grid}>
        {GOALS.map((g, i) => {
          const selected = value === g.id;
          return (
            <Reveal key={g.id} index={2 + i} style={styles.gridCell}>
              <SoftCard
                selected={selected}
                variant={selected ? 'warm' : 'surface'}
                onPress={() => onSelect(g.id)}
                accessibilityLabel={g.label}
                style={styles.goalCard}
              >
                <KIcon
                  name={g.icon}
                  size={30}
                  color={selected ? Colors.gold.deep : Colors.ink.secondary}
                  strokeWidth={1.5}
                />
                <Text style={styles.goalLabel}>{g.label}</Text>
              </SoftCard>
            </Reveal>
          );
        })}
      </View>
    </View>
  );
}

function NameStep({
  value,
  onChange,
  onContinue,
}: {
  value: string;
  onChange: (t: string) => void;
  onContinue: () => void;
}) {
  return (
    <View>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>PASO 2 · TÚ</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.title}>¿Cómo te llamas?</Text>
      </Reveal>
      <Reveal index={2}>
        <SoftCard padded style={styles.inputCard}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.ink.muted}
            cursorColor={Colors.gold.base}
            selectionColor={Colors.gold.base}
            style={styles.input}
            autoCapitalize="words"
            maxLength={32}
            returnKeyType="done"
            onSubmitEditing={onContinue}
          />
        </SoftCard>
      </Reveal>
      <Reveal index={3}>
        <Text style={styles.helper}>Lo usaremos para personalizar tu experiencia.</Text>
      </Reveal>

      <Reveal index={4} style={styles.fullWidth}>
        <PrimaryCta
          label={normalizeName(value) ? 'Continuar' : 'Saltar por ahora'}
          onPress={onContinue}
        />
      </Reveal>
    </View>
  );
}

function EquipmentStep({
  selected,
  onToggle,
  onFinish,
}: {
  selected: readonly string[];
  onToggle: (id: string) => void;
  onFinish: () => void;
}) {
  return (
    <View>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>PASO 3 · MATERIAL</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.title}>¿Qué tienes a mano?</Text>
      </Reveal>
      <Reveal index={2}>
        <Text style={styles.helper}>Opcional — si no eliges nada, asumimos peso corporal.</Text>
      </Reveal>
      <View style={styles.pillWrap}>
        {EQUIPMENT.map((e, i) => (
          <Reveal key={e.id} index={3 + i}>
            <PillChip
              label={e.label}
              selected={selected.includes(e.id)}
              onPress={() => onToggle(e.id)}
            />
          </Reveal>
        ))}
      </View>
      <Reveal index={3 + EQUIPMENT.length} style={styles.fullWidth}>
        <PrimaryCta label="Crear mi espacio" onPress={onFinish} />
      </Reveal>
    </View>
  );
}

function PrimaryCta({ label, onPress }: { label: string; onPress: () => void }) {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryPressed]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  flex: { flex: 1 },
  progressWrap: { paddingHorizontal: Spacing.screen.horizontal, paddingBottom: Spacing.lg },
  scroll: { paddingHorizontal: Spacing.screen.horizontal, flexGrow: 1 },
  stepBody: { flex: 1, paddingTop: Spacing.lg },
  fullWidth: { width: '100%' },

  welcome: { flex: 1, justifyContent: 'center', gap: Spacing.lg, paddingBottom: Spacing['3xl'] },
  welcomeCtas: { marginTop: Spacing['3xl'], gap: Spacing.md, alignItems: 'center' },

  eyebrow: { ...Type.eyebrow, color: Colors.gold.deep, marginBottom: Spacing.sm },
  hero: { ...Type.title, fontSize: 38, lineHeight: 42, color: Colors.ink.primary },
  title: { ...Type.title, color: Colors.ink.primary, marginBottom: Spacing['2xl'] },
  subtitle: { ...Type.body, fontSize: 16, lineHeight: 24, color: Colors.ink.tertiary },
  helper: { ...Type.caption, color: Colors.ink.muted, marginBottom: Spacing.xl },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: { width: '48%', marginBottom: Spacing.md },
  goalCard: { height: 132, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  goalLabel: { ...Type.bodyEmph, color: Colors.ink.primary },

  inputCard: { marginBottom: Spacing.md },
  input: { ...Type.subheading, color: Colors.ink.primary, paddingVertical: Spacing.sm },

  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing['3xl'],
  },

  ghostCta: {
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair.strong,
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
  },
  ghostPressed: { opacity: 0.7 },
  ghostText: { ...Type.bodyEmph, color: Colors.ink.secondary },

  primaryCta: {
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  primaryPressed: { opacity: 0.92 },
  primaryText: { ...Type.subheading, color: Colors.ink.inverse },
});
