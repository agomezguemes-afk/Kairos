import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

import { useUserProfile } from '../../context/UserProfileContext';
import { useWorkoutStore } from '../../store/workoutStore';
import { useCoachStore } from '../../store/coachStore';
import { QUALITY_LABEL, SPORT_LABEL } from '../../lib/adaptive';
import { Brut, Spacing } from '../../theme/tokens';
import { SHOW_AI_LAB, SHOW_ENGINE_DEBUG } from '../../config/constants';
import { BBox, BPress, BScreen, BText } from '../../features/coach/ui/brut';
import { HealthCard } from '../../features/coach/HealthCard';

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, resetProfile } = useUserProfile();
  const notificationsEnabled = useWorkoutStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useWorkoutStore((s) => s.setNotificationsEnabled);
  const goal = useCoachStore((s) => s.goal);
  const resetCoach = useCoachStore((s) => s.reset);

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
          <BText variant="monoBold" size={10}>
            TU OBJETIVO
          </BText>
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
          {SHOW_ENGINE_DEBUG && (
            <BPress
              onPress={() => navigation.navigate('Brain')}
              bg={Brut.accent}
              radius={12}
              style={{ marginTop: Spacing.md }}
              contentStyle={styles.action}
              accessibilityRole="button"
            >
              <BText variant="bodyBold" size={15}>
                Ver tu cerebro
              </BText>
            </BPress>
          )}
          {SHOW_AI_LAB && (
            <BPress
              onPress={() => navigation.navigate('AiLab')}
              radius={12}
              style={{ marginTop: Spacing.md }}
              contentStyle={styles.action}
              accessibilityRole="button"
            >
              <BText variant="bodyBold" size={15}>
                Laboratorio IA
              </BText>
            </BPress>
          )}
        </BBox>

        <HealthCard />

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
              Banda de pulso, cadencia y potencia por Bluetooth, en directo durante la sesión.
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg },
  title: { marginTop: Spacing.sm },
  card: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
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
  actions: { gap: Spacing.sm, marginTop: Spacing.xl },
  action: {
    height: 50,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
