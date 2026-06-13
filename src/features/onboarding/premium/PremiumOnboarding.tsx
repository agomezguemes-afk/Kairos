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

import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import KIcon, { type KIconName } from '../../../components/icons/KIcon';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import { Fonts } from '../../../theme/fonts';
import {
  applySmartDefaults,
  EMPTY_DRAFT,
  makeTtfvTracker,
  type ExperienceLevel,
  type OnboardingDraft,
  type OnboardingGoal,
} from '../flow/onboardingFlow';
import AmbientBackground from './AmbientBackground';
import GoldButton from './GoldButton';
import GoldProgressBar from './GoldProgressBar';
import PillChip from './PillChip';
import SoftCard from './SoftCard';
import StepEnter from './motion/StepEnter';
import AuthStep from './steps/AuthStep';
import ProfileStep from './steps/ProfileStep';
import CoachStep from './steps/CoachStep';
import BuildingStep from './steps/BuildingStep';
import PresentationStep from './steps/PresentationStep';

// The full flow. welcome/auth are brand+account; goal→profile→equipment→coach
// are the tracked "config" questions; building→presentation are the culmination
// (first block created, app presented). 'done' is the legacy terminal kept only
// as a fallback alias for presentation.
type Screen =
  | 'welcome'
  | 'auth'
  | 'goal'
  | 'profile'
  | 'equipment'
  | 'coach'
  | 'building'
  | 'presentation';

// Steps that advance the progress bar — the config questions only.
const QUESTION_ORDER: Screen[] = ['goal', 'profile', 'equipment', 'coach'];

