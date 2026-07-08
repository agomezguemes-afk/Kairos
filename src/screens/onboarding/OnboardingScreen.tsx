// KAIROS — Onboarding canónico: quiz (5 páginas) → teatro → reveal → paywall
// Norma de motion (CLAUDE.md): micro 100ms · estándar 180-280ms · 480ms solo
// para el reveal. Selección con glow (gold.glow + borde oro), nunca relleno
// oro sólido; headings nunca en oro. Progreso segmentado + back conservando
// respuestas. Reduce Motion respetado en todas las fases.

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Dimensions,
  FlatList,
  ScrollView,
  type ListRenderItem,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useReducedMotion,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { CommonActions, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import KIcon, { type KIconName } from '../../components/icons/KIcon';
import AnimatedLogoPulse from '../../components/AnimatedLogoPulse';
import SegmentedProgress from '../../components/onboarding/SegmentedProgress';
import { Colors, Type, Spacing, Radius, Shadows, Animation } from '../../theme/tokens';
import { springs } from '../../theme/animations';
import { useWorkoutStore } from '../../store/workoutStore';
import { useUserProfile } from '../../context/UserProfileContext';
import { STARTER_DISCIPLINES, type StarterDiscipline } from '../../lib/routines/starterTemplates';
import type { EquipmentTag, FitnessLevel } from '../../types/profile';
import {
  track,
  EVENTS,
  DISCIPLINE_CAPTIONS,
  buildTheatreSteps,
  withMinimumDuration,
  THEATRE_MIN_MS,
  type OnboardingSpaceResult,
} from './onboardingFlow';
import { generateSpaceForReveal, completeOnboarding, discardGeneratedBlocks } from './integration';
import GenerationTheatre from './GenerationTheatre';
import RevealPhase from './RevealPhase';
import PaywallPhase from './PaywallPhase';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_COUNT = 5;
// Norma CLAUDE.md: transiciones estándar 180-280ms (antes 600/400 — U5).
const ENTER_MS = Animation.duration.normal;
const PAGE_FADE_MS = 240;
const CHECK_FADE_MS = Animation.duration.fast;
// Beat tras el último check del teatro antes de revelar — el usuario ve el
// cuarto check completarse en vez de un corte seco.
const REVEAL_BEAT_MS = 420;

type Goal = 'strength' | 'endurance' | 'flexibility' | 'health';

// Legacy goal vocabulary still drives greetings and stats copy — derived
// from the richer discipline answer instead of asked separately.
const DISCIPLINE_TO_GOAL: Record<StarterDiscipline, Goal> = {
  strength: 'strength',
  running: 'endurance',
  calisthenics: 'strength',
  yoga_mobility: 'flexibility',
  team_sport: 'health',
  hybrid: 'health',
};

// KIcon's set is small — map each discipline to the closest available glyph.
const DISCIPLINE_ICONS: Record<StarterDiscipline, KIconName> = {
  strength: 'barbell',
  running: 'running',
  calisthenics: 'zap',
  yoga_mobility: 'mat',
  team_sport: 'grid',
  hybrid: 'dashboard',
};

const LEVEL_OPTIONS: { id: FitnessLevel; label: string; hint: string }[] = [
  { id: 'beginner', label: 'Empiezo ahora', hint: 'Menos de 6 meses entrenando' },
  { id: 'intermediate', label: 'Tengo base', hint: 'Entreno con regularidad' },
  { id: 'advanced', label: 'Avanzado', hint: 'Años de entrenamiento serio' },
];

const FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5+' },
];

