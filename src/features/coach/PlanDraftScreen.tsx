// PlanDraft — the drafted week as proposals. Each session is kept or
// discarded by the user; only kept sessions become the active plan.

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import type { RootStackParamList } from '../../types/navigation';
import KIcon from '../../components/icons/KIcon';
import { getMovement, type DraftSession, type DraftStatus } from '../../lib/adaptive';
import { useCoachStore } from '../../store/coachStore';
import { Brut, Spacing } from '../../theme/tokens';
import { feedback } from './feedback';
import { describeTarget } from './format';
import { BBox, BPress, BScreen, BTag, BText } from './ui/brut';

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
        .duration(Brut.motion.reveal)
        .springify()
        .damping(18)}
      layout={LinearTransition.duration(Brut.motion.tab)}
      style={{ opacity: dropped ? 0.5 : 1 }}
    >
      <BBox
        shadow={dropped ? 0 : Brut.shadow.md}
        shadowColor={kept ? Brut.accent : undefined}
        dashed={dropped}
        radius={Brut.radius.xl}
        contentStyle={styles.card}
      >
        <View style={styles.cardHead}>
          <BTag bg={kept ? Brut.accent : 'transparent'}>{`DÍA ${session.slot + 1}`}</BTag>
          <BText variant="monoBold" size={11} color={Brut.muted}>
            {session.durationMin} MIN
          </BText>
        </View>
        <BText
          variant="display"
          size={28}
          color={dropped ? Brut.muted : Brut.ink}
          style={[{ marginTop: Spacing.sm }, dropped && styles.strike]}
        >
          {session.title.toUpperCase()}
        </BText>
        {!dropped && (
          <>
            <BText size={14} color={Brut.muted} style={{ marginTop: 4 }}>
              {session.rationale}
            </BText>
            <View style={styles.movements}>
              {session.movements.map((pm, i) => {
                const m = getMovement(pm.movementId);
                if (!m) return null;
                return (
                  <View key={pm.movementId} style={[styles.movementRow, i > 0 && styles.rule]}>
                    {/* Name keeps at least half the row; long targets wrap instead of
                        truncating the exercise name to "Do…". */}
                    <BText variant="bodySemi" size={14} style={styles.moveName}>
                      {m.name}
                    </BText>
                    <BText variant="mono" size={11} style={styles.moveTarget}>
                      {describeTarget(m, pm.target)}
                    </BText>
                  </View>
                );
              })}
            </View>
          </>
        )}
        <View style={styles.cardActions}>
          <BPress
            onPress={() => {
              feedback.tick();
              onSet(session.id, kept ? 'pending' : 'accepted');
            }}
            bg={kept ? Brut.accent : Brut.surface}
            radius={12}
            style={{ flex: 1 }}
            contentStyle={styles.choice}
            accessibilityRole="button"
            accessibilityState={{ selected: kept }}
          >
            {kept && <KIcon name="unlock" size={16} color={Brut.ink} strokeWidth={2.2} />}
            <BText variant="bodyBold" size={15}>
              {kept ? 'Me la quedo' : 'Me sirve'}
            </BText>
          </BPress>
          <BPress
            onPress={() => {
              feedback.tick();
              onSet(session.id, dropped ? 'pending' : 'rejected');
            }}
            radius={12}
            shadow={2}
            contentStyle={styles.choiceGhost}
            accessibilityRole="button"
            accessibilityState={{ selected: dropped }}
          >
            <BText variant="bodyBold" size={15} color={Brut.muted}>
              {dropped ? 'Recuperar' : 'Descartar'}
            </BText>
          </BPress>
        </View>
      </BBox>
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
      <BScreen style={styles.center}>
        <BText color={Brut.muted}>No hay borrador todavía.</BText>
      </BScreen>
    );
  }

  const kept = plan.sessions.filter((s) => s.status === 'accepted').length;
  const keepAll = () => {
    feedback.light();
    plan.sessions.forEach((s) => s.status === 'pending' && setDraftStatus(s.id, 'accepted'));
  };

  return (
    <BScreen>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.topRow}>
          <BPress
            onPress={() => navigation.goBack()}
            radius={12}
            contentStyle={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <BText variant="bodyBold" size={18} upright>
              ←
            </BText>
          </BPress>
          <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
            BORRADOR · {plan.sessions.length} SESIONES
          </BText>
        </View>

        <BText variant="display" size={48} style={{ marginTop: Spacing.lg }}>
          TU SEMANA,{'\n'}PROPUESTA.
        </BText>
        <BBox
          shadow={0}
          bg={Brut.accentSoft}
          style={{ marginTop: Spacing.md }}
          contentStyle={styles.quote}
        >
          <BText variant="monoBold" size={10} color={Brut.muted}>
            TU OBJETIVO
          </BText>
          <BText variant="bodySemi" size={16} style={{ marginTop: 4 }}>
            «{plan.goal.summary ?? plan.goal.raw}»
          </BText>
        </BBox>
        <BText size={14} color={Brut.muted} style={{ marginTop: Spacing.md }}>
          Un punto de partida, no una orden. Quédate con lo que te sirva; el resto lo aprenderé de
          cómo entrenas.
        </BText>
        <BPress
          onPress={keepAll}
          shadow={2}
          radius={10}
          style={{ alignSelf: 'flex-start', marginTop: Spacing.md }}
          contentStyle={styles.keepAll}
          accessibilityRole="button"
        >
          <BText variant="monoBold" size={11}>
            QUEDARME TODAS
          </BText>
        </BPress>
        <View style={styles.list}>
          {plan.sessions.map((s, i) => (
            <DraftCard key={s.id} session={s} index={i} onSet={onSet} />
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <BPress
          disabled={kept === 0}
          onPress={() => {
            feedback.success();
            navigation.navigate('Dashboard', { screen: 'CoachTab' });
          }}
          bg={Brut.ink}
          shadowColor={Brut.accent}
          shadow={Brut.shadow.md}
          radius={Brut.radius.xl}
          contentStyle={styles.cta}
          accessibilityRole="button"
        >
          <BText variant="bodyBold" size={17} color={Brut.bg}>
            {kept === 0
              ? 'Elige al menos una sesión'
              : `Activar ${kept} ${kept === 1 ? 'sesión' : 'sesiones'}`}
          </BText>
        </BPress>
      </View>
    </BScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 140 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  quote: { padding: Spacing.md },
  keepAll: { paddingHorizontal: 10, paddingVertical: 8 },
  list: { gap: Spacing.md, marginTop: Spacing.xl },
  card: { padding: Spacing.lg },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strike: { textDecorationLine: 'line-through' },
  movements: {
    marginTop: Spacing.md,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    borderRadius: 10,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rule: { borderTopWidth: 1, borderTopColor: Brut.ink },
  moveName: { flexGrow: 1, flexBasis: '50%', flexShrink: 0 },
  moveTarget: { flexShrink: 1, textAlign: 'right' },
  cardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  choice: {
    height: 46,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceGhost: {
    height: 46,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Brut.bg,
  },
  cta: { height: 60, alignItems: 'center', justifyContent: 'center' },
});
