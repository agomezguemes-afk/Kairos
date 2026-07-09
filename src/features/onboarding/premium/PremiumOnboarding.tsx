// KAIROS — PremiumOnboarding: the guest-first, value-before-account onboarding.
//
// The canonical flow is a <2-minute story that delivers value BEFORE asking for
// an account (Duolingo/Headspace/Blinkist activation order):
//
//   welcome → manuscrito → building → presentation → auth
//
// welcome is the brand moment; el Manuscrito is the personalization (6 madlib
// questions in one page); building is the labor-illusion theatre that cites the
// user's answers while the real space is generated; presentation is the reveal
// (the seeded week + the first real block, celebrated with a spring + haptic);
// and ONLY then does auth appear, reframed as "guarda lo que Kai acaba de
// crearte" — with a persistent guest path. Presentational by design: it never
// imports navigation or the store — the parent passes onComplete/buildReveal.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Type } from '../../../theme/tokens';
import { Fonts } from '../../../theme/fonts';
import {
  applySmartDefaults,
  clampDaysPerWeek,
  DEFAULT_DAYS_PER_WEEK,
  EMPTY_DRAFT,
  makeTtfvTracker,
  type OnboardingDraft,
  type OnboardingGoal,
} from '../flow/onboardingFlow';
import AmbientBackground from './AmbientBackground';
import KaiFace from './KaiFace';
import GoldButton from './GoldButton';
import StepEnter from './motion/StepEnter';
import ManuscriptStep from '../manuscript/ManuscriptStep';
import { applyPage, type FilledBlank } from '../manuscript/manuscript';
import AuthStep, { type AuthProvider } from './steps/AuthStep';
import BuildingStep from './steps/BuildingStep';
import PresentationStep from './steps/PresentationStep';
import { localRevealFromDraft, type RevealPlan } from './reveal';
import type { OnboardingAnalyticsEvent } from './onboardingAnalytics';

// The guest-first flow. Account creation (auth) is the LAST step, after the
// reveal — value is delivered before anything is asked.
type Screen = 'welcome' | 'manuscrito' | 'building' | 'presentation' | 'auth';

