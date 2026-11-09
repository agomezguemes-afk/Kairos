import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserProfile } from '../../context/UserProfileContext';
import { useWorkoutStore } from '../../store/workoutStore';
import { useCoachStore } from '../../store/coachStore';
import { QUALITY_LABEL, SPORT_LABEL } from '../../lib/adaptive';
import { Brut, Spacing } from '../../theme/tokens';
import { BBox, BPress, BScreen, BTag, BText } from '../../features/coach/ui/brut';

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const { profile, resetProfile } = useUserProfile();
  const notificationsEnabled = useWorkoutStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useWorkoutStore((s) => s.setNotificationsEnabled);
  const goal = useCoachStore((s) => s.goal);
  const sessions = useCoachStore((s) => s.sessions);
  const suggestions = useCoachStore((s) => s.suggestions);
  const resetCoach = useCoachStore((s) => s.reset);

  // "What Kairos knows about you": every number the coach reasons from,
  // so the user can see the proposals are built on their own data.
  const known = useMemo(() => {
    const sets = sessions.reduce(
      (n, s) => n + s.movements.reduce((m, mv) => m + mv.sets.filter((x) => x.completed).length, 0),
      0,
    );
    const minutes = sessions.reduce((n, s) => n + s.durationMin, 0);
    const withSensors = sessions.filter((s) => s.sensors?.hrAvg !== undefined).length;
    const applied = suggestions.filter(
      (s) => s.status === 'accepted' || s.status === 'adjusted',
    ).length;
    return { sets, minutes, withSensors, applied };
  }, [sessions, suggestions]);

  const handleReset = () => {
    Alert.alert(
      'Reiniciar onboarding',
      'Esto borrará tu perfil y volverás a la pantalla de bienvenida. Los bloques de entrenamiento no se perderán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', style: 'destructive', onPress: () => void resetProfile() },
      ],
    );
  };

  const handleResetCoach = () => {
    Alert.alert(
      'Borrar datos del coach',
      'Se borran tu objetivo, tus sesiones registradas y las propuestas. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: resetCoach },
      ],
    );
  };

  return (
    <BScreen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <BText variant="monoBold" size={11} style={{ letterSpacing: 2 }}>
          KAIROS{' '}
          <BText variant="mono" size={11} color={Brut.muted}>
            / TÚ
          </BText>
        </BText>
        <BText variant="display" size={44} style={styles.title}>
          {(profile.displayName ?? 'TÚ').toUpperCase()}
        </BText>
        {profile.fitnessLevel && (
          <BText variant="mono" size={11} color={Brut.muted}>
            {`${profile.fitnessLevel} · ${profile.weeklyFrequency ?? 0} DÍAS/SEM`.toUpperCase()}
          </BText>
        )}

        <BBox style={{ marginTop: Spacing.lg }} contentStyle={styles.card}>
          <View style={styles.rowBetween}>
            <BText variant="monoBold" size={10}>
              LO QUE KAIROS SABE DE TI
            </BText>
            <BTag>EN ESTE MÓVIL</BTag>
          </View>
          {goal ? (
            <BText variant="bodySemi" size={15} style={{ marginTop: Spacing.sm }}>
              «{goal.summary ?? goal.raw}»
            </BText>
          ) : (
            <BText size={14} color={Brut.muted} style={{ marginTop: Spacing.sm }}>
              Aún no tienes objetivo. Cuéntaselo al coach desde «Hoy».
            </BText>
          )}
          {goal && (
            <BText variant="mono" size={10} color={Brut.muted} style={{ marginTop: 4 }}>
              {[
                ...goal.sports.map((s) => SPORT_LABEL[s]),
                ...goal.qualities.map((q) => QUALITY_LABEL[q]),
              ]
                .join(' · ')
                .toUpperCase()}
            </BText>
          )}
          <View style={styles.grid}>
            <Known index="01" label="SESIONES" value={sessions.length} />
            <Known index="02" label="SERIES" value={known.sets} />
            <Known index="03" label="MINUTOS" value={known.minutes} />
            <Known index="04" label="CON SENSOR" value={known.withSensors} />
            <Known index="05" label="PROPUESTAS" value={suggestions.length} />
            <Known index="06" label="APLICADAS" value={known.applied} />
          </View>
          <BText size={13} color={Brut.muted} style={{ marginTop: Spacing.sm }}>
            Cada propuesta sale de estos datos. Nada se inventa ni sale de tu móvil sin que lo
            decidas.
          </BText>
        </BBox>

        <BBox style={{ marginTop: Spacing.md }} contentStyle={[styles.card, styles.row]}>
          <View style={styles.iconBox}>
            <Feather name="bell" size={18} color={Brut.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <BText variant="bodyBold" size={15}>
              Notificaciones
            </BText>
            <BText size={13} color={Brut.muted}>
              Recordatorios de sesiones y un aviso suave tras 36 h sin entrenar.
            </BText>
          </View>
          <Switch
            value={notificationsEnabled === true}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: 'rgba(18,18,17,0.2)', true: Brut.accent }}
            thumbColor={Brut.surface}
            accessibilityLabel="Activar notificaciones locales"
          />
        </BBox>

        <BBox style={{ marginTop: Spacing.md }} contentStyle={[styles.card, styles.row]}>
          <View style={styles.iconBox}>
            <Feather name="activity" size={18} color={Brut.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <BText variant="bodyBold" size={15}>
              Sensores
            </BText>
            <BText size={13} color={Brut.muted}>
              Banda de pulso, cadencia y potencia por Bluetooth. Apple Watch, con la app de watchOS.
            </BText>
          </View>
        </BBox>

        <View style={styles.actions}>
          <BPress
            onPress={handleResetCoach}
            radius={Brut.radius.md}
            contentStyle={styles.action}
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={16} color={Brut.ink} />
            <BText variant="bodyBold" size={15}>
              Borrar datos del coach
            </BText>
          </BPress>
          <BPress
            onPress={handleReset}
            radius={Brut.radius.md}
            shadow={2}
            contentStyle={styles.action}
            accessibilityRole="button"
          >
            <Feather name="refresh-cw" size={16} color={Brut.muted} />
            <BText variant="bodySemi" size={14} color={Brut.muted}>
              Reiniciar onboarding
            </BText>
          </BPress>
        </View>
      </ScrollView>
    </BScreen>
  );
}

function Known({ index, label, value }: { index: string; label: string; value: number }) {
  return (
    <View style={styles.cell}>
      <View style={styles.cellBox}>
        <BText variant="monoBold" size={9} color={Brut.muted}>
          {index} {label}
        </BText>
        <BText variant="display" size={26}>
          {value}
        </BText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg },
  title: { marginTop: Spacing.sm },
  card: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    backgroundColor: Brut.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md, marginHorizontal: -3 },
  cell: { width: '33.33%', padding: 3 },
  cellBox: {
    borderWidth: Brut.border,
    borderColor: Brut.ink,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  actions: { gap: Spacing.sm, marginTop: Spacing.xl },
  action: {
    height: 50,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
