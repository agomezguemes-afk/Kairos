// KAIROS — ImportDataSheet
// Paste-based CSV import for Strong / Hevy exports. Three-step flow inside
// one bottom sheet: paste → preview (counts + range, nothing committed) →
// confirm. Paste-first keeps it dependency-free; a document picker can layer
// on later without touching the parse/commit pipeline.

import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  parseWorkoutCsv,
  buildPreview,
  toHistoryEntries,
  ImportFormatError,
  type ImportParseResult,
  type ImportPreview,
} from '../lib/import';
import { useWorkoutStore } from '../store/workoutStore';
import { Colors, Type, Spacing, Radius, Shadows } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step =
  | { kind: 'input' }
  | { kind: 'preview'; result: ImportParseResult; preview: ImportPreview }
  | { kind: 'done'; added: number; skipped: number };

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ImportDataSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const importWorkoutHistory = useWorkoutStore((s) => s.importWorkoutHistory);

  const [raw, setRaw] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'input' });
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setRaw('');
    setStep({ kind: 'input' });
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleAnalyze = useCallback(() => {
    setError(null);
    try {
      const result = parseWorkoutCsv(raw);
      if (result.workouts.length === 0) {
        setError('El archivo no contiene entrenamientos legibles.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setStep({ kind: 'preview', result, preview: buildPreview(result) });
    } catch (e) {
      setError(
        e instanceof ImportFormatError
          ? e.message
          : 'No se pudo leer el archivo. Comprueba que es el CSV exportado.',
      );
    }
  }, [raw]);

  const handleConfirm = useCallback(() => {
    if (step.kind !== 'preview') return;
    const entries = toHistoryEntries(step.result.workouts);
    const added = importWorkoutHistory(entries);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setStep({ kind: 'done', added, skipped: entries.length - added });
  }, [step, importWorkoutHistory]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View entering={FadeIn.duration(180)} style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.kav}
        >
          <Animated.View
            entering={SlideInDown.duration(280)}
            exiting={SlideOutDown.duration(220)}
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
          >
            <View style={styles.grabber} />
            <Text style={styles.eyebrow}>Importar datos</Text>

            {step.kind === 'input' && (
              <>
                <Text style={styles.title}>Trae tu historial de Strong o Hevy</Text>
                <Text style={styles.body}>
                  Exporta el CSV desde la otra app (Ajustes → Exportar datos), ábrelo, copia todo el
                  texto y pégalo aquí.
                </Text>
                <TextInput
                  value={raw}
                  onChangeText={setRaw}
                  placeholder="Pega aquí el contenido del CSV…"
                  placeholderTextColor={Colors.ink.muted}
                  style={styles.input}
                  multiline
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Contenido del CSV"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Analizar datos pegados"
                  onPress={handleAnalyze}
                  disabled={raw.trim().length === 0}
                  style={({ pressed }) => [
                    styles.cta,
                    raw.trim().length === 0 && styles.ctaDisabled,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.ctaText}>Analizar</Text>
                </Pressable>
              </>
            )}

            {step.kind === 'preview' && (
              <>
                <Text style={styles.title}>
                  {step.preview.format === 'strong' ? 'Strong' : 'Hevy'} detectado
                </Text>
                <View style={styles.statsCard}>
                  <StatRow label="Entrenamientos" value={String(step.preview.workoutCount)} />
                  <StatRow
                    label="Ejercicios distintos"
                    value={String(step.preview.exerciseCount)}
                  />
                  <StatRow label="Series" value={String(step.preview.setCount)} />
                  {step.preview.dateRange ? (
                    <StatRow
                      label="Periodo"
                      value={`${formatDate(step.preview.dateRange.from)} – ${formatDate(step.preview.dateRange.to)}`}
                    />
                  ) : null}
                </View>
                {step.preview.warnings.length > 0 ? (
                  <Text style={styles.warning}>
                    {step.preview.warnings.length} fila(s) ignoradas por datos ilegibles.
                  </Text>
                ) : null}
                <Text style={styles.body}>
                  Nada se guarda todavía. Al confirmar, las sesiones se añaden a tu historial y
                  alimentan récords, fantasmas de peso y gráficas.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar importación"
                  onPress={handleConfirm}
                  style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.ctaText}>Importar {step.preview.workoutCount} sesiones</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Volver"
                  onPress={() => setStep({ kind: 'input' })}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostText}>Volver</Text>
                </Pressable>
              </>
            )}

            {step.kind === 'done' && (
              <>
                <View style={styles.doneIcon}>
                  <Feather name="check" size={28} color={Colors.gold.deep} />
                </View>
                <Text style={styles.title}>
                  {step.added > 0 ? `${step.added} sesiones importadas` : 'Nada nuevo que importar'}
                </Text>
                <Text style={styles.body}>
                  {step.skipped > 0 ? `${step.skipped} ya existían y se omitieron. ` : ''}
                  {step.added > 0
                    ? 'Tu historial, récords y referencias de peso ya las tienen en cuenta.'
                    : 'Estas sesiones ya estaban en tu historial.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  onPress={handleClose}
                  style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.ctaText}>Hecho</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.paper.scrim,
    justifyContent: 'flex-end',
  },
  kav: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    gap: Spacing.md,
    ...Shadows.modal,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.xs,
  },
  eyebrow: {
    ...Type.eyebrow,
    color: Colors.gold.deep,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
  body: {
    ...Type.body,
    color: Colors.ink.tertiary,
  },
  input: {
    minHeight: 120,
    maxHeight: 180,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair.base,
    backgroundColor: Colors.bg.elevated,
    padding: Spacing.md,
    ...Type.caption,
    color: Colors.ink.primary,
    textAlignVertical: 'top',
  },
  error: {
    ...Type.caption,
    color: Colors.semantic.error,
  },
  warning: {
    ...Type.caption,
    color: Colors.semantic.warning,
  },
  statsCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.warm,
    borderWidth: 1,
    borderColor: Colors.hair.gold,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  statLabel: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  statValue: {
    ...Type.numSmall,
    color: Colors.ink.primary,
  },
  cta: {
    minHeight: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.cardWarm,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    ...Type.subheading,
    color: Colors.ink.primary,
  },
  ghostBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    ...Type.caption,
    color: Colors.ink.tertiary,
  },
  doneIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
