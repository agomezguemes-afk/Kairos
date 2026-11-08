// SuggestionReveal — where finished training turns into sealed proposals.
// Shown right after a session (with its summary) or from the Coach tab
// when cards are still waiting.

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import { edwardsTrimp, sessionLoad, type MovementTarget } from '../../lib/adaptive';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import UnlockCard from './components/UnlockCard';
import { BBox, BPress, BScreen, BText } from './ui/brut';

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
      ? 'TODO EN ORDEN.'
      : locked > 0
        ? `${locked} ${locked === 1 ? 'PROPUESTA SELLADA' : 'PROPUESTAS SELLADAS'}`
        : 'TÚ DECIDES.';

  return (
    <BScreen>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <Animated.View entering={FadeInDown.duration(Brut.motion.reveal)}>
          <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
            KAIROS{' '}
            <BText variant="mono" size={11} color={Brut.muted}>
              / {session ? 'ENTRENO GUARDADO' : 'PROPUESTAS'}
            </BText>
          </BText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(60).duration(Brut.motion.reveal)}>
          <BText variant="display" size={46} style={{ marginTop: Spacing.sm }}>
            {headline}
          </BText>
        </Animated.View>

        {session && (
          <Animated.View
            entering={FadeInDown.delay(120).duration(Brut.motion.reveal)}
            style={styles.stats}
          >
            <Stat index="01" label="TIEMPO" value={`${session.durationMin}`} unit="MIN" hot />
            <Stat index="02" label="ESFUERZO" value={`${session.rpe}`} unit="/10" />
            <Stat index="03" label="CARGA" value={`${sessionLoad(session)}`} unit="UA" />
            {session.sensors?.hrAvg !== undefined && (
              <Stat index="04" label="PULSO" value={`${session.sensors.hrAvg}`} unit="PPM" />
            )}
            {session.sensors?.zoneSeconds && (
              <Stat
                index="05"
                label="TRIMP"
                value={`${edwardsTrimp(session.sensors.zoneSeconds)}`}
                unit=""
              />
            )}
          </Animated.View>
        )}

        {shown.length === 0 ? (
          <BBox shadow={0} dashed style={{ marginTop: Spacing.xl }} contentStyle={styles.empty}>
            <BText size={15}>
              {session
                ? 'Hoy no cambio nada: necesito ver un patrón antes de proponerte algo. Cada sesión que registras afina la siguiente propuesta.'
                : 'No tienes propuestas pendientes.'}
            </BText>
          </BBox>
        ) : (
          <View style={styles.cards}>
            {shown.map((s, i) => (
              <Animated.View
                key={s.id}
                entering={FadeInDown.delay(200 + i * 110)
                  .duration(Brut.motion.reveal)
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
        <BPress
          onPress={() => navigation.navigate('Dashboard', { screen: 'CoachTab' })}
          bg={locked > 0 ? Brut.surface : Brut.ink}
          shadowColor={locked > 0 ? Brut.ink : Brut.accent}
          shadow={Brut.shadow.md}
          radius={Brut.radius.xl}
          contentStyle={styles.done}
          accessibilityRole="button"
        >
          <BText variant="bodyBold" size={17} color={locked > 0 ? Brut.ink : Brut.bg}>
            {locked > 0 ? 'Más tarde' : 'Listo'}
          </BText>
        </BPress>
      </View>
    </BScreen>
  );
}

const Stat = React.memo(function Stat({
  index,
  label,
  value,
  unit,
  hot,
}: {
  index: string;
  label: string;
  value: string;
  unit: string;
  hot?: boolean;
}) {
  return (
    <BBox bg={hot ? Brut.accent : Brut.surface} radius={Brut.radius.md} contentStyle={styles.stat}>
      <BText variant="monoBold" size={10} color={hot ? Brut.onAccent : Brut.muted}>
        {index} {label}
      </BText>
      <BText variant="display" size={28}>
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
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.lg },
  stat: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, minWidth: 92 },
  empty: { padding: Spacing.lg },
  cards: { gap: Spacing.lg, marginTop: Spacing.xl },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Brut.bg,
  },
  done: { height: 58, alignItems: 'center', justifyContent: 'center' },
});
