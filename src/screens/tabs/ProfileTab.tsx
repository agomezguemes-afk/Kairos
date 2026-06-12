import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUserProfile } from '../../context/UserProfileContext';
import { useWorkoutStore } from '../../store/workoutStore';
import ImportDataSheet from '../../components/ImportDataSheet';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme/index';

export default function ProfileTab() {
  const { profile, resetProfile } = useUserProfile();
  const notificationsEnabled = useWorkoutStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useWorkoutStore((s) => s.setNotificationsEnabled);
  const [importOpen, setImportOpen] = useState(false);

  const handleReset = () => {
    Alert.alert(
      'Reiniciar onboarding',
      'Esto borrará tu perfil y volverás a la pantalla de bienvenida. Los bloques de entrenamiento no se perderán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: async () => {
            await resetProfile();
            // The navigator will automatically switch to the onboarding stack
            // because isOnboardingComplete becomes false.
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>

      {/* User info summary */}
      {profile.primaryGoal && (
        <View style={styles.card}>
          <Feather name="target" size={20} color={Colors.accent.primary} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{profile.displayName ?? 'Usuario'}</Text>
            <Text style={styles.cardSub}>
              {profile.fitnessLevel ?? '—'} · {profile.weeklyFrequency ?? 0} días/semana
            </Text>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Feather name="settings" size={20} color={Colors.text.secondary} />
        <Text style={styles.cardTitle}>Configuración</Text>
        <Feather
          name="chevron-right"
          size={18}
          color={Colors.text.tertiary}
          style={styles.chevron}
        />
      </View>

      {/* Notifications opt-in toggle */}
      <View style={styles.card}>
        <Feather name="bell" size={20} color={Colors.text.secondary} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Notificaciones</Text>
          <Text style={styles.cardSub}>
            Recordatorios de sesiones y nudges suaves tras 36h sin entrenar.
          </Text>
        </View>
        <Switch
          value={notificationsEnabled === true}
          onValueChange={setNotificationsEnabled}
          trackColor={{ false: Colors.hair.base, true: Colors.gold.base }}
          thumbColor={Colors.bg.surface}
          accessibilityLabel="Activar notificaciones locales"
        />
      </View>

      <View style={styles.card}>
        <Feather name="link" size={20} color={Colors.text.secondary} />
        <Text style={styles.cardTitle}>Integraciones</Text>
        <Feather
          name="chevron-right"
          size={18}
          color={Colors.text.tertiary}
          style={styles.chevron}
        />
      </View>

      {/* Import external data (Strong / Hevy CSV) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Importar datos de Strong o Hevy"
        onPress={() => setImportOpen(true)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        <Feather name="download" size={20} color={Colors.text.secondary} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Importar datos</Text>
          <Text style={styles.cardSub}>Trae tu historial desde Strong o Hevy (CSV).</Text>
        </View>
        <Feather
          name="chevron-right"
          size={18}
          color={Colors.text.tertiary}
          style={styles.chevron}
        />
      </Pressable>

      <ImportDataSheet visible={importOpen} onClose={() => setImportOpen(false)} />

      {/* Dev: reset onboarding */}
      <Pressable
        onPress={handleReset}
        style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.7 }]}
      >
        <Feather name="refresh-cw" size={16} color={Colors.text.tertiary} />
        <Text style={styles.resetText}>Reiniciar onboarding</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          // TODO: real logout
          handleReset();
        }}
        style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}
      >
        <Feather name="log-out" size={18} color={Colors.semantic.error} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.void,
    paddingHorizontal: Spacing.screen.horizontal,
    paddingTop: Spacing.screen.top,
  },
  title: {
    fontSize: Typography.size.title,
    fontWeight: Typography.weight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing['3xl'],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.gap.cards,
    ...Shadows.subtle,
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    flex: 1,
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  cardSub: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  chevron: {
    marginLeft: 'auto',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
  },
  resetText: {
    fontSize: Typography.size.caption,
    color: Colors.text.tertiary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.semantic.errorMuted,
    ...Shadows.subtle,
  },
  logoutText: {
    fontSize: Typography.size.subheading,
    fontWeight: Typography.weight.semibold,
    color: Colors.semantic.error,
  },
});
