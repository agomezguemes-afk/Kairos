// src/features/planner/components/RecurrenceEditorSheet.tsx
// Edit the recurrence pattern of an existing series. Same preset-chips +
// advanced-inline shape as the AssignBlockSheet's RecurrenceOverlay, plus
// two compact bottom actions: "Aplicar a esta y futuras" and "Terminar serie".
//
// "Apply" truncates the current rule at selectedDate-1 and creates a new
// series starting on selectedDate; "End series" truncates yesterday so today
// stops being scheduled.

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useScheduleStore } from '../../../store/scheduleStore';
import { buildWeeklyRule, summarizeRule } from '../lib/rrule';
import { todayISO, addDaysISO, fromISODate, formatLongDate } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  selectedDate: ISODate;
  onClose: () => void;
}

type PresetId = 'weekly-anchor' | 'weekdays' | 'biweekly-anchor' | 'weekends';

const PRESET_LABELS: Record<PresetId, string> = {
  'weekly-anchor': 'Cada semana este día',
  weekdays: 'Lun a Vie',
  'biweekly-anchor': 'Cada 2 semanas este día',
  weekends: 'Fines de semana',
};

const PRESET_ORDER: PresetId[] = ['weekly-anchor', 'weekdays', 'biweekly-anchor', 'weekends'];

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function weekdayIndexFor(d: ISODate): number {
  return (fromISODate(d).getDay() + 6) % 7;
}

function buildPreset(p: PresetId, anchor: ISODate): string {
  const wIdx = weekdayIndexFor(anchor);
  switch (p) {
    case 'weekly-anchor':
      return buildWeeklyRule([wIdx]);
    case 'weekdays':
      return buildWeeklyRule([0, 1, 2, 3, 4]);
    case 'biweekly-anchor':
      return buildWeeklyRule([wIdx], 2);
    case 'weekends':
      return buildWeeklyRule([5, 6]);
  }
}

