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
  getMovement,
  loadTrend,
  QUALITY_LABEL,
  SPORT_LABEL,
  type LoadBand,
} from '../../lib/adaptive';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import { feedback } from './feedback';
import { BBox, BPress, BScreen, BTag, BText } from './ui/brut';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BAND_COPY: Record<LoadBand, string> = {
  baseline: 'Aprendiendo tu normal: en dos semanas comparo tu carga contigo mismo.',
  lighter: 'Semana más suave que tu media.',
  steady: 'Carga en tu rango habitual.',
  higher: 'Semana por encima de tu media.',
  spike: 'Carga muy por encima de lo habitual: escucha al cuerpo.',
};

const WEEK_MS = 7 * 24 * 3600 * 1000;
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

function Stat({
  index,
  label,
  value,
  unit,
  hot,
}: {
  index: string;
  label: string;
  value: string;
  unit?: string;
  hot?: boolean;
}) {
  return (
    <BBox
      bg={hot ? Brut.accent : Brut.surface}
      radius={Brut.radius.md}
      style={{ flex: 1 }}
      contentStyle={styles.stat}
    >
      <BText variant="monoBold" size={10} color={hot ? Brut.onAccent : Brut.muted}>
        {index} {label}
      </BText>
      <BText variant="display" size={30}>
        {value}
        {unit ? (
          <BText variant="mono" size={11} color={hot ? Brut.onAccent : Brut.muted}>
            {' '}
            {unit}
          </BText>
        ) : null}
      </BText>
    </BBox>
  );
}

export default function CoachHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const plan = useCoachStore((s) => s.plan);
  const sessions = useCoachStore((s) => s.sessions);
  const suggestions = useCoachStore((s) => s.suggestions);

  const pending = useMemo(
    () => suggestions.filter((s) => s.status === 'locked').length,
    [suggestions],
  );
  const week = useMemo(() => plan?.sessions.filter((s) => s.status === 'accepted') ?? [], [plan]);
  const undecided = useMemo(
    () => plan?.sessions.filter((s) => s.status === 'pending').length ?? 0,
    [plan],
  );
  const trend = useMemo(() => loadTrend(sessions), [sessions]);
  // Captured once per mount: the tab remounts often enough for a 7-day window.
  const [now] = useState(() => Date.now());
  const stats = useMemo(() => {
    const since = now - WEEK_MS;
    const thisWeek = sessions.filter((s) => new Date(s.endedAt).getTime() >= since).length;
    const sets = sessions.reduce(
      (n, s) => n + s.movements.reduce((m, mv) => m + mv.sets.filter((x) => x.completed).length, 0),
      0,
    );
    return { thisWeek, sets };
  }, [now, sessions]);
  const doneCount = (id: string) => sessions.filter((s) => s.draftSessionId === id).length;

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

            <Animated.View entering={enter(1)} style={styles.stats}>
              <Stat
                index="01"
                label="SEMANA"
                value={`${stats.thisWeek}`}
                unit={`/${plan.goal.daysPerWeek}`}
                hot
              />
              <Stat index="02" label="CARGA" value={`${trend.acute}`} unit="UA" />
              <Stat index="03" label="DATOS" value={`${stats.sets}`} unit="SERIES" />
            </Animated.View>

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
                  const n = doneCount(s.id);
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
                            {s.durationMin} MIN{n ? ` · ${n}× HECHA` : ''} ·{' '}
                            {s.movements
                              .map((m) => getMovement(m.movementId)?.name)
                              .filter(Boolean)
                              .join(' · ')
                              .toUpperCase()}
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

            {sessions.length > 0 && (
              <BBox style={{ marginTop: Spacing.xl }} contentStyle={styles.load}>
                <View style={styles.row}>
                  <BText variant="monoBold" size={10} color={Brut.muted}>
                    CARGA 7 DÍAS
                  </BText>
                  {trend.ratio !== null && <BTag>{`${trend.ratio}× TU MEDIA`}</BTag>}
                </View>
                <BText variant="display" size={40} style={{ marginTop: 4 }}>
                  {trend.acute}
                  <BText variant="mono" size={12} color={Brut.muted}>
                    {' '}
                    UA
                  </BText>
                </BText>
                <BText size={14} color={Brut.muted}>
                  {BAND_COPY[trend.band]}
                </BText>
              </BBox>
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
  stats: { flexDirection: 'row', gap: 6, marginTop: Spacing.lg },
  stat: { padding: 10, gap: 10 },
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
  load: { padding: Spacing.lg },
});
