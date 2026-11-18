// Coach tab — the hub of the adaptive loop: goal → week → train → unlock.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import KIcon from '../../components/icons/KIcon';
import {
  needsWeeklyCheckIn,
  QUALITY_LABEL,
  SPORT_LABEL,
  type Experiment,
} from '../../lib/adaptive';
import {
  ExperimentResult,
  ExperimentReviewCard,
  PreCheckInCard,
  WeeklyCheckInCard,
} from './components/Loop';
import { TodayVerdict } from './components/ExpertPanel';
import { useTodayVerdict } from './useTodayPanel';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import { SHOW_ENGINE_DEBUG } from '../../config/constants';
import { feedback } from './feedback';
import { BPress, BScreen, BText } from './ui/brut';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const enter = (i: number) =>
  FadeInDown.delay(i * 60)
    .duration(Brut.motion.reveal)
    .springify()
    .damping(18);

function PulseSquare() {
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  React.useEffect(() => {
    if (!reduce) v.value = withRepeat(withTiming(0.2, { duration: 700 }), -1, true);
  }, [reduce, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.pulse, style]} />;
}

export default function CoachHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const plan = useCoachStore((s) => s.plan);
  const sessions = useCoachStore((s) => s.sessions);
  const suggestions = useCoachStore((s) => s.suggestions);
  const experiments = useCoachStore((s) => s.experiments);
  const checkins = useCoachStore((s) => s.checkins);
  const submitCheckIn = useCoachStore((s) => s.submitCheckIn);
  const reviewExperiment = useCoachStore((s) => s.reviewExperiment);
  const [lastClosed, setLastClosed] = useState<Experiment | null>(null);

  const pending = useMemo(
    () => suggestions.filter((s) => s.status === 'locked').length,
    [suggestions],
  );
  const week = useMemo(() => plan?.sessions.filter((s) => s.status === 'accepted') ?? [], [plan]);
  const undecided = useMemo(
    () => plan?.sessions.filter((s) => s.status === 'pending').length ?? 0,
    [plan],
  );
  // Captured once per mount: the tab remounts often enough for a 7-day window.
  const [now] = useState(() => Date.now());
  const verdict = useTodayVerdict(now);
  const preToday = useMemo(
    () =>
      checkins.some(
        (c) => c.kind === 'pre' && new Date(c.at).toDateString() === new Date(now).toDateString(),
      ),
    [checkins, now],
  );
  // Ask for the weekly check-in once the plan has had time to be lived.
  const weeklyDue = useMemo(
    () =>
      !!plan &&
      needsWeeklyCheckIn(checkins, new Date(now)) &&
      (sessions.length > 0 || now - new Date(plan.createdAt).getTime() > 3 * 86_400_000),
    [checkins, now, plan, sessions.length],
  );
  const inReview = useMemo(() => experiments.filter((e) => e.status === 'review'), [experiments]);

  const onWeekly = (c: Parameters<typeof submitCheckIn>[0]) => {
    const fresh = submitCheckIn(c);
    if (fresh.length) navigation.navigate('SuggestionReveal');
  };

  return (
    <BScreen>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.topRow}>
          <BText variant="monoBold" size={11} style={styles.brand}>
            KAIROS{' '}
            <BText variant="mono" size={11} color={Brut.muted}>
              / COACH
            </BText>
          </BText>
          {plan && (
            <BPress
              onPress={() => navigation.navigate('CoachGoal')}
              radius={12}
              contentStyle={styles.newGoal}
              accessibilityRole="button"
              accessibilityLabel="Nuevo objetivo"
            >
              <KIcon name="plus" size={18} color={Brut.ink} strokeWidth={2.2} />
            </BPress>
          )}
        </View>

        {!plan ? (
          <Animated.View entering={enter(0)}>
            <BText variant="display" size={54} style={styles.hero}>
              ENTRENA A TU MANERA.{'\n'}YO APRENDO DE TI.
            </BText>
            <BText color={Brut.muted} style={styles.lede}>
              Dime qué quieres conseguir. Te propongo una semana, tú eliges qué se queda, y cada
              entreno desbloquea el siguiente paso.
            </BText>
            <BPress
              onPress={() => {
                feedback.light();
                navigation.navigate('CoachGoal');
              }}
              bg={Brut.accent}
              shadow={Brut.shadow.md}
              radius={Brut.radius.xl}
              style={{ marginTop: Spacing['2xl'] }}
              contentStyle={styles.heroCta}
              accessibilityRole="button"
            >
              <BText variant="monoBold" size={10} color={Brut.onAccent}>
                01 · EMPEZAR
              </BText>
              <BText variant="display" size={34} color={Brut.onAccent} style={{ marginTop: 6 }}>
                CUÉNTAME TU OBJETIVO
              </BText>
              <BText size={14} color={Brut.onAccent} style={{ marginTop: 6 }}>
                «Mejorar al pádel en resistencia», «fuerza para escalar»…
              </BText>
            </BPress>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={enter(0)}>
              <BText variant="display" size={44} style={styles.hero}>
                {week.length ? 'TU SEMANA' : 'TU BORRADOR'}
              </BText>
              <BText variant="mono" size={11} color={Brut.muted} style={{ marginTop: 4 }}>
                {[
                  ...plan.goal.sports.map((s) => SPORT_LABEL[s]),
                  plan.goal.qualities.map((q) => QUALITY_LABEL[q]).join(' → '),
                  `${plan.goal.daysPerWeek} DÍAS/SEM`,
                ]
                  .join(' · ')
                  .toUpperCase()}
              </BText>
            </Animated.View>

            {SHOW_ENGINE_DEBUG && (
              <BPress
                onPress={() => {
                  feedback.light();
                  navigation.navigate('Brain');
                }}
                radius={Brut.radius.md}
                shadow={2}
                style={{ marginTop: Spacing.md }}
                contentStyle={styles.brainLink}
                accessibilityRole="button"
                accessibilityLabel="Ver tu cerebro: lo que Kairos sabe de ti"
              >
                <View style={styles.brainDot} />
                <View style={{ flex: 1 }}>
                  <BText variant="monoBold" size={10}>
                    TU CEREBRO
                  </BText>
                  <BText size={13} color={Brut.muted}>
                    Lo que sé de ti, lo seguro que estoy y de dónde sale.
                  </BText>
                </View>
                <BText variant="bodyBold" size={18} upright>
                  →
                </BText>
              </BPress>
            )}

            {week.length > 0 && (
              <View style={{ marginTop: Spacing.lg }}>
                {preToday ? (
                  verdict && <TodayVerdict verdict={verdict} />
                ) : (
                  <PreCheckInCard onSubmit={submitCheckIn} />
                )}
              </View>
            )}

            {lastClosed && (
              <View style={{ marginTop: Spacing.md }}>
                <ExperimentResult e={lastClosed} />
              </View>
            )}
            {inReview.map((e) => (
              <View key={e.id} style={{ marginTop: Spacing.md }}>
                <ExperimentReviewCard
                  e={e}
                  onSubmit={(a) => setLastClosed(reviewExperiment(e.id, a))}
                />
              </View>
            ))}

            {weeklyDue && (
              <View style={{ marginTop: Spacing.md }}>
                <WeeklyCheckInCard onSubmit={onWeekly} />
              </View>
            )}

            {pending > 0 && (
              <Animated.View entering={enter(2)}>
                <BPress
                  onPress={() => {
                    feedback.light();
                    navigation.navigate('SuggestionReveal');
                  }}
                  shadow={Brut.shadow.md}
                  radius={Brut.radius.xl}
                  style={{ marginTop: Spacing.lg }}
                  contentStyle={styles.unlock}
                  accessibilityRole="button"
                  accessibilityLabel={`${pending} propuestas por desbloquear`}
                >
                  <View style={styles.unlockIcon}>
                    <KIcon name="lock" size={20} color={Brut.onAccent} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}>
                      <PulseSquare />
                      <BText variant="monoBold" size={10}>
                        SELLADAS · BASADAS EN TUS DATOS
                      </BText>
                    </View>
                    <BText variant="display" size={26} style={{ marginTop: 2 }}>
                      {pending} {pending === 1 ? 'PROPUESTA LISTA' : 'PROPUESTAS LISTAS'}
                    </BText>
                  </View>
                  <KIcon name="unlock" size={20} color={Brut.ink} strokeWidth={2} />
                </BPress>
              </Animated.View>
            )}

            <View style={styles.sectionHead}>
              <BText variant="monoBold" size={11}>
                SESIONES
              </BText>
              {undecided > 0 && (
                <BPress
                  onPress={() => navigation.navigate('CoachPlan')}
                  shadow={2}
                  radius={8}
                  contentStyle={styles.smallBtn}
                >
                  <BText variant="monoBold" size={10}>
                    {undecided} SIN DECIDIR →
                  </BText>
                </BPress>
              )}
            </View>

            {week.length === 0 ? (
              <BPress
                onPress={() => navigation.navigate('CoachPlan')}
                contentStyle={styles.empty}
                style={{ marginTop: Spacing.sm }}
              >
                <BText variant="display" size={24}>
                  ELIGE TUS SESIONES
                </BText>
                <BText color={Brut.muted}>Tu borrador está esperando.</BText>
              </BPress>
            ) : (
              <View style={styles.week}>
                {week.map((s, i) => {
                  return (
                    <Animated.View key={s.id} entering={enter(3 + i)}>
                      <BPress
                        onPress={() => {
                          feedback.heavy();
                          navigation.navigate('LiveSession', { draftSessionId: s.id });
                        }}
                        contentStyle={styles.session}
                        accessibilityRole="button"
                        accessibilityLabel={`Empezar ${s.title}`}
                      >
                        <View
                          style={[
                            styles.code,
                            { backgroundColor: i === 0 ? Brut.accent : Brut.accentSoft },
                          ]}
                        >
                          <BText variant="monoBold" size={12} color={Brut.onAccent}>
                            D{s.slot + 1}
                          </BText>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <BText variant="bodyBold" size={16}>
                            {s.title}
                          </BText>
                          <BText variant="mono" size={10} color={Brut.muted} numberOfLines={1}>
                            {s.durationMin} MIN
                          </BText>
                        </View>
                        <View style={styles.play}>
                          <BText variant="bodyBold" size={14} upright color={Brut.onAccent}>
                            ▶
                          </BText>
                        </View>
                      </BPress>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </BScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 140 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  brand: { letterSpacing: 2 },
  newGoal: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: Spacing.md },
  lede: { marginTop: Spacing.md, lineHeight: 22 },
  heroCta: { padding: Spacing.xl },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  unlockIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    width: 8,
    height: 8,
    backgroundColor: Brut.accent,
    borderWidth: 1,
    borderColor: Brut.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing['2xl'],
  },
  smallBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  week: { gap: Spacing.sm, marginTop: Spacing.sm },
  session: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  code: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  empty: { padding: Spacing.xl, gap: 4 },
  brainLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  brainDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.accent,
  },
});