// Equipment chips — KIcon's set is limited, so we map each option to the
// closest icon available. Labels stay in Spanish to match the rest of the flow.
const EQUIPMENT_CHOICES: { id: EquipmentTag; label: string; icon: KIconName }[] = [
  { id: 'bodyweight', label: 'Solo peso corporal', icon: 'mat' },
  { id: 'dumbbells', label: 'Mancuernas', icon: 'barbell' },
  { id: 'barbell_plates', label: 'Barra + discos', icon: 'barbell' },
  { id: 'kettlebell', label: 'Kettlebell', icon: 'barbell' },
  { id: 'resistance_bands', label: 'Bandas elásticas', icon: 'zap' },
  { id: 'pull_up_bar', label: 'Barra de dominadas', icon: 'barbell' },
  { id: 'machines_full_gym', label: 'Gimnasio / máquinas', icon: 'grid' },
  { id: 'cardio_equipment', label: 'Cardio (cinta, bici)', icon: 'running' },
  { id: 'yoga_mat', label: 'Esterilla / yoga', icon: 'mat' },
  { id: 'jump_rope', label: 'Cuerda de saltar', icon: 'zap' },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

type FlowPhase = 'quiz' | 'theatre' | 'reveal' | 'paywall';

interface PageInfo {
  index: number;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const reduceMotion = useReducedMotion();
  const setUserName = useWorkoutStore((s) => s.setUserName);
  const setUserGoal = useWorkoutStore((s) => s.setUserGoal);
  const { updateProfile } = useUserProfile();

  const listRef = useRef<FlatList<PageInfo>>(null);
  const [page, setPage] = useState(0);
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState<StarterDiscipline | null>(null);
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<EquipmentTag[]>([]);
  const [equipmentNotes, setEquipmentNotes] = useState('');

  // Fases post-quiz: teatro de generación → reveal → paywall beta.
  const [phase, setPhase] = useState<FlowPhase>('quiz');
  const [result, setResult] = useState<OnboardingSpaceResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [theatreDone, setTheatreDone] = useState(false);
  const [regenerateUsed, setRegenerateUsed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollX = useSharedValue(0);

  useEffect(() => {
    track(EVENTS.onboardingStarted);
    return () => {
      mountedRef.current = false;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === 'quiz') track(EVENTS.quizStepViewed, { step: page });
  }, [page, phase]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const goToPage = useCallback((idx: number) => {
    listRef.current?.scrollToOffset({ offset: idx * SCREEN_W, animated: true });
    setPage(idx);
  }, []);

  const handleBack = useCallback(() => {
    if (page === 0) return;
    Haptics.selectionAsync().catch(() => {});
    // Back conserva respuestas: el estado vive en el padre, no en las páginas.
    goToPage(page - 1);
  }, [page, goToPage]);

  const isNameReady = name.trim().length > 0;
  const isDisciplineReady = discipline !== null;
  const isPlanReady = level !== null && frequency !== null;

  const ctaEnabled = useMemo(() => {
    if (page === 1) return isNameReady;
    if (page === 2) return isDisciplineReady;
    if (page === 3) return isPlanReady;
    return true; // welcome + equipment (skippable)
  }, [page, isNameReady, isDisciplineReady, isPlanReady]);

  const toggleEquipment = useCallback((id: EquipmentTag) => {
    Haptics.selectionAsync().catch(() => {});
    setEquipment((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  // ── Generación (teatro) ────────────────────────────────────────────────────
  const startGeneration = useCallback(
    (answers: { discipline: StarterDiscipline; level: FitnessLevel; frequency: number }) => {
      setGenError(null);
      setTheatreDone(false);
      setPhase('theatre');
      (async () => {
        try {
          // El gate de 2.6s hace que el teatro se perciba como trabajo real
          // aunque la plantilla resuelva al instante (labor illusion).
          const res = await withMinimumDuration(
            generateSpaceForReveal({ ...answers, equipment }, name.trim()),
            THEATRE_MIN_MS,
          );
          if (!mountedRef.current) return;
          track(EVENTS.spaceGenerated, { source: res.source, duration_ms: res.durationMs });
          setResult(res);
          setTheatreDone(true);
          revealTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setPhase('reveal');
            track(EVENTS.revealViewed);
          }, REVEAL_BEAT_MS);
        } catch {
          // El generador real nunca rechaza; esto solo cubre fallos del store.
          if (mountedRef.current) setGenError('No se pudo montar tu espacio.');
        }
      })();
    },
    [equipment, name],
  );

  const finishQuiz = useCallback(
    (skippedEquipment: boolean) => {
      if (!discipline || !level || !frequency) return;
      track(EVENTS.stepCompleted, { step: 4, skipped: skippedEquipment });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Keyboard.dismiss();
      const trimmedNotes = equipmentNotes.trim();
      const coreDiscipline = STARTER_DISCIPLINES.find((d) => d.id === discipline)?.coreDiscipline;
      updateProfile({
        displayName: name.trim(),
        fitnessLevel: level,
        weeklyFrequency: frequency,
        disciplines: coreDiscipline ? [coreDiscipline] : [],
        equipment,
        equipmentNotes: trimmedNotes.length > 0 ? trimmedNotes : null,
      }).catch(() => {});
      startGeneration({ discipline, level, frequency });
    },
    [discipline, level, frequency, name, equipment, equipmentNotes, updateProfile, startGeneration],
  );

  const handleNext = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (page < 4) track(EVENTS.stepCompleted, { step: page });
    if (page === 0) {
      goToPage(1);
      return;
    }
    if (page === 1) {
      if (!isNameReady) return;
      // NOTE: deliberately NOT calling setUserName here. AppNavigator keys
      // the stack on userName — committing it mid-flow removes the
      // Onboarding screen from the navigator and yanks the user to the
      // Dashboard at page 2. The name is committed on final navigation.
      Keyboard.dismiss();
      goToPage(2);
      return;
    }
    if (page === 2) {
      if (!discipline) return;
      setUserGoal(DISCIPLINE_TO_GOAL[discipline]);
      goToPage(3);
      return;
    }
    if (page === 3) {
      if (!isPlanReady) return;
      goToPage(4);
      return;
    }
    finishQuiz(false);
  }, [page, isNameReady, discipline, isPlanReady, setUserGoal, goToPage, finishQuiz]);

  const handleSkipEquipment = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    finishQuiz(true);
  }, [finishQuiz]);

  const commitAndNavigate = useCallback(() => {
    // Reset within the current stack BEFORE committing the name: setUserName
    // flips AppNavigator's stack config, and Dashboard exists on both sides
    // of that flag, so the order avoids a route-not-found flash.
    nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] }));
    setUserName(name);
  }, [nav, name, setUserName]);

  // ── Acciones del Reveal ────────────────────────────────────────────────────
  const handleStartFromReveal = useCallback(() => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track(EVENTS.revealAction, { action: 'start' });
    // Contrato: se llama al pulsar «Empezar» del Reveal (DEV-L, L2).
    completeOnboarding(result);
    setPhase('paywall');
    track(EVENTS.paywallViewed);
  }, [result]);

  const handleAdjust = useCallback(
    (blockId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      track(EVENTS.revealAction, { action: 'adjust' });
      // Primera lección de soberanía: el bloque se abre en el editor REAL y
      // el back devuelve al Reveal (la pantalla queda montada debajo).
      nav.navigate('BlockDetail', { blockId });
    },
    [nav],
  );

  const handleRegenerate = useCallback(() => {
    if (!result || regenerateUsed || !discipline || !level || !frequency) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track(EVENTS.revealAction, { action: 'regenerate' });
    setRegenerateUsed(true);
    discardGeneratedBlocks(result);
    setResult(null);
    setAttempt((a) => a + 1);
    startGeneration({ discipline, level, frequency });
  }, [result, regenerateUsed, discipline, level, frequency, startGeneration]);

  const handlePaywallContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track(EVENTS.paywallDismissed);
    commitAndNavigate();
  }, [commitAndNavigate]);

  const handleRetryGeneration = useCallback(() => {
    if (!discipline || !level || !frequency) return;
    setAttempt((a) => a + 1);
    startGeneration({ discipline, level, frequency });
  }, [discipline, level, frequency, startGeneration]);

  const theatreSteps = useMemo(() => {
    const label = STARTER_DISCIPLINES.find((d) => d.id === discipline)?.label ?? 'tu disciplina';
    return buildTheatreSteps(label);
  }, [discipline]);

  const data: PageInfo[] = useMemo(
    () => Array.from({ length: PAGE_COUNT }, (_, i) => ({ index: i })),
    [],
  );

  const renderItem: ListRenderItem<PageInfo> = ({ item }) => {
    if (item.index === 0) return <PageWelcome scrollX={scrollX} reduceMotion={reduceMotion} />;
    if (item.index === 1) {
      return (
        <PageName scrollX={scrollX} reduceMotion={reduceMotion} value={name} onChange={setName} />
      );
    }
    if (item.index === 2) {
      return (
        <PageDiscipline
          scrollX={scrollX}
          reduceMotion={reduceMotion}
          value={discipline}
          onChange={(d) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setDiscipline(d);
          }}
        />
      );
    }
    if (item.index === 3) {
      return (
        <PagePlan
          scrollX={scrollX}
          reduceMotion={reduceMotion}
          level={level}
          frequency={frequency}
          onLevel={(l) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setLevel(l);
          }}
          onFrequency={(f) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setFrequency(f);
          }}
        />
      );
    }
    return (
      <PageEquipment
        scrollX={scrollX}
        reduceMotion={reduceMotion}
        selected={equipment}
        notes={equipmentNotes}
        onToggle={toggleEquipment}
        onNotesChange={setEquipmentNotes}
      />
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Backdrop />

      {phase === 'quiz' && (
        <Animated.View
          style={styles.content}
          exiting={reduceMotion ? undefined : FadeOut.duration(Animation.duration.fast)}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header: back + progreso segmentado + omitir (solo equipamiento) */}
            <View style={styles.header}>
              <View style={styles.headerSide}>
                {page > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Atrás"
                    accessibilityHint="Vuelve a la pregunta anterior conservando tu respuesta"
                    onPress={handleBack}
                    hitSlop={Spacing.md}
                    style={styles.backBtn}
                  >
                    <Feather name="chevron-left" size={24} color={Colors.ink.secondary} />
                  </Pressable>
                )}
              </View>
              <SegmentedProgress total={PAGE_COUNT} current={page} reduceMotion={reduceMotion} />
              <View style={styles.headerSide}>
                {page === 4 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Omitir equipamiento"
                    onPress={handleSkipEquipment}
                    hitSlop={Spacing.md}
                    style={styles.skipBtn}
                  >
                    <Text style={styles.skipText}>Omitir</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <AnimatedFlatList
              ref={listRef as any}
              data={data}
              keyExtractor={(it: PageInfo) => String(it.index)}
              renderItem={renderItem as any}
              horizontal
              pagingEnabled
              // Navegación solo por CTA/back: evita saltarse páginas sin responder.
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
              getItemLayout={(_d, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            />

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={page === PAGE_COUNT - 1 ? 'Comenzar' : 'Siguiente'}
                accessibilityState={{ disabled: !ctaEnabled }}
                onPress={handleNext}
                disabled={!ctaEnabled}
                style={({ pressed }) => [
                  styles.cta,
                  { opacity: ctaEnabled ? (pressed ? 0.92 : 1) : 0.4 },
                ]}
              >
                <Text style={styles.ctaText}>
                  {page === PAGE_COUNT - 1 ? 'Comenzar' : 'Siguiente'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {phase === 'theatre' && (
        <GenerationTheatre
          key={attempt}
          steps={theatreSteps}
          finished={theatreDone}
          error={genError}
          userName={name}
          reduceMotion={reduceMotion}
          onRetry={handleRetryGeneration}
        />
      )}

      {phase === 'reveal' && result !== null && (
        <RevealPhase
          result={result}
          userName={name}
          regenerateUsed={regenerateUsed}
          onStart={handleStartFromReveal}
          onAdjust={handleAdjust}
          onRegenerate={handleRegenerate}
        />
      )}

      {phase === 'paywall' && (
        <PaywallPhase reduceMotion={reduceMotion} onContinue={handlePaywallContinue} />
      )}
    </View>
  );
}

// ============================================================
// Backdrop · subtle gold grid (opacity 0.03) on warm off-white
// ============================================================
function Backdrop() {
  const lines = useMemo(() => {
    const out: { x?: number; y?: number; key: string }[] = [];
    const step = 40;
    for (let x = step; x < SCREEN_W; x += step) out.push({ x, key: `vx${x}` });
    const screenH = 1400;
    for (let y = 0; y < screenH; y += step) out.push({ y, key: `hy${y}` });
    return out;
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={StyleSheet.absoluteFill}>
        {lines.map((l) =>
          l.x !== undefined ? (
            <View key={l.key} style={[styles.gridV, { left: l.x }]} />
          ) : (
            <View key={l.key} style={[styles.gridH, { top: l.y }]} />
          ),
        )}
      </View>
      <BlurView intensity={5} tint="light" style={StyleSheet.absoluteFill} />
    </View>
  );
}

// ============================================================
// Shared page hooks
// ============================================================

/** Entrada de página a norma (280ms) — con Reduce Motion entra sin animar. */
function usePageEnter(reduceMotion: boolean, delayMs = 0) {
  const fade = useSharedValue(reduceMotion ? 1 : 0);
  const ty = useSharedValue(reduceMotion ? 0 : 24);

  useEffect(() => {
    if (reduceMotion) {
      fade.value = 1;
      ty.value = 0;
      return;
    }
    fade.value = withDelay(
      delayMs,
      withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
    );
    ty.value = withDelay(
      delayMs,
      withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [fade, ty, reduceMotion, delayMs]);

  return useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));
}

function useParallaxStyle(scrollX: SharedValue<number>, idx: number, reduceMotion: boolean) {
  return useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1, transform: [{ scale: 1 }, { translateX: 0 }] };
    const offset = scrollX.value - idx * SCREEN_W;
    const distance = Math.abs(offset) / SCREEN_W;
    const scale = interpolate(distance, [0, 1], [1, 0.96], Extrapolate.CLAMP);
    const opacity = interpolate(distance, [0, 1], [1, 0.5], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale }, { translateX: -offset * 0.12 }],
    };
  });
}

