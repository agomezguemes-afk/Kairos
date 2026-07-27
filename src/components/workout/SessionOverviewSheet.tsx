// SessionOverviewSheet — the full exercise list, one tap away from the
// scoreboard (spec: "la lista completa tras un tap"). Read-only glance:
// "¿cuánto queda?" answered without scroll (header counts + gold progress
// bar), then an app-style accordion — one exercise expanded at a time,
// default the current one — instead of the old wall-of-text (every set of
// every exercise open simultaneously). Navigation stays on the scoreboard
// (swipe); this layer never moves the session. Hosts the "Añadir ejercicio"
// affordance that left the main view.

import React, { useCallback, useMemo, useState } from 'react';
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
import { Colors, FontFamily, Radius, Shadows, Spacing, Type } from '../../theme/tokens';
import { buildSessionOverview } from '../../features/workout/scoreboard/sessionOverview';
import type { ExerciseCard } from '../../types/core';

interface Props {
  visible: boolean;
  exercises: ExerciseCard[];
  currentExerciseIndex: number;
  onAddExercise: () => void;
  onClose: () => void;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ov = useMemo(
    () => buildSessionOverview(exercises, currentExerciseIndex),
    [exercises, currentExerciseIndex],
  );
  const currentId = exercises[currentExerciseIndex]?.id ?? null;
  // Exactly one exercise open at a time: the tapped one, defaulting to
  // whichever the scoreboard has active right now.
  const shownId = expandedId ?? currentId;

  const handleAdd = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onAddExercise();
  }, [onAddExercise]);

  const handleToggle = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setExpandedId(id);
  }, []);

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
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.6}>
            {ov.exercisesDone}/{ov.exercisesTotal} ejercicios · {ov.progressLabel}
          </Text>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: ov.setsTotal, now: ov.setsDone }}
          >
            <View style={[styles.progressFill, { width: `${ov.progress * 100}%` }]} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {ov.exercises.map((ex) => {
              const isCurrent = ex.status === 'current';
              const expanded = ex.id === shownId;
              const stateLabel = isCurrent
                ? ', ejercicio actual'
                : ex.status === 'done'
                  ? ', completado'
                  : '';
              const recapLabel = expanded ? '' : `, ${ex.recap}`;
              return (
                <Pressable
                  key={ex.id}
                  onPress={() => handleToggle(ex.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${ex.name}, ${ex.done} de ${ex.total} sets${stateLabel}${recapLabel}`}
                  style={({ pressed }) => [
                    styles.exRow,
                    isCurrent && styles.exRowCurrent,
                    pressed && styles.exRowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.exDot,
                      ex.status === 'done' && styles.exDotDone,
                      isCurrent && styles.exDotCurrent,
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
                    {expanded ? (
                      ex.sets.map((s) =>
                        s.completed && s.summary ? (
                          <Text
                            key={s.index}
                            style={styles.setLine}
                            numberOfLines={1}
                            maxFontSizeMultiplier={1.6}
                          >
                            {s.index} · {s.summary}
                          </Text>
                        ) : null,
                      )
                    ) : (
                      <Text style={styles.recapLine} numberOfLines={1} maxFontSizeMultiplier={1.6}>
                        {ex.recap}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.exCount} maxFontSizeMultiplier={1.6}>
                    {ex.done}/{ex.total}
                  </Text>
                </Pressable>
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
    marginBottom: Spacing.xs,
  },
  // "3/8 ejercicios · 12 de 24 series" — the "¿cuánto queda?" answer, glanceable
  // with zero scroll (BRIEF-08).
  subtitle: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.sm,
  },
  // Single gold accent of this screen: progress is DATA, not decoration.
  progressTrack: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.glow,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.gold.base,
  },
  body: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    minHeight: 44,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  exRowCurrent: {
    backgroundColor: Colors.bg.warm,
  },
  exRowPressed: {
    opacity: 0.7,
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
  // Sans, sober — every exercise except the one the scoreboard is showing now.
  exName: {
    ...Type.body,
    color: Colors.ink.secondary,
  },
  // Fraunces echoes the scoreboard's own titling for the exercise in play —
  // the one place this glance shares the marker's editorial voice.
  exNameCurrent: {
    fontFamily: FontFamily.serif,
    fontSize: 17,
    lineHeight: 22,
    color: Colors.ink.primary,
  },
  setLine: {
    ...Type.caption,
    color: Colors.ink.muted,
    fontVariant: ['tabular-nums'],
  },
  // Collapsed one-liner ("4 series" | "2/4 series" | "Pendiente") — replaces
  // the old wall of per-set lines for every exercise not in focus.
  recapLine: {
    ...Type.caption,
    color: Colors.ink.muted,
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
