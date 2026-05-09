// src/features/planner/components/RecurrenceEditorSheet.tsx
// Edit recurrence pattern of an existing series. "Apply this and future"
// truncates the current rule at selectedDate-1 and creates a new series
// starting on selectedDate; "End series" truncates yesterday so today
// stops being scheduled.

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useScheduleStore } from '../../../store/scheduleStore';
import {
  parseRRule,
  summarizeRule,
  RRULE_PRESETS,
} from '../lib/rrule';
import { todayISO, addDaysISO } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  selectedDate: ISODate;
  onClose: () => void;
}

export default function RecurrenceEditorSheet({
  visible, assignmentId, selectedDate, onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const assignment = useScheduleStore((s) =>
    assignmentId ? s.assignments.find((a) => a.id === assignmentId) : null,
  );
  const truncateSeries = useScheduleStore((s) => s.truncateSeries);
  const assignRecurring = useScheduleStore((s) => s.assignRecurring);

  const initialRRule =
    assignment && assignment.kind === 'recurring' ? assignment.rrule : '';
  const [rrule, setRRule] = useState<string>(initialRRule);

  // Reset draft state every time the sheet (re-)opens for a new assignment.
  useEffect(() => {
    if (visible) setRRule(initialRRule);
  }, [visible, initialRRule]);

  const valid = useMemo(() => parseRRule(rrule).ok, [rrule]);

  const applyChange = useCallback(() => {
    if (!assignment || assignment.kind !== 'recurring' || !valid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    truncateSeries(assignment.id, addDaysISO(selectedDate, -1));
    assignRecurring({
      blockId: assignment.blockId,
      rrule,
      startDate: selectedDate,
      endDate: assignment.endDate,
    });
    onClose();
  }, [assignment, valid, rrule, selectedDate, truncateSeries, assignRecurring, onClose]);

  const endSeries = useCallback(() => {
    if (!assignment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    truncateSeries(assignment.id, addDaysISO(todayISO(), -1));
    onClose();
  }, [assignment, truncateSeries, onClose]);

  if (!assignment || assignment.kind !== 'recurring') return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Editar serie</Text>
          <Text style={styles.subtitle}>
            Aplica desde {selectedDate} hacia adelante. Las ocurrencias pasadas
            quedan intactas.
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.label}>Patrón actual</Text>
              <Text style={styles.summary}>{summarizeRule(initialRRule)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Presets</Text>
              <View style={{ gap: Spacing.sm }}>
                {RRULE_PRESETS.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setRRule(p.build(selectedDate))}
                    style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.presetLabel}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>RRULE</Text>
              <TextInput
                multiline
                value={rrule}
                onChangeText={setRRule}
                style={styles.rruleInput}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholderTextColor={Colors.ink.muted}
              />
              {rrule.length > 0 && (
                valid
                  ? <Text style={styles.summaryNew}>{summarizeRule(rrule)}</Text>
                  : <Text style={styles.error}>Regla no válida</Text>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={applyChange}
              disabled={!valid}
              style={({ pressed }) => [
                styles.primary,
                !valid && styles.primaryDisabled,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityLabel="Aplicar a esta y futuras"
              accessibilityState={{ disabled: !valid }}
            >
              <Text style={styles.primaryText}>Aplicar a esta y futuras</Text>
            </Pressable>
            <Pressable
              onPress={endSeries}
              style={({ pressed }) => [styles.danger, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Terminar serie"
            >
              <Text style={styles.dangerText}>Terminar serie</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    maxHeight: '88%',
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hair.strong,
    marginBottom: Spacing.md,
  },
  // WHY: spec says "title" but a 32-pt serif fights the sheet width;
  // override fontSize/lineHeight to keep the editorial voice in a tighter box.
  title: {
    ...Type.title,
    color: Colors.ink.primary,
    fontSize: 20,
    lineHeight: 24,
  },
  subtitle: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: Spacing.md },
  section: { marginBottom: Spacing.lg },
  label: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summary: { ...Type.body, color: Colors.ink.primary },
  summaryNew: { ...Type.micro, color: Colors.gold.deep, marginTop: Spacing.sm },
  error: { ...Type.micro, color: Colors.semantic.error, marginTop: Spacing.sm },
  preset: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
  },
  presetLabel: { ...Type.body, color: Colors.ink.secondary },
  rruleInput: {
    minHeight: 60,
    padding: Spacing.md,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    ...Type.body,
    color: Colors.ink.primary,
  },
  actions: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  primary: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  primaryDisabled: { backgroundColor: Colors.hair.strong },
  primaryText: { ...Type.bodyEmph, color: Colors.ink.inverse },
  danger: { paddingVertical: 12, alignItems: 'center' },
  dangerText: { ...Type.bodyEmph, color: Colors.ink.muted },
});
