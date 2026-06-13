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
import { Colors, Radius, Shadows, Spacing, Type } from '../../../theme/tokens';
import { Fonts } from '../../../theme/fonts';
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
import AmbientBackground from './AmbientBackground';
import GoldButton from './GoldButton';
import GoldProgressBar from './GoldProgressBar';
import PillChip from './PillChip';
import Reveal from './Reveal';
import SoftCard from './SoftCard';

interface PremiumOnboardingProps {
  /** Receives a first-value-ready draft (smart defaults already applied). */
  onComplete: (draft: OnboardingDraft) => void;
  /** Deep-link to a specific step (default 'welcome'). Handy for previews/tests. */
  initialStep?: OnboardingStepId;
}

// Each goal carries a vivid accent (from the discipline palette) so the choice
// grid is colorful and energetic — the "aesthetic" lift — while the rest of the
// app stays gold. Selection rings + glows in the goal's own color.
const GOALS: {
  id: OnboardingGoal;
  label: string;
  desc: string;
  icon: KIconName;
  accent: string;
}[] = [
  {
    id: 'strength',
    label: 'Fuerza',
    desc: 'Músculo y potencia',
    icon: 'barbell',
    accent: Colors.discipline.strength,
  },
  {
    id: 'endurance',
    label: 'Resistencia',
    desc: 'Aguanta más',
    icon: 'running',
    accent: Colors.discipline.running,
  },
  {
    id: 'flexibility',
    label: 'Flexibilidad',
    desc: 'Movilidad y calma',
    icon: 'mat',
    accent: Colors.discipline.mobility,
  },
  {
    id: 'health',
    label: 'Salud general',
    desc: 'Bienestar diario',
    icon: 'zap',
    accent: Colors.discipline.calisthenics,
  },
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

// 'done' is the celebratory reveal — not a question, so it's outside the
// question step order used for the progress bar.
type Screen = OnboardingStepId | 'done';
const STEP_ORDER: OnboardingStepId[] = ['welcome', 'goal', 'name', 'equipment'];

export default function PremiumOnboarding({ onComplete, initialStep }: PremiumOnboardingProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Screen>(initialStep ?? 'welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState<OnboardingDraft | null>(null);
  const ttfv = useRef(makeTtfvTracker(Date.now()));

  const progress = useMemo(
    () => (step === 'done' ? 1 : (STEP_ORDER.indexOf(step) + 1) / STEP_ORDER.length),
    [step],
  );

  // First value is reached here (a ready space exists). Record TTFV once.
  const reachFirstValue = useCallback((d: OnboardingDraft): OnboardingDraft => {
    const r = applySmartDefaults(d);
    const sample = ttfv.current.reached();
    if (__DEV__) {
      // Prove the 2-minute promise in dev logs; wire to analytics later.
      console.log('[onboarding] TTFV', sample.elapsedMs, 'ms', sample.withinMax ? 'OK' : 'OVER');
    }
    return r;
  }, []);

  // Full path → celebratory reveal before entering.
  const goDone = useCallback(
    (d: OnboardingDraft) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setReady(reachFirstValue(d));
      setStep('done');
    },
    [reachFirstValue],
  );

  // Skip path → straight in, no extra tap (the whole point of skip-to-value).
  const handleSkip = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onComplete(reachFirstValue(skipToValue(draft)));
  }, [draft, onComplete, reachFirstValue]);

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
      <AmbientBackground glowY={step === 'welcome' ? 0.3 : 0.12} />
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
                onFinish={() => goDone(draft)}
              />
            )}
            {step === 'done' && ready && (
              <DoneStep name={ready.name} onEnter={() => onComplete(ready)} />
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
        <Text style={styles.hero}>
          Tu entrenamiento,{'\n'}tu <Text style={styles.heroAccent}>espacio</Text>.
        </Text>
      </Reveal>
      <Reveal index={2}>
        <Text style={styles.subtitle}>
          El primer lienzo que se adapta a ti, no al revés. Empieza en segundos.
        </Text>
      </Reveal>

      <View style={styles.welcomeCtas}>
        <Reveal index={3} style={styles.fullWidth}>
          <GoldButton label="Empezar ahora" hint="Listo en 30 segundos" onPress={onSkip} />
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
    <View style={styles.centerFill}>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>PASO 1 · OBJETIVO</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.title}>
          ¿Cuál es tu <Text style={styles.titleAccent}>objetivo</Text>?
        </Text>
      </Reveal>
      <View style={styles.grid}>
        {GOALS.map((g, i) => {
          const selected = value === g.id;
          return (
            <Reveal key={g.id} index={2 + i} style={styles.gridCell}>
              <SoftCard
                selected={selected}
                accentColor={g.accent}
                variant={selected ? 'warm' : 'surface'}
                onPress={() => onSelect(g.id)}
                accessibilityLabel={g.label}
                style={styles.goalCard}
              >
                <View style={[styles.goalIconWrap, { backgroundColor: g.accent + '1A' }]}>
                  <KIcon name={g.icon} size={26} color={g.accent} strokeWidth={1.9} />
                </View>
                <View style={styles.goalText}>
                  <Text style={[styles.goalLabel, selected && { color: g.accent }]}>{g.label}</Text>
                  <Text style={styles.goalDesc}>{g.desc}</Text>
                </View>
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
    <View style={styles.stepFill}>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>PASO 2 · TÚ</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.title}>
          ¿Cómo te <Text style={styles.titleAccent}>llamas</Text>?
        </Text>
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

      <View style={styles.spacer} />
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
    <View style={styles.stepFill}>
      <Reveal index={0}>
        <Text style={styles.eyebrow}>PASO 3 · MATERIAL</Text>
      </Reveal>
      <Reveal index={1}>
        <Text style={styles.title}>
          ¿Qué tienes <Text style={styles.titleAccent}>a mano</Text>?
        </Text>
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
      <View style={styles.spacer} />
      <Reveal index={3 + EQUIPMENT.length} style={styles.fullWidth}>
        <PrimaryCta label="Crear mi espacio" onPress={onFinish} />
      </Reveal>
    </View>
  );
}

function DoneStep({ name, onEnter }: { name: string | null; onEnter: () => void }) {
  return (
    <View style={styles.done}>
      <Reveal index={0}>
        <View style={styles.doneBadge}>
          <Text style={styles.doneCheck}>✓</Text>
        </View>
      </Reveal>
      <Reveal index={1}>
        <Text style={[styles.eyebrow, styles.center]}>TODO LISTO</Text>
      </Reveal>
      <Reveal index={2}>
        <Text style={styles.doneTitle}>
          {name ? `${name}, tu ` : 'Tu '}
          <Text style={styles.titleAccent}>espacio</Text>
          {'\n'}está preparado.
        </Text>
      </Reveal>
      <Reveal index={3}>
        <Text style={[styles.subtitle, styles.center]}>
          Hemos preparado tu primera rutina. Entra y empieza cuando quieras.
        </Text>
      </Reveal>
      <Reveal index={4} style={styles.fullWidth}>
        <PrimaryCta label="Entrar a mi espacio" onPress={onEnter} />
      </Reveal>
    </View>
  );
}

function PrimaryCta({ label, onPress }: { label: string; onPress: () => void }) {
  return <GoldButton label={label} onPress={onPress} style={styles.primaryCta} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  flex: { flex: 1 },
  progressWrap: { paddingHorizontal: Spacing.screen.horizontal, paddingBottom: Spacing.lg },
  scroll: { paddingHorizontal: Spacing.screen.horizontal, flexGrow: 1 },
  stepBody: { flex: 1, paddingTop: Spacing.lg },
  fullWidth: { width: '100%' },
  // Composition helpers: fill the viewport so the primary CTA anchors near the
  // bottom (the studied apps compose the whole frame, never float in the top half).
  stepFill: { flex: 1 },
  centerFill: { flex: 1, justifyContent: 'center', paddingBottom: Spacing['2xl'] },
  spacer: { flex: 1, minHeight: Spacing['2xl'] },

  welcome: { flex: 1, justifyContent: 'center', gap: Spacing.lg, paddingBottom: Spacing['3xl'] },
  welcomeCtas: { marginTop: Spacing['3xl'], gap: Spacing.md, alignItems: 'center' },

  eyebrow: { ...Type.eyebrow, color: Colors.gold.deep, marginBottom: Spacing.sm },
  // Oversized editorial greeting — Fraunces Black, with the key word set in
  // Fraunces italic gold (heavy-upright + light-italic = the signature voice).
  hero: { ...Type.heroDisplay, color: Colors.ink.primary },
  // Dedicated italic TTF — reference by family only (no fontStyle, which would
  // synthetically double-skew an already-italic face on Android).
  heroAccent: { fontFamily: Fonts.serifSemiBoldItalic, color: Colors.gold.base },
  title: { ...Type.title, color: Colors.ink.primary, marginBottom: Spacing['2xl'] },
  // Italic accent word inside a serif title (inherits the title's size).
  titleAccent: { fontFamily: Fonts.serifSemiBoldItalic, color: Colors.gold.base },
  subtitle: { ...Type.body, fontSize: 16, lineHeight: 24, color: Colors.ink.tertiary },
  helper: { ...Type.caption, color: Colors.ink.muted, marginBottom: Spacing.xl },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: { width: '48%', marginBottom: Spacing.md },
  goalCard: { height: 152, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  goalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: { alignItems: 'center', gap: 3 },
  goalLabel: { ...Type.subheading, color: Colors.ink.primary },
  goalDesc: { ...Type.caption, color: Colors.ink.muted, textAlign: 'center' },

  inputCard: { marginBottom: Spacing.md },
  input: { ...Type.subheading, color: Colors.ink.primary, paddingVertical: Spacing.sm },

  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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

  primaryCta: { marginTop: Spacing.lg },

  done: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  center: { textAlign: 'center' },
  doneBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.cardWarm,
  },
  doneCheck: { fontSize: 44, lineHeight: 50, fontWeight: '700', color: Colors.ink.inverse },
  doneTitle: { ...Type.title, textAlign: 'center', color: Colors.ink.primary },
});
