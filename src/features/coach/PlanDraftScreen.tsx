// PlanDraft — the drafted week as proposals. Each session is kept or
// discarded by the user; only kept sessions become the active plan.

import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { getMovement, type DraftSession, type DraftStatus } from '../../lib/adaptive';
import { useCoachStore } from '../../store/coachStore';
import { Coach, Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import { feedback } from './feedback';
import { describeTarget } from './format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DraftCard = React.memo(function DraftCard({
  session,
  index,
  onSet,
}: {
  session: DraftSession;
  index: number;
  onSet: (id: string, status: DraftStatus) => void;
}) {
  const kept = session.status === 'accepted';
  const dropped = session.status === 'rejected';
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70)
        .springify()
        .damping(18)}
      layout={LinearTransition.springify().damping(20)}
      style={[styles.card, kept && styles.cardKept, dropped && styles.cardDropped]}
    >
      <View style={styles.cardHead}>
        <Text style={styles.day}>DÍA {session.slot + 1}</Text>
        <Text style={styles.duration}>{session.durationMin} min</Text>
      </View>
      <Text style={[styles.cardTitle, dropped && styles.strike]}>{session.title}</Text>
      {!dropped && (
        <>
          <Text style={styles.rationale}>{session.rationale}</Text>
          <View style={styles.movements}>
            {session.movements.map((pm) => {
              const m = getMovement(pm.movementId);
              if (!m) return null;
              return (
                <View key={pm.movementId} style={styles.movementRow}>
                  <Text style={styles.movementName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={styles.movementTarget}>{describeTarget(m, pm.target)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
      <View style={styles.cardActions}>
        <Pressable
          onPress={() => {
            feedback.tick();
            onSet(session.id, kept ? 'pending' : 'accepted');
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: kept }}
          style={[styles.choice, kept && styles.choiceKept]}
        >
          <Text style={[styles.choiceText, kept && styles.choiceTextKept]}>
            {kept ? '✓ Me la quedo' : 'Me sirve'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            feedback.tick();
            onSet(session.id, dropped ? 'pending' : 'rejected');
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: dropped }}
          style={styles.choiceGhost}
        >
          <Text style={styles.choiceGhostText}>{dropped ? 'Recuperar' : 'Descartar'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
});

export default function PlanDraftScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const plan = useCoachStore((s) => s.plan);
  const setDraftStatus = useCoachStore((s) => s.setDraftStatus);
  const onSet = useCallback(
    (id: string, status: DraftStatus) => setDraftStatus(id, status),
    [setDraftStatus],
  );

  if (!plan) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.rationale}>No hay borrador todavía.</Text>
      </View>
    );
  }

  const kept = plan.sessions.filter((s) => s.status === 'accepted').length;
  const keepAll = () => {
    feedback.light();
    plan.sessions.forEach((s) => s.status === 'pending' && setDraftStatus(s.id, 'accepted'));
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>Volver</Text>
        </Pressable>
        <Text style={styles.eyebrow}>BORRADOR</Text>
        <Text style={styles.display}>Tu semana, propuesta.</Text>
        <Text style={styles.goal}>«{plan.goal.raw}»</Text>
        <Text style={styles.lede}>
          Un punto de partida, no una orden. Quédate con lo que te sirva; el resto lo aprenderé de
          cómo entrenas.
        </Text>
        <Pressable onPress={keepAll} hitSlop={8} accessibilityRole="button">
          <Text style={styles.keepAll}>Quedarme todas</Text>
        </Pressable>
        <View style={styles.list}>
          {plan.sessions.map((s, i) => (
            <DraftCard key={s.id} session={s} index={i} onSet={onSet} />
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          disabled={kept === 0}
          onPress={() => {
            feedback.success();
            navigation.navigate('Dashboard', { screen: 'CoachTab' });
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            kept === 0 && { opacity: 0.25 },
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.ctaText}>
            {kept === 0
              ? 'Elige al menos una sesión'
              : `Activar ${kept} ${kept === 1 ? 'sesión' : 'sesiones'}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.void },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 140 },
  back: { ...Type.bodyEmph, color: Colors.ink.tertiary, marginBottom: Spacing['3xl'] },
  eyebrow: { ...Type.micro, color: Colors.gold.deep, letterSpacing: 2, fontWeight: '700' },
  display: { ...Coach.display, color: Colors.ink.primary, marginTop: Spacing.sm },
  goal: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: Colors.ink.secondary,
    marginTop: Spacing.lg,
    letterSpacing: -0.3,
  },
  lede: { ...Type.body, color: Colors.ink.tertiary, marginTop: Spacing.md },
  keepAll: { ...Type.bodyEmph, color: Colors.gold.deep, marginTop: Spacing.lg },
  list: { gap: Spacing.md, marginTop: Spacing.xl },
  card: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.hair.base,
    ...Shadows.card,
  },
  cardKept: { borderColor: Colors.gold.base },
  cardDropped: { opacity: 0.55, shadowOpacity: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { ...Type.micro, color: Colors.ink.muted, letterSpacing: 1.6, fontWeight: '700' },
  duration: { ...Type.micro, color: Colors.ink.tertiary, fontVariant: ['tabular-nums'] },
  cardTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: Colors.ink.primary,
    marginTop: Spacing.sm,
  },
  strike: { textDecorationLine: 'line-through', color: Colors.ink.muted },
  rationale: { ...Type.body, color: Colors.ink.tertiary, marginTop: Spacing.sm },
  movements: { marginTop: Spacing.lg, gap: 10 },
  movementRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  movementName: { ...Type.bodyEmph, color: Colors.ink.primary, flex: 1 },
  movementTarget: { ...Type.caption, color: Colors.ink.tertiary, fontVariant: ['tabular-nums'] },
  cardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  choice: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.ink.primary,
  },
  choiceKept: { backgroundColor: Colors.gold.base, borderColor: Colors.gold.base },
  choiceText: { ...Type.bodyEmph, color: Colors.ink.primary },
  choiceTextKept: { color: Coach.stage },
  choiceGhost: { paddingHorizontal: 14, paddingVertical: 11 },
  choiceGhostText: { ...Type.bodyEmph, color: Colors.ink.muted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg.void,
  },
  cta: {
    backgroundColor: Coach.stage,
    borderRadius: Radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: Coach.stageInk },
});
