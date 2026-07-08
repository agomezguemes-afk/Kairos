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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import KaiFace from './KaiFace';
import GoldButton from './GoldButton';
import GoldProgressBar from './GoldProgressBar';
import PillChip from './PillChip';
import SoftCard from './SoftCard';
import StepEnter from './motion/StepEnter';
import ManuscriptStep from '../manuscript/ManuscriptStep';
import { applyPage, type FilledBlank } from '../manuscript/manuscript';
import AuthStep from './steps/AuthStep';
import MeetKaiStep from './steps/MeetKaiStep';
import ProfileStep from './steps/ProfileStep';
import CoachStep from './steps/CoachStep';
import BuildingStep from './steps/BuildingStep';
import PresentationStep from './steps/PresentationStep';
import type { OnboardingAnalyticsEvent } from './onboardingAnalytics';

// The full flow. welcome/auth are brand+account; goal→profile→equipment→coach
// are the tracked "config" questions; building→presentation are the culmination
// (first block created, app presented). 'done' is the legacy terminal kept only
// as a fallback alias for presentation.
type Screen =
  | 'welcome'
  | 'auth'
  | 'manuscrito'
  | 'meet-kai'
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
  /**
   * Fires when the building theatre starts, with the same ready draft that
   * onComplete will deliver — lets the host overlap real generation with
   * the theatre instead of blocking after it.
   */
  onBuildingStart?: (draft: OnboardingDraft) => void;
  /**
   * Funnel taps. The component stays free of the analytics queue: it reports
   * WHAT happened; the host maps events to ANALYTICS_EVENTS + track().
   */
  onEvent?: (event: OnboardingAnalyticsEvent) => void;
  /** Deep-link to a specific step (default 'welcome'). Handy for previews/tests. */
  initialStep?: Screen;
  /** DEV only: scripted fills so the manuscript page can be photographed. */
  manuscriptAutoplay?: boolean;
  /** DEV only: freeze the manuscript autoplay at a state. */
  manuscriptFreezeAt?: React.ComponentProps<typeof ManuscriptStep>['freezeAt'];
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

export default function PremiumOnboarding({
  onComplete,
  onBuildingStart,
  onEvent,
  initialStep,
  manuscriptAutoplay = false,
  manuscriptFreezeAt,
}: PremiumOnboardingProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Screen>(initialStep ?? 'welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState<OnboardingDraft | null>(null);
  // Lazy init runs once — start the TTFV clock when onboarding first mounts.
  const [ttfv] = useState(() => makeTtfvTracker(Date.now()));

  // Mirror onEvent in a ref so the step-view effect keys on `step` alone and
  // never re-fires when the parent passes a fresh callback identity.
  const eventRef = useRef(onEvent);
  useEffect(() => {
    eventRef.current = onEvent;
  }, [onEvent]);
  const emit = useCallback((e: OnboardingAnalyticsEvent) => eventRef.current?.(e), []);

  // Funnel: onboarding_started once (welcome), quiz_step_viewed per step, and
  // plan_reveal_viewed when the presentation (the reveal) becomes visible.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current && step === 'welcome') {
      startedRef.current = true;
      emit({ type: 'started' });
    }
    emit({ type: 'step_viewed', step });
    if (step === 'presentation') emit({ type: 'reveal_viewed' });
  }, [step, emit]);

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
    const r = reachFirstValue(draft);
    setReady(r);
    onBuildingStart?.(r);
    setStep('building');
  }, [draft, reachFirstValue, onBuildingStart]);

  const enterApp = useCallback(() => {
    emit({ type: 'reveal_action', action: 'start' });
    onComplete(ready ?? applySmartDefaults(draft));
  }, [onComplete, ready, draft, emit]);

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
            {step === 'welcome' && (
              <WelcomeStep
                onStart={() => {
                  emit({ type: 'step_completed', step: 'welcome' });
                  setStep('auth');
                }}
              />
            )}
            {step === 'auth' && (
              <AuthStep
                onAuth={() => {
                  emit({ type: 'step_completed', step: 'auth' });
                  setStep('manuscrito');
                }}
              />
            )}
            {step === 'manuscrito' && (
              <ManuscriptStep
                autoplay={manuscriptAutoplay}
                freezeAt={manuscriptFreezeAt}
                onDone={(filled: FilledBlank[]) => {
                  emit({ type: 'step_completed', step: 'manuscrito' });
                  const d = applyPage(draft, filled);
                  setDraft(d);
                  setReady(reachFirstValue(d));
                  setStep('presentation');
                }}
              />
            )}
            {step === 'meet-kai' && (
              <MeetKaiStep name={draft.name} onContinue={() => setStep('goal')} />
            )}
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
      {/* Top: brand wordmark anchors the frame (the Senso move), with the
          consumer-register category line beneath it — "tu práctica, operada"
          (VUELTA_DE_ROSCA §5; "Training OS" is banned techie register in UI). */}
      <View>
        <Text style={styles.wordmark}>
          Kairos<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <Text style={styles.mastheadSub}>
          tu práctica, <Text style={styles.mastheadSubAccent}>operada</Text>
        </Text>
      </View>

      {/* Middle: editorial hero, vertically centred in the remaining space. */}
      <View style={styles.welcomeHero}>
        <Text style={styles.hero}>
          Tu entrenamiento,{'\n'}tu <Text style={styles.heroAccent}>espacio</Text>.
        </Text>
        {/* One message per slot: the CTA hint already says "Kai piensa, tú
            entrenas" — the subtitle doesn't repeat it. */}
        <Text style={styles.subtitle}>Tú llevas el control — sin adivinar, sin agobiarte.</Text>

        {/* El Glifo signs the hero — the Kai the copy names is present from
            the first frame: calm, low, alive. Optical left-align: the calm
            stroke starts at ~6% of the square canvas. */}
        <View style={styles.welcomeGlyph}>
          <KaiFace size={150} emotion="calm" showGlow={false} />
        </View>
      </View>

      {/* Bottom: anchored CTA. */}
      <View style={styles.welcomeCtas}>
        <View style={styles.fullWidth}>
          <GoldButton label="Comenzar" hint="Kai piensa, tú entrenas" onPress={onStart} />
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
      {/* Centred like the goal step — a short question shouldn't sit
          top-heavy over half a screen of empty ground. */}
      <View style={styles.equipBody}>
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
      </View>
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
  equipBody: { flex: 1, justifyContent: 'center', paddingBottom: Spacing['2xl'] },
  centerFill: { flex: 1, justifyContent: 'center', paddingBottom: Spacing['2xl'] },
  spacer: { flex: 1, minHeight: Spacing['2xl'] },

  welcome: { flex: 1, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  wordmark: { ...Type.titleSmall, color: Colors.ink.primary, letterSpacing: -0.4 },
  wordmarkDot: { color: Colors.gold.base },
  // Category line in Fraunces italic — the mockups' masthead pairing.
  mastheadSub: {
    fontFamily: Fonts.serifItalic,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink.secondary,
    marginTop: 2,
  },
  mastheadSubAccent: { fontFamily: Fonts.serifSemiBoldItalic, color: Colors.gold.deep },
  welcomeHero: { flex: 1, justifyContent: 'center', gap: Spacing.lg },
  welcomeCtas: { gap: Spacing.md, alignItems: 'center' },
  // Negative margins re-center the stroke's visual mass (canvas is square,
  // stroke lives in the middle band) against the text column.
  welcomeGlyph: { marginLeft: -9, marginTop: -Spacing.xl, marginBottom: -Spacing['2xl'] },

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
