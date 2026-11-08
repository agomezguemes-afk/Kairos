// Coach tab — the hub of the adaptive loop: goal → week → train → unlock.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Coach, Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import { feedback } from './feedback';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BAND_COPY: Record<LoadBand, string> = {
  baseline: 'Aprendiendo tu normal — en dos semanas comparo tu carga contigo mismo.',
  lighter: 'Semana más suave que tu media.',
  steady: 'Carga en tu rango habitual.',
  higher: 'Semana por encima de tu media.',
  spike: 'Carga muy por encima de lo habitual: escucha al cuerpo.',
};

function PulseDot() {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  React.useEffect(() => {
    if (!reduce) v.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [reduce, v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + v.value * 0.6,
    transform: [{ scale: 0.85 + v.value * 0.3 }],
  }));
  return <Animated.View style={[styles.pulse, style]} />;
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
  const doneCount = (id: string) => sessions.filter((s) => s.draftSessionId === id).length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl }]}
    >
      <Text style={styles.eyebrow}>KAIROS COACH</Text>

      {!plan ? (
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <Text style={styles.display}>Entrena a tu manera. Yo aprendo de ti.</Text>
          <Text style={styles.lede}>
            Dime qué quieres conseguir. Te propongo una semana, tú eliges qué se queda, y cada
            entreno desbloquea el siguiente paso.
          </Text>
          <Pressable
            onPress={() => {
              feedback.light();
              navigation.navigate('CoachGoal');
            }}
            style={({ pressed }) => [styles.heroCta, pressed && { transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
          >
            <Text style={styles.heroCtaEyebrow}>EMPEZAR</Text>
            <Text style={styles.heroCtaTitle}>Cuéntame tu objetivo</Text>
            <Text style={styles.heroCtaSub}>
              «Mejorar al pádel en resistencia», «fuerza para escalar»…
            </Text>
          </Pressable>
        </Animated.View>
      ) : (
        <>
          <Animated.Text entering={FadeInDown.springify().damping(18)} style={styles.goal}>
            «{plan.goal.raw}»
          </Animated.Text>
          <View style={styles.tags}>
            {plan.goal.sports.map((s) => (
              <Text key={s} style={styles.tagStrong}>
                {SPORT_LABEL[s]}
              </Text>
            ))}
            {plan.goal.qualities.map((q) => (
              <Text key={q} style={styles.tag}>
                {QUALITY_LABEL[q]}
              </Text>
            ))}
          </View>

          {pending > 0 && (
            <Animated.View entering={FadeInDown.delay(60).springify().damping(18)}>
              <Pressable
                onPress={() => {
                  feedback.light();
                  navigation.navigate('SuggestionReveal');
                }}
                style={({ pressed }) => [
                  styles.unlockBanner,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
              >
                <View style={styles.unlockIcon}>
                  <KIcon name="lock" size={18} color={Colors.gold.base} />
                  <PulseDot />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unlockTitle}>
                    {pending} {pending === 1 ? 'propuesta lista' : 'propuestas listas'}
                  </Text>
                  <Text style={styles.unlockSub}>Desbloquéalas cuando quieras</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            </Animated.View>
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.section}>Tu semana</Text>
            {undecided > 0 && (
              <Pressable onPress={() => navigation.navigate('CoachPlan')} hitSlop={8}>
                <Text style={styles.link}>{undecided} sin decidir</Text>
              </Pressable>
            )}
          </View>

          {week.length === 0 ? (
            <Pressable onPress={() => navigation.navigate('CoachPlan')} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Elige tus sesiones</Text>
              <Text style={styles.lede}>Tu borrador está esperando.</Text>
            </Pressable>
          ) : (
            <View style={styles.week}>
              {week.map((s, i) => {
                const n = doneCount(s.id);
                return (
                  <Animated.View
                    key={s.id}
                    entering={FadeInDown.delay(100 + i * 60)
                      .springify()
                      .damping(18)}
                  >
                    <View style={styles.sessionCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionMeta}>
                          DÍA {s.slot + 1} · {s.durationMin} MIN{n ? ` · ${n}× HECHA` : ''}
                        </Text>
                        <Text style={styles.sessionTitle}>{s.title}</Text>
                        <Text style={styles.sessionMoves} numberOfLines={1}>
                          {s.movements
                            .map((m) => getMovement(m.movementId)?.name)
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          feedback.heavy();
                          navigation.navigate('LiveSession', { draftSessionId: s.id });
                        }}
                        style={({ pressed }) => [
                          styles.go,
                          pressed && { transform: [{ scale: 0.94 }] },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Empezar ${s.title}`}
                      >
                        <Text style={styles.goText}>▶</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {sessions.length > 0 && (
            <View style={styles.loadCard}>
              <Text style={styles.loadLabel}>CARGA 7 DÍAS</Text>
              <Text style={styles.loadValue}>
                {trend.acute}
                <Text style={styles.loadUnit}>
                  {' '}
                  UA{trend.ratio !== null ? ` · ${trend.ratio}× tu media` : ''}
                </Text>
              </Text>
              <Text style={styles.lede}>{BAND_COPY[trend.band]}</Text>
            </View>
          )}

          <Pressable
            onPress={() => navigation.navigate('CoachGoal')}
            hitSlop={8}
            style={{ marginTop: Spacing.xl }}
          >
            <Text style={styles.link}>Nuevo objetivo</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  eyebrow: { ...Type.micro, color: Colors.gold.deep, letterSpacing: 2, fontWeight: '700' },
  display: { ...Coach.display, color: Colors.ink.primary, marginTop: Spacing.sm },
  lede: { ...Type.body, color: Colors.ink.tertiary, marginTop: Spacing.sm },
  heroCta: {
    marginTop: Spacing['2xl'],
    backgroundColor: Coach.stage,
    borderRadius: 28,
    padding: Spacing['2xl'],
    ...Shadows.elevated,
  },
  heroCtaEyebrow: { ...Type.micro, color: Colors.gold.base, letterSpacing: 2, fontWeight: '700' },
  heroCtaTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: Coach.stageInk,
    marginTop: Spacing.sm,
  },
  heroCtaSub: { ...Type.body, color: Coach.stageMuted, marginTop: Spacing.sm },
  goal: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: Colors.ink.primary,
    marginTop: Spacing.sm,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.md },
  tag: {
    ...Type.caption,
    color: Colors.ink.secondary,
    borderWidth: 1,
    borderColor: Colors.hair.strong,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  tagStrong: {
    ...Type.caption,
    fontWeight: '700',
    color: Coach.stageInk,
    backgroundColor: Coach.stage,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  unlockBanner: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Coach.stage,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gold.base,
    ...Shadows.elevated,
  },
  unlockIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(201,169,110,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.gold.base,
  },
  unlockTitle: { fontSize: 18, fontWeight: '800', color: Coach.stageInk, letterSpacing: -0.3 },
  unlockSub: { ...Type.caption, color: Coach.stageMuted },
  chev: { fontSize: 28, color: Colors.gold.base },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing['3xl'],
  },
  section: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: Colors.ink.primary },
  link: { ...Type.bodyEmph, color: Colors.gold.deep },
  week: { gap: Spacing.md, marginTop: Spacing.md },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    ...Shadows.card,
  },
  sessionMeta: { ...Type.micro, color: Colors.ink.muted, letterSpacing: 1.2, fontWeight: '700' },
  sessionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.ink.primary,
    marginTop: 4,
  },
  sessionMoves: { ...Type.caption, color: Colors.ink.tertiary, marginTop: 4 },
  go: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Coach.stage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goText: { color: Colors.gold.base, fontSize: 18, marginLeft: 3 },
  emptyCard: {
    marginTop: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.hair.strong,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.ink.primary },
  loadCard: {
    marginTop: Spacing['2xl'],
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.hair.base,
  },
  loadLabel: { ...Type.micro, color: Colors.ink.muted, letterSpacing: 1.6, fontWeight: '700' },
  loadValue: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.ink.primary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  loadUnit: { fontSize: 14, fontWeight: '600', color: Colors.ink.tertiary },
});