export default function RecurrenceEditorSheet({
  visible,
  assignmentId,
  selectedDate,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const assignment = useScheduleStore((s) =>
    assignmentId ? s.assignments.find((a) => a.id === assignmentId) : null,
  );
  const truncateSeries = useScheduleStore((s) => s.truncateSeries);
  const assignRecurring = useScheduleStore((s) => s.assignRecurring);

  const initialRRule = assignment && assignment.kind === 'recurring' ? assignment.rrule : '';
  const [draft, setDraft] = useState<string>(initialRRule);
  const [view, setView] = useState<'presets' | 'advanced'>('presets');
  // Advanced state — initialized from the current series anchor.
  const [days, setDays] = useState<number[]>([weekdayIndexFor(selectedDate)]);
  const [endMode, setEndMode] = useState<'never' | 'until'>(
    assignment && assignment.kind === 'recurring' && assignment.endDate ? 'until' : 'never',
  );
  const [endDate, setEndDate] = useState<ISODate>(
    assignment && assignment.kind === 'recurring' && assignment.endDate
      ? assignment.endDate
      : addDaysISO(selectedDate, 90),
  );

  // Re-seed when the sheet (re-)opens for a new assignment.
  useEffect(() => {
    if (!visible) return;
    setDraft(initialRRule);
    setView('presets');
    setDays([weekdayIndexFor(selectedDate)]);
    if (assignment && assignment.kind === 'recurring' && assignment.endDate) {
      setEndMode('until');
      setEndDate(assignment.endDate);
    } else {
      setEndMode('never');
      setEndDate(addDaysISO(selectedDate, 90));
    }
  }, [visible, initialRRule, selectedDate, assignment]);

  const summary = useMemo(() => summarizeRule(draft || initialRRule), [draft, initialRRule]);

  const apply = useCallback(
    (rrule: string, endDateValue: ISODate | null) => {
      if (!assignment || assignment.kind !== 'recurring') return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      truncateSeries(assignment.id, addDaysISO(selectedDate, -1));
      assignRecurring({
        blockId: assignment.blockId,
        rrule,
        startDate: selectedDate,
        endDate: endDateValue,
      });
      onClose();
    },
    [assignment, truncateSeries, assignRecurring, selectedDate, onClose],
  );

  const endSeries = useCallback(() => {
    if (!assignment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    truncateSeries(assignment.id, addDaysISO(todayISO(), -1));
    onClose();
  }, [assignment, truncateSeries, onClose]);

  const handlePreset = useCallback(
    (p: PresetId) => {
      Haptics.selectionAsync().catch(() => {});
      const rrule = buildPreset(p, selectedDate);
      apply(rrule, null);
    },
    [apply, selectedDate],
  );

  const toggleDay = useCallback((i: number) => {
    Haptics.selectionAsync().catch(() => {});
    setDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  }, []);

  const applyAdvanced = useCallback(() => {
    if (days.length === 0) return;
    const rrule = buildWeeklyRule(days);
    setDraft(rrule);
    apply(rrule, endMode === 'until' ? endDate : null);
  }, [days, endMode, endDate, apply]);

  const endPresets: { label: string; days: number }[] = useMemo(
    () => [
      { label: '1 mes', days: 30 },
      { label: '3 meses', days: 90 },
      { label: '6 meses', days: 180 },
    ],
    [],
  );

  if (!assignment || assignment.kind !== 'recurring') return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(200).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160).easing(Easing.in(Easing.cubic))}
        style={styles.scrim}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Editar serie</Text>
            <Text style={styles.summaryRow}>{summary}</Text>
            <Text style={styles.subtitle}>
              {`Aplica desde ${formatLongDate(selectedDate)} hacia adelante.`}
            </Text>
          </View>

          {view === 'presets' ? (
            <View>
              <View style={styles.chipStack}>
                {PRESET_ORDER.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => handlePreset(id)}
                    accessibilityRole="button"
                    accessibilityLabel={PRESET_LABELS[id]}
                    style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.chipText}>{PRESET_LABELS[id]}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setView('advanced')}
                accessibilityRole="button"
                accessibilityLabel="Patrón avanzado"
                style={({ pressed }) => [styles.advancedLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.advancedLinkText}>Patrón avanzado…</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={() => setView('presets')}
                accessibilityRole="button"
                accessibilityLabel="Volver a presets"
                hitSlop={12}
                style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.backArrow}>‹</Text>
                <Text style={styles.backLabel}>Presets</Text>
              </Pressable>

              <Text style={styles.sectionLabel}>Días</Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((l, i) => {
                  const active = days.includes(i);
                  return (
                    <Pressable
                      key={l}
                      onPress={() => toggleDay(i)}
                      accessibilityRole="button"
                      accessibilityLabel={l}
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.weekdayBtn,
                        active && styles.weekdayBtnActive,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.weekdayBtnText, active && styles.weekdayBtnTextActive]}>
                        {l}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Hasta cuándo</Text>
              <View style={styles.endRow}>
                <Pressable
                  onPress={() => setEndMode('never')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: endMode === 'never' }}
                  style={({ pressed }) => [
                    styles.endChip,
                    endMode === 'never' && styles.endChipActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[styles.endChipText, endMode === 'never' && styles.endChipTextActive]}
                  >
                    Sin fin
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEndMode('until')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: endMode === 'until' }}
                  style={({ pressed }) => [
                    styles.endChip,
                    endMode === 'until' && styles.endChipActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={[styles.endChipText, endMode === 'until' && styles.endChipTextActive]}
                  >
                    Hasta una fecha
                  </Text>
                </Pressable>
              </View>

              {endMode === 'until' && (
                <View style={styles.endDateBlock}>
                  <Text style={styles.endDateLabel}>{formatLongDate(endDate)}</Text>
                  <View style={styles.endDatePresetRow}>
                    {endPresets.map((p) => {
                      const target = addDaysISO(selectedDate, p.days);
                      const active = target === endDate;
                      return (
                        <Pressable
                          key={p.label}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setEndDate(target);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={p.label}
                          accessibilityState={{ selected: active }}
                          style={({ pressed }) => [
                            styles.endPreset,
                            active && styles.endPresetActive,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text
                            style={[styles.endPresetText, active && styles.endPresetTextActive]}
                          >
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.actions}>
            {view === 'advanced' && (
              <Pressable
                onPress={applyAdvanced}
                disabled={days.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Aplicar"
                accessibilityState={{ disabled: days.length === 0 }}
                style={({ pressed }) => [
                  styles.primary,
                  days.length === 0 && styles.primaryDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryText}>Aplicar</Text>
              </Pressable>
            )}
            <Pressable
              onPress={endSeries}
              accessibilityRole="button"
              accessibilityLabel="Terminar serie"
              style={({ pressed }) => [styles.danger, pressed && { opacity: 0.6 }]}
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
    backgroundColor: Colors.paper.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
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
  headerBlock: {
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
  },
  summaryRow: {
    ...Type.body,
    color: Colors.ink.secondary,
    marginTop: 4,
  },
  subtitle: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    marginTop: 4,
  },

  chipStack: {
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
  },
  chipText: {
    ...Type.body,
    color: Colors.ink.primary,
    fontWeight: '500',
  },
  advancedLink: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  advancedLinkText: {
    ...Type.micro,
    color: Colors.gold.deep,
    fontWeight: '600',
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 18,
    color: Colors.ink.tertiary,
    fontWeight: '500',
  },
  backLabel: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '500',
  },
  sectionLabel: {
    ...Type.micro,
    color: Colors.ink.muted,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  weekdayBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.elevated,
  },
  weekdayBtnActive: { backgroundColor: Colors.gold.base },
  weekdayBtnText: { ...Type.bodyEmph, color: Colors.ink.secondary },
  weekdayBtnTextActive: { color: Colors.ink.inverse },

  endRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  endChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  endChipActive: {
    backgroundColor: Colors.gold.glow,
  },
  endChipText: {
    ...Type.caption,
    color: Colors.ink.secondary,
    fontWeight: '500',
  },
  endChipTextActive: {
    color: Colors.gold.deep,
    fontWeight: '600',
  },
  endDateBlock: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  endDateLabel: {
    ...Type.body,
    color: Colors.ink.primary,
    textTransform: 'capitalize',
    marginBottom: Spacing.sm,
  },
  endDatePresetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  endPreset: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.surface,
    alignItems: 'center',
  },
  endPresetActive: {
    backgroundColor: Colors.gold.base,
  },
  endPresetText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '500',
  },
  endPresetTextActive: {
    color: Colors.ink.inverse,
    fontWeight: '600',
  },

  actions: {
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  primary: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  primaryDisabled: { backgroundColor: Colors.hair.strong },
  primaryText: { ...Type.bodyEmph, color: Colors.ink.inverse },
  danger: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerText: {
    ...Type.micro,
    color: Colors.ink.muted,
    fontWeight: '600',
  },
});
