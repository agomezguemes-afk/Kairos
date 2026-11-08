// SuggestionReveal — where finished training turns into sealed proposals.
// Shown right after a session (with its summary) or from the Coach tab
// when cards are still waiting.

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { edwardsTrimp, sessionLoad, type MovementTarget } from '../../lib/adaptive';
import { useCoachStore } from '../../store/coachStore';
import { Coach, Colors, Radius, Spacing, Type } from '../../theme/tokens';
import UnlockCard from './components/UnlockCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SuggestionRevealScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'SuggestionReveal'>>();
  const sessionId = params?.sessionId;
  const suggestions = useCoachStore((s) => s.suggestions);
  const sessions = useCoachStore((s) => s.sessions);
  const reveal = useCoachStore((s) => s.revealSuggestion);
  const resolve = useCoachStore((s) => s.resolveSuggestion);

  // Freeze which cards this screen is about, so resolving one doesn't make
  // it vanish mid-animation; it collapses into a "done" row instead.
  const [ids] = useState(
    () =>
      new Set(
        useCoachStore
          .getState()
          .suggestions.filter((s) =>
            sessionId
              ? s.sessionId === sessionId
              : s.status === 'locked' || s.status === 'revealed',
          )
          .map((s) => s.id),
      ),
  );
  const shown = useMemo(() => suggestions.filter((s) => ids.has(s.id)), [ids, suggestions]);
  const session = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
  const locked = shown.filter((s) => s.status === 'locked').length;

  const onResolve = useCallback(
    (
      id: string,
      outcome: 'accepted' | 'adjusted' | 'dismissed',
      override?: Partial<MovementTarget>,
    ) => resolve(id, outcome, override),
    [resolve],
  );

  const headline =
    shown.length === 0
      ? 'Todo en orden.'
      : locked > 0
        ? `${locked} ${locked === 1 ? 'propuesta' : 'propuestas'} por desbloquear`
        : 'Tú decides.';

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <Animated.Text entering={FadeInDown.springify().damping(18)} style={styles.eyebrow}>
          {session ? 'ENTRENO GUARDADO' : 'PROPUESTAS'}
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(60).springify().damping(18)}
          style={styles.display}
        >
          {headline}
        </Animated.Text>

        {session && (
          <Animated.View
            entering={FadeInDown.delay(120).springify().damping(18)}
            style={styles.stats}
          >
            <Stat label="Tiempo" value={`${session.durationMin}`} unit="min" />
            <Stat label="Esfuerzo" value={`${session.rpe}`} unit="/10" />
            <Stat label="Carga" value={`${sessionLoad(session)}`} unit="UA" />
            {session.sensors?.hrAvg !== undefined && (
              <Stat label="Pulso medio" value={`${session.sensors.hrAvg}`} unit="ppm" />
            )}
            {session.sensors?.zoneSeconds && (
              <Stat label="TRIMP" value={`${edwardsTrimp(session.sensors.zoneSeconds)}`} unit="" />
            )}
          </Animated.View>
        )}

        {shown.length === 0 ? (
          <Text style={styles.empty}>
            {session
              ? 'Hoy no cambio nada: necesito ver un patrón antes de proponerte algo. Cada sesión que registras afina la siguiente propuesta.'
              : 'No tienes propuestas pendientes.'}
          </Text>
        ) : (
          <View style={styles.cards}>
            {shown.map((s, i) => (
              <Animated.View
                key={s.id}
                entering={FadeInDown.delay(200 + i * 110)
                  .springify()
                  .damping(17)}
              >
                <UnlockCard suggestion={s} onReveal={reveal} onResolve={onResolve} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.navigate('Dashboard', { screen: 'CoachTab' })}
          style={styles.done}
          accessibilityRole="button"
        >
          <Text style={styles.doneText}>{locked > 0 ? 'Más tarde' : 'Listo'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const Stat = React.memo(function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}>{unit ? ` ${unit}` : ''}</Text>
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Coach.stage },
  content: { paddingHorizontal: Spacing.xl },
  eyebrow: { ...Type.micro, color: Colors.gold.base, letterSpacing: 2, fontWeight: '700' },
  display: { ...Coach.display, color: Coach.stageInk, marginTop: Spacing.sm },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Coach.stageLine,
  },
  stat: { minWidth: 72 },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Coach.stageInk,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  statUnit: { fontSize: 13, fontWeight: '600', color: Coach.stageMuted },
  statLabel: { ...Type.micro, color: Coach.stageMuted, marginTop: 2 },
  empty: { ...Type.body, color: Coach.stageMuted, marginTop: Spacing.xl },
  cards: { gap: Spacing.lg, marginTop: Spacing.xl },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Coach.stage,
  },
  done: {
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Coach.stageLine,
  },
  doneText: { fontSize: 16, fontWeight: '700', color: Coach.stageInk },
});