interface PremiumOnboardingProps {
  /**
   * Receives a first-value-ready draft (smart defaults already applied). May be
   * async — while its promise is pending the auth step shows a busy state.
   */
  onComplete: (draft: OnboardingDraft) => void | Promise<void>;
  /**
   * Builds the reveal view-model (seeded week + featured block) for a ready
   * draft. Kicks off the real generation and resolves once it's done, so the
   * building theatre lasts max(min-theatre, generation). If omitted, a local
   * preview is used (deep-linked previews / tests).
   */
  buildReveal?: (draft: OnboardingDraft) => Promise<RevealPlan>;
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

// Human phrasing for the labor-illusion copy — cites the user's own answers.
const GOAL_PHRASE: Record<OnboardingGoal, string> = {
  strength: 'tu fuerza',
  endurance: 'tu resistencia',
  flexibility: 'tu movilidad',
  health: 'tu base',
};

const EQUIP_WORD: Record<string, string> = {
  dumbbells: 'mancuernas',
  barbell_plates: 'una barra',
  kettlebell: 'una kettlebell',
  resistance_bands: 'bandas',
  pull_up_bar: 'una barra de dominadas',
  yoga_mat: 'una esterilla',
  machines_full_gym: 'un gimnasio',
};

function equipmentPhrase(eq: readonly string[]): string {
  if (eq.includes('machines_full_gym')) return 'un gimnasio';
  const first = eq.find((e) => e !== 'bodyweight');
  if (!first) return 'tu propio peso';
  return EQUIP_WORD[first] ?? 'tu material';
}

/** "Con 3 días y un gimnasio, te monto tu fuerza…" — cites ≥2 answers. */
function buildingSummary(d: OnboardingDraft): string {
  const days = clampDaysPerWeek(d.daysPerWeek) ?? DEFAULT_DAYS_PER_WEEK;
  const dayWord = days === 1 ? 'día' : 'días';
  const goal = GOAL_PHRASE[d.goal ?? 'health'];
  return `Con ${days} ${dayWord} y ${equipmentPhrase(d.equipment)}, te monto ${goal}…`;
}

export default function PremiumOnboarding({
  onComplete,
  buildReveal,
  onEvent,
  initialStep,
  manuscriptAutoplay = false,
  manuscriptFreezeAt,
}: PremiumOnboardingProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Screen>(initialStep ?? 'welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState<OnboardingDraft | null>(null);
  const [reveal, setReveal] = useState<RevealPlan | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  // True from the auth choice until onComplete resolves (real generation may
  // still be settling) — drives the auth step's accessible busy state.
  const [entering, setEntering] = useState(false);
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

  // First value = the space is built. Recorded as we enter the building stage.
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

  // Guard setState after the success path unmounts us (completeOnboarding flips
  // the navigator stack). Only still-mounted paths call setState.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Leaving the manuscrito → Kai builds the space. Compute the ready draft now
  // and kick off the reveal generation so building + presentation reflect
  // exactly what was generated.
  const goToBuilding = useCallback(
    (d: OnboardingDraft) => {
      const r = reachFirstValue(d);
      setReady(r);
      setReveal(null);
      setRevealReady(false);
      setStep('building');
      const pending = buildReveal ? buildReveal(r) : Promise.resolve(localRevealFromDraft(r));
      pending
        .then((plan) => {
          if (!mounted.current) return;
          setReveal(plan);
          setRevealReady(true);
        })
        .catch(() => {
          // Generation never rejects in practice, but never strand the theatre.
          if (!mounted.current) return;
          setReveal(localRevealFromDraft(r));
          setRevealReady(true);
        });
    },
    [reachFirstValue, buildReveal],
  );

  const completeFlow = useCallback(
    (_method: AuthProvider | 'guest') => {
      if (entering) return; // one commit — ignore double taps while resolving
      emit({ type: 'step_completed', step: 'auth' });
      setEntering(true);
      Promise.resolve(onComplete(ready ?? applySmartDefaults(draft))).finally(() => {
        if (mounted.current) setEntering(false);
      });
    },
    [onComplete, ready, draft, emit, entering],
  );

  // The reveal shown on the presentation step. Falls back to a local preview so
  // a deep-linked presentation step is never blank.
  const revealPlan = useMemo(
    () => reveal ?? localRevealFromDraft(ready ?? applySmartDefaults(draft)),
    [reveal, ready, draft],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <AmbientBackground
        glowY={step === 'welcome' || step === 'auth' ? 0.28 : step === 'presentation' ? 0.18 : 0.12}
      />

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
                  goToBuilding(d);
                }}
              />
            )}
            {step === 'building' && (
              <BuildingStep
                name={(ready ?? draft).name}
                summary={buildingSummary(ready ?? draft)}
                ready={revealReady}
                onDone={() => setStep('presentation')}
              />
            )}
            {step === 'presentation' && (
              <PresentationStep
                name={(ready ?? draft).name}
                reveal={revealPlan}
                onEnter={() => {
                  emit({ type: 'reveal_action', action: 'start' });
                  setStep('auth');
                }}
              />
            )}
            {step === 'auth' && (
              <AuthStep
                busy={entering}
                onAuth={(provider) => completeFlow(provider)}
                onSkip={() => completeFlow('guest')}
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
          consumer-register category line beneath it. */}
      <View>
        <Text style={styles.wordmark}>
          Kairos<Text style={styles.wordmarkDot}>.</Text>
        </Text>
        <Text style={styles.mastheadSub}>
          tu práctica, <Text style={styles.mastheadSubAccent}>orquestada</Text>
        </Text>
      </View>

      {/* Middle: editorial hero, vertically centred in the remaining space. */}
      <View style={styles.welcomeHero}>
        <Text style={styles.hero}>
          Tu entrenamiento,{'\n'}tu <Text style={styles.heroAccent}>espacio</Text>.
        </Text>
        <Text style={styles.subtitle}>Tú llevas el control — sin adivinar, sin agobiarte.</Text>

        {/* El Glifo signs the hero — the Kai the copy names is present from
            the first frame: calm, low, alive. */}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.screen.horizontal, flexGrow: 1 },
  stepBody: { flex: 1, paddingTop: Spacing.lg },
  fullWidth: { width: '100%' },

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
  // Negative margins re-center the stroke's visual mass against the text column.
  welcomeGlyph: { marginLeft: -9, marginTop: -Spacing.xl, marginBottom: -Spacing['2xl'] },

  // Oversized editorial greeting — Fraunces Black, with the key word set in
  // Fraunces italic gold (heavy-upright + light-italic = the signature voice).
  hero: { ...Type.heroDisplay, color: Colors.ink.primary },
  heroAccent: { fontFamily: Fonts.serifSemiBoldItalic, color: Colors.gold.base },
  subtitle: { ...Type.body, fontSize: 16, lineHeight: 24, color: Colors.ink.tertiary },
});