interface PremiumOnboardingProps {
  /** Receives a first-value-ready draft (smart defaults already applied). */
  onComplete: (draft: OnboardingDraft) => void;
  /** Deep-link to a specific step (default 'welcome'). Handy for previews/tests. */
  initialStep?: Screen;
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

export default function PremiumOnboarding({ onComplete, initialStep }: PremiumOnboardingProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Screen>(initialStep ?? 'welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState<OnboardingDraft | null>(null);
  // Lazy init runs once — start the TTFV clock when onboarding first mounts.
  const [ttfv] = useState(() => makeTtfvTracker(Date.now()));

  // Progress bar tracks only the config questions; welcome/auth/building/
  // presentation sit outside it. Hidden entirely on the non-question screens.
  const tracked = QUESTION_ORDER.includes(step);
  const progress = useMemo(() => {
    const i = QUESTION_ORDER.indexOf(step);
    return i < 0 ? 0 : (i + 1) / QUESTION_ORDER.length;
  }, [step]);

  // First value = the block is built. Recorded as we enter the building stage.
  const reachFirstValue = useCallback(
    (d: OnboardingDraft): OnboardingDraft => {
      const r = applySmartDefaults(d);
      const sample = ttfv.reached();
      if (__DEV__) {
        console.log('[onboarding] TTFV', sample.elapsedMs, 'ms', sample.withinMax ? 'OK' : 'OVER');
      }
      return r;
    },
    [ttfv],
  );

  const selectGoal = useCallback((id: OnboardingGoal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDraft((d) => ({ ...d, goal: id }));
    setStep('profile');
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

  // Leaving the coach → Kai builds the block. Compute the ready draft now so the
  // building + presentation screens reflect exactly what was generated.
  const startBuilding = useCallback(() => {
    setReady(reachFirstValue(draft));
    setStep('building');
  }, [draft, reachFirstValue]);

  const enterApp = useCallback(() => {
    onComplete(ready ?? applySmartDefaults(draft));
  }, [onComplete, ready, draft]);

  const showProgress = tracked && step !== 'welcome';

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <AmbientBackground glowY={step === 'welcome' || step === 'auth' ? 0.28 : 0.12} />
      {showProgress && (
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
          {/* key=step remounts so the step arrives as one cohesive gesture
              (StepEnter), not a per-item ghost cascade. */}
          <StepEnter key={step} style={styles.stepBody}>
            {step === 'welcome' && <WelcomeStep onStart={() => setStep('auth')} />}
            {step === 'auth' && <AuthStep onAuth={() => setStep('goal')} />}
            {step === 'goal' && <GoalStep value={draft.goal} onSelect={selectGoal} />}
            {step === 'profile' && (
              <ProfileStep
                name={draft.name ?? ''}
                experience={draft.experience}
                daysPerWeek={draft.daysPerWeek}
                onChangeName={(t) => setDraft((d) => ({ ...d, name: t }))}
                onChangeExperience={(e: ExperienceLevel) =>
                  setDraft((d) => ({ ...d, experience: e }))
                }
                onChangeDays={(n) => setDraft((d) => ({ ...d, daysPerWeek: n }))}
                onContinue={() => setStep('equipment')}
              />
            )}
            {step === 'equipment' && (
              <EquipmentStep
                selected={draft.equipment}
                onToggle={toggleEquipment}
                onFinish={() => setStep('coach')}
              />
            )}
            {step === 'coach' && (
              <CoachStep
                value={draft.aiPrompt ?? ''}
                onChange={(t) => setDraft((d) => ({ ...d, aiPrompt: t }))}
                onContinue={startBuilding}
              />
            )}
            {step === 'building' && (
              <BuildingStep name={draft.name} onDone={() => setStep('presentation')} />
            )}
            {step === 'presentation' && (
              <PresentationStep
                name={(ready ?? draft).name}
                goal={(ready ?? draft).goal}
                onEnter={enterApp}
              />
            )}
          </StepEnter>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────────

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.welcome}>
      {/* Top: brand wordmark anchors the frame (the Senso move). */}
      <Text style={styles.wordmark}>
        Kairos<Text style={styles.wordmarkDot}>.</Text>
      </Text>

      {/* Middle: editorial hero, vertically centred in the remaining space. */}
      <View style={styles.welcomeHero}>
        <Text style={styles.eyebrow}>TU TRAINING OS</Text>
        <Text style={styles.hero}>
          Tu entrenamiento,{'\n'}tu <Text style={styles.heroAccent}>espacio</Text>.
        </Text>
        <Text style={styles.subtitle}>
          El primer lienzo que se adapta a ti, no al revés. Lo construyes con Kai en minutos.
        </Text>
      </View>

      {/* Bottom: anchored CTA. */}
      <View style={styles.welcomeCtas}>
        <View style={styles.fullWidth}>
          <GoldButton label="Comenzar" hint="Crea tu espacio con Kai" onPress={onStart} />
        </View>
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
      <Text style={styles.eyebrow}>PASO 1 · OBJETIVO</Text>
      <Text style={styles.title}>
        ¿Cuál es tu <Text style={styles.titleAccent}>objetivo</Text>?
      </Text>
      <View style={styles.grid}>
        {GOALS.map((g) => {
          const selected = value === g.id;
          return (
            <View key={g.id} style={styles.gridCell}>
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
            </View>
          );
        })}
      </View>
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
      <Text style={styles.eyebrow}>PASO 3 · MATERIAL</Text>
      <Text style={styles.title}>
        ¿Qué tienes <Text style={styles.titleAccent}>a mano</Text>?
      </Text>
      <Text style={styles.helper}>Opcional — si no eliges nada, asumimos peso corporal.</Text>
      <View style={styles.pillWrap}>
        {EQUIPMENT.map((e) => (
          <PillChip
            key={e.id}
            label={e.label}
            selected={selected.includes(e.id)}
            onPress={() => onToggle(e.id)}
          />
        ))}
      </View>
      <View style={styles.spacer} />
      <View style={styles.fullWidth}>
        <PrimaryCta label="Continuar" onPress={onFinish} />
      </View>
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

  welcome: { flex: 1, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  wordmark: { ...Type.titleSmall, color: Colors.ink.primary, letterSpacing: -0.4 },
  wordmarkDot: { color: Colors.gold.base },
  welcomeHero: { flex: 1, justifyContent: 'center', gap: Spacing.lg },
  welcomeCtas: { gap: Spacing.md, alignItems: 'center' },

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

  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  primaryCta: { marginTop: Spacing.lg },
});
