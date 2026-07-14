// SessionOverviewSheet — the full exercise list, one tap away from the
// scoreboard (spec: "la lista completa tras un tap"). Read-only glance:
// every exercise with its per-set dots and completed values. Navigation
// stays on the scoreboard (swipe) — this layer answers "¿cuánto queda?",
// it doesn't move the session. Hosts the "Añadir ejercicio" affordance
// that left the main view.

import React, { useCallback } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import KIcon from '../icons/KIcon';
import { Colors, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import type { ExerciseCard, ExerciseSet, FieldDefinition } from '../../types/core';

interface Props {
  visible: boolean;
  exercises: ExerciseCard[];
  currentExerciseIndex: number;
  onAddExercise: () => void;
  onClose: () => void;
}

// "60 kg · 8" from a completed set — same walk as the old inline summary.
function setSummary(set: ExerciseSet, fields: FieldDefinition[]): string {
  const parts: string[] = [];
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  for (const f of sorted) {
    const v = set.values[f.id];
    if (v == null || v === '') continue;
    parts.push(f.unit ? `${v} ${f.unit}` : String(v));
  }
  return parts.join(' · ');
}

function SessionOverviewSheetImpl({
  visible,
  exercises,
  currentExerciseIndex,
  onAddExercise,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const handleAdd = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onAddExercise();
  }, [onAddExercise]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar lista de ejercicios"
        />
        <Animated.View
          entering={
            reduceMotion
              ? FadeIn.duration(200)
              : SlideInDown.duration(280).easing(Easing.out(Easing.cubic))
          }
          exiting={
            reduceMotion
              ? FadeOut.duration(160)
              : SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))
          }
          style={[styles.sheet, { paddingBottom: Spacing.lg + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Sesión</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {exercises.map((ex, i) => {
              const done = ex.sets.filter((s) => s.completed).length;
              const isCurrent = i === currentExerciseIndex;
              const complete = ex.sets.length > 0 && done === ex.sets.length;
              return (
                <View
                  key={ex.id}
                  style={[styles.exRow, isCurrent && styles.exRowCurrent]}
                  accessible
                  accessibilityLabel={`${ex.name}, ${done} de ${ex.sets.length} sets${
                    isCurrent ? ', ejercicio actual' : complete ? ', completado' : ''
                  }`}
                >
                  <View
                    style={[
                      styles.exDot,
                      complete && styles.exDotDone,
                      isCurrent && !complete && styles.exDotCurrent,
                    ]}
                  />
                  <View style={styles.exBody}>
                    <Text
                      style={[styles.exName, isCurrent && styles.exNameCurrent]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.6}
                    >
                      {ex.name}
                    </Text>
                    {ex.sets.map((s, j) => {
                      const summary = s.completed ? setSummary(s, ex.fields) : '';
                      return s.completed && summary ? (
                        <Text
                          key={s.id}
                          style={styles.setLine}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.6}
                        >
                          {j + 1} · {summary}
                        </Text>
                      ) : null;
                    })}
                  </View>
                  <Text style={styles.exCount} maxFontSizeMultiplier={1.6}>
                    {done}/{ex.sets.length}
                  </Text>
                </View>
              );
            })}

            <Pressable
              onPress={handleAdd}
              accessibilityRole="button"
              accessibilityLabel="Añadir ejercicio a la sesión"
              style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.6 }]}
            >
              <KIcon name="plus" size={14} color={Colors.ink.secondary} />
              <Text style={styles.addText} maxFontSizeMultiplier={1.6}>
                Añadir ejercicio
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const SessionOverviewSheet = React.memo(SessionOverviewSheetImpl);
export default SessionOverviewSheet;

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Colors.background.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    maxHeight: '80%',
    ...Shadows.modal,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  title: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    marginBottom: Spacing.sm,
  },
  body: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  exRowCurrent: {
    backgroundColor: Colors.bg.warm,
  },
  exDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6, // optical alignment with the first text line
    borderWidth: 1.5,
    borderColor: Colors.hair.strong,
    backgroundColor: Colors.bg.void,
  },
  exDotDone: {
    backgroundColor: Colors.semantic.success,
    borderColor: Colors.semantic.success,
  },
  exDotCurrent: {
    borderColor: Colors.gold.base,
    borderWidth: 2,
  },
  exBody: {
    flex: 1,
    gap: 2,
  },
  exName: {
    ...Type.body,
    color: Colors.ink.secondary,
  },
  exNameCurrent: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
  },
  setLine: {
    ...Type.caption,
    color: Colors.ink.muted,
    fontVariant: ['tabular-nums'],
  },
  exCount: {
    ...Type.numSmall,
    color: Colors.ink.tertiary,
    marginTop: 2,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addText: {
    ...Type.caption,
    color: Colors.ink.secondary,
    fontWeight: '600',
  },
});