interface PageBaseProps {
  scrollX: SharedValue<number>;
  reduceMotion: boolean;
}

// ============================================================
// Page 1 · Welcome
// ============================================================
function PageWelcome({ scrollX, reduceMotion }: PageBaseProps) {
  const pageStyle = useParallaxStyle(scrollX, 0, reduceMotion);
  const t1 = usePageEnter(reduceMotion);
  const t2 = usePageEnter(reduceMotion, 120);

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <View style={styles.illustration}>
          <AnimatedLogoPulse size={120} breathing={!reduceMotion} initialFade={!reduceMotion} />
        </View>
        {/* Heading en ink.primary — nunca oro en headings (U5). */}
        <Animated.Text style={[styles.heading, t1]}>
          Bienvenido a tu espacio de entrenamiento
        </Animated.Text>
        <Animated.Text style={[styles.body, t2]}>
          El primer lienzo que se adapta a ti, no al revés.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Page 2 · Name
// ============================================================
function PageName({
  scrollX,
  reduceMotion,
  value,
  onChange,
}: PageBaseProps & {
  value: string;
  onChange: (s: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const pageStyle = useParallaxStyle(scrollX, 1, reduceMotion);
  const animStyle = usePageEnter(reduceMotion);

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <Animated.Text style={[styles.heading, animStyle]}>¿Cómo te llamas?</Animated.Text>

        {/* El oro señala foco, no decora: borde hair.base → gold.base al enfocar. */}
        <Animated.View
          style={[
            styles.inputCard,
            { borderColor: focused ? Colors.gold.base : Colors.hair.base },
            animStyle,
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.ink.muted}
            cursorColor={Colors.gold.base}
            selectionColor={Colors.gold.base}
            style={styles.input}
            autoCapitalize="words"
            maxLength={32}
            returnKeyType="next"
            accessibilityLabel="Tu nombre"
          />
        </Animated.View>

        <Animated.Text style={[styles.helper, animStyle]}>
          Lo usaremos para personalizar tu experiencia.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Page 3 · Discipline — selección con glow + micro-momento
// ============================================================
function PageDiscipline({
  scrollX,
  reduceMotion,
  value,
  onChange,
}: PageBaseProps & {
  value: StarterDiscipline | null;
  onChange: (d: StarterDiscipline) => void;
}) {
  const pageStyle = useParallaxStyle(scrollX, 2, reduceMotion);
  const animStyle = usePageEnter(reduceMotion);

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <Animated.Text style={[styles.heading, animStyle]}>¿Qué vas a entrenar?</Animated.Text>
        <Animated.Text style={[styles.helper, animStyle]}>
          Kai montará tu primer plan alrededor de esto. Podrás añadir más después.
        </Animated.Text>

        <Animated.View style={[styles.cardGrid, animStyle]}>
          {STARTER_DISCIPLINES.map((opt) => (
            <DisciplineCard
              key={opt.id}
              label={opt.label}
              icon={DISCIPLINE_ICONS[opt.id]}
              selected={value === opt.id}
              reduceMotion={reduceMotion}
              onPress={() => onChange(opt.id)}
            />
          ))}
        </Animated.View>

        {/* Micro-momento: la elección tiene consecuencia visible (patrón Runna). */}
        <View style={styles.captionSlot}>
          {value !== null && (
            <Animated.Text
              key={value}
              entering={reduceMotion ? undefined : FadeIn.duration(200)}
              style={styles.captionText}
            >
              {DISCIPLINE_CAPTIONS[value]}
            </Animated.Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const DisciplineCard = React.memo(function DisciplineCard({
  label,
  icon,
  selected,
  reduceMotion,
  onPress,
}: {
  label: string;
  icon: KIconName;
  selected: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => {
        if (!reduceMotion) scale.value = withSpring(0.97, springs.tap);
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withSpring(1, springs.tap);
      }}
      style={styles.disciplineCardWrap}
    >
      <Animated.View
        style={[
          styles.disciplineCard,
          selected ? styles.optionSelected : styles.optionIdle,
          scaleStyle,
        ]}
      >
        <KIcon
          name={icon}
          size={24}
          color={selected ? Colors.ink.primary : Colors.ink.tertiary}
          strokeWidth={1.5}
        />
        <Text style={styles.optionLabel}>{label}</Text>
        {selected && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(CHECK_FADE_MS)}
            style={styles.cardCheck}
          >
            <Feather name="check" size={14} color={Colors.gold.deep} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
});

// ============================================================
// Page 4 · Level + weekly frequency
// ============================================================
function PagePlan({
  scrollX,
  reduceMotion,
  level,
  frequency,
  onLevel,
  onFrequency,
}: PageBaseProps & {
  level: FitnessLevel | null;
  frequency: number | null;
  onLevel: (l: FitnessLevel) => void;
  onFrequency: (f: number) => void;
}) {
  const pageStyle = useParallaxStyle(scrollX, 3, reduceMotion);
  const animStyle = usePageEnter(reduceMotion);
  const showEaseNote = level === 'beginner' && frequency !== null && frequency >= 5;

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <View style={styles.pageInner}>
        <Animated.Text style={[styles.heading, animStyle]}>Tu punto de partida</Animated.Text>

        <Animated.View style={[styles.planSection, animStyle]}>
          {LEVEL_OPTIONS.map((opt) => {
            const selected = level === opt.id;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.label}. ${opt.hint}`}
                onPress={() => onLevel(opt.id)}
                style={({ pressed }) => [
                  styles.levelRow,
                  selected ? styles.optionSelected : styles.optionIdle,
                  pressed && styles.pressedDim,
                ]}
              >
                <View style={styles.levelTextWrap}>
                  <Text style={styles.levelLabel}>{opt.label}</Text>
                  <Text style={styles.levelHint}>{opt.hint}</Text>
                </View>
                {selected && (
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeIn.duration(CHECK_FADE_MS)}
                  >
                    <Feather name="check" size={16} color={Colors.gold.deep} />
                  </Animated.View>
                )}
              </Pressable>
            );
          })}
        </Animated.View>

        <Animated.View style={[styles.planSection, animStyle]}>
          <Text style={styles.planLabel}>¿CUÁNTOS DÍAS A LA SEMANA?</Text>
          <View style={styles.freqRow}>
            {FREQUENCY_OPTIONS.map((opt) => {
              const selected = frequency === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label} días por semana`}
                  onPress={() => onFrequency(opt.value)}
                  style={({ pressed }) => [
                    styles.freqPill,
                    selected ? styles.optionSelected : styles.optionIdle,
                    pressed && styles.pressedDim,
                  ]}
                >
                  <Text style={styles.freqText}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Validación-confianza: reconoce la elección sin bloquear (Runna). */}
          <View style={styles.easeNoteSlot}>
            {showEaseNote && (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(200)}
                style={styles.easeNote}
              >
                <Feather name="info" size={13} color={Colors.ink.muted} />
                <Text style={styles.easeNoteText}>Kai empezará suave y subirá contigo.</Text>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ============================================================
// Page 5 · Equipment (multi-select + freeform note)
// ============================================================
function PageEquipment({
  scrollX,
  reduceMotion,
  selected,
  notes,
  onToggle,
  onNotesChange,
}: PageBaseProps & {
  selected: EquipmentTag[];
  notes: string;
  onToggle: (id: EquipmentTag) => void;
  onNotesChange: (s: string) => void;
}) {
  const [notesFocused, setNotesFocused] = useState(false);
  const pageStyle = useParallaxStyle(scrollX, 4, reduceMotion);
  const headerStyle = usePageEnter(reduceMotion);

  return (
    <Animated.View style={[styles.page, pageStyle]}>
      <Animated.View style={[styles.equipHeader, headerStyle]}>
        <Text style={styles.heading}>¿Qué material tienes a mano?</Text>
        <Text style={styles.helper}>
          Selecciona todo lo que uses. Si no marcas nada, asumimos peso corporal.
        </Text>
      </Animated.View>

      <ScrollView
        style={styles.equipScroll}
        contentContainerStyle={styles.equipScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.equipGrid}>
          {EQUIPMENT_CHOICES.map((opt, i) => (
            <EquipmentChip
              key={opt.id}
              label={opt.label}
              icon={opt.icon}
              selected={selected.includes(opt.id)}
              onPress={() => onToggle(opt.id)}
              delayMs={40 + i * 24}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.equipNotesCard,
            { borderColor: notesFocused ? Colors.gold.base : Colors.hair.base },
            headerStyle,
          ]}
        >
          <Text style={styles.equipNotesLabel}>Otro equipamiento (opcional)</Text>
          <TextInput
            value={notes}
            onChangeText={onNotesChange}
            onFocus={() => setNotesFocused(true)}
            onBlur={() => setNotesFocused(false)}
            placeholder="Trineo, anillas, TRX, banco inclinado…"
            placeholderTextColor={Colors.ink.muted}
            cursorColor={Colors.gold.base}
            selectionColor={Colors.gold.base}
            style={styles.equipNotesInput}
            maxLength={140}
            returnKeyType="done"
            blurOnSubmit
            accessibilityLabel="Otro equipamiento"
          />
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const EquipmentChip = React.memo(function EquipmentChip({
  label,
  icon,
  selected,
  onPress,
  delayMs,
  reduceMotion,
}: {
  label: string;
  icon: KIconName;
  selected: boolean;
  onPress: () => void;
  delayMs: number;
  reduceMotion: boolean;
}) {
  const fade = useSharedValue(reduceMotion ? 1 : 0);
  const ty = useSharedValue(reduceMotion ? 0 : 16);

  useEffect(() => {
    if (reduceMotion) {
      fade.value = 1;
      ty.value = 0;
      return;
    }
    fade.value = withDelay(
      delayMs,
      withTiming(1, { duration: PAGE_FADE_MS, easing: Easing.out(Easing.cubic) }),
    );
    ty.value = withDelay(
      delayMs,
      withTiming(0, { duration: PAGE_FADE_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [fade, ty, delayMs, reduceMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.equipChipWrap, animStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.equipChip,
          selected ? styles.optionSelected : styles.optionIdle,
          pressed && styles.pressedDim,
        ]}
      >
        <KIcon
          name={icon}
          size={22}
          color={selected ? Colors.ink.primary : Colors.ink.tertiary}
          strokeWidth={1.5}
        />
        <Text numberOfLines={2} style={styles.equipChipLabel}>
          {label}
        </Text>
        {selected && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(CHECK_FADE_MS)}>
            <Feather name="check" size={14} color={Colors.gold.deep} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
});

// ============================================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  flex: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  page: {
    width: SCREEN_W,
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    justifyContent: 'center',
  },
  pageInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.screen.bottom,
    gap: Spacing.lg,
  },
  illustration: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  heading: {
    ...Type.heading,
    color: Colors.ink.primary,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  body: {
    ...Type.body,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  helper: {
    ...Type.caption,
    color: Colors.ink.muted,
    textAlign: 'center',
  },
  inputCard: {
    width: '100%',
    height: 64,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    backgroundColor: Colors.bg.surface,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    ...Shadows.subtle,
  },
  input: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  cardGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  // Lenguaje de selección glow — el oro sólido queda reservado al CTA (U5).
  optionIdle: {
    backgroundColor: Colors.bg.surface,
    borderColor: Colors.hair.base,
    ...Shadows.subtle,
  },
  optionSelected: {
    backgroundColor: Colors.gold.glow,
    borderColor: Colors.gold.base,
  },
  pressedDim: {
    opacity: 0.92,
  },
  disciplineCardWrap: {
    width: '47%',
  },
  // 6-up discipline grid — shorter than 4-up cards so three rows fit above
  // the footer on compact screens.
  disciplineCard: {
    width: '100%',
    height: 96,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  optionLabel: {
    ...Type.caption,
    color: Colors.ink.primary,
    textAlign: 'center',
  },
  cardCheck: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  captionSlot: {
    height: 22,
    justifyContent: 'center',
  },
  captionText: {
    ...Type.caption,
    color: Colors.ink.muted,
    textAlign: 'center',
  },
  planSection: {
    width: '100%',
    gap: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  planLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
    textAlign: 'center',
  },
  levelRow: {
    width: '100%',
    minHeight: 64,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelTextWrap: {
    flexShrink: 1,
    gap: 2,
  },
  levelLabel: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  levelHint: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  freqRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    justifyContent: 'center',
  },
  freqPill: {
    minWidth: 64,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  freqText: {
    ...Type.numMedium,
    color: Colors.ink.primary,
  },
  easeNoteSlot: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  easeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  easeNoteText: {
    ...Type.caption,
    color: Colors.ink.muted,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: Radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold.base,
    ...Shadows.card,
    shadowColor: Colors.gold.base,
  },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.inverse,
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    opacity: 0.03,
    backgroundColor: Colors.gold.base,
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.03,
    backgroundColor: Colors.gold.base,
  },
  equipHeader: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  equipScroll: {
    flex: 1,
    width: '100%',
  },
  equipScrollContent: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.screen.bottom,
    alignItems: 'center',
  },
  equipGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
    justifyContent: 'space-between',
  },
  equipChipWrap: {
    width: '48%',
  },
  equipChip: {
    minHeight: 64,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  equipChipLabel: {
    ...Type.caption,
    color: Colors.ink.primary,
    flex: 1,
  },
  equipNotesCard: {
    marginTop: Spacing.lg,
    width: '100%',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs + 2,
    ...Shadows.subtle,
  },
  equipNotesLabel: {
    ...Type.eyebrow,
    color: Colors.ink.muted,
  },
  equipNotesInput: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    paddingVertical: Spacing.xs,
  },
});
