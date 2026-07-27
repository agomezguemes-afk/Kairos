// src/features/planner/components/RecurrenceOverlay.tsx
// Inline overlay that lives inside the AssignBlockSheet (or the
// RecurrenceEditorSheet). Two depths:
//   1. Presets — "Solo hoy", "Cada semana este día", "Lun a Vie",
//      "Cada 2 semanas este día".
//   2. Advanced — weekday picker + a single end-date toggle.
//
// Rationale: long-press should never push another sheet. The overlay
// absolutely-fills the parent sheet so the user feels they're still in the
// same surface. Backdrop tap returns to the picker grid.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import { useScheduleStore } from '../../../store/scheduleStore';
import { buildWeeklyRule } from '../lib/rrule';
import { addDaysISO, fromISODate, formatLongDate } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';
import type { WorkoutBlock } from '../../../types/core';

interface Props {
  block: WorkoutBlock;
  startDate: ISODate;
  onDone: () => void;
  onCancel: () => void;
}

type Preset =
  | { id: 'today' }
  | { id: 'weekly-anchor' }
  | { id: 'weekdays' }
  | { id: 'biweekly-anchor' };

const PRESET_LABELS: Record<Preset['id'], string> = {
  today: 'Solo hoy',
  'weekly-anchor': 'Cada semana este día',
  weekdays: 'Lun a Vie',
  'biweekly-anchor': 'Cada 2 semanas este día',
};

const PRESET_ORDER: Preset['id'][] = ['today', 'weekly-anchor', 'weekdays', 'biweekly-anchor'];

// Mon=0..Sun=6 (Spanish convention, mirrors lib/rrule.ts buildWeeklyRule)
function weekdayIndexFor(d: ISODate): number {
  return (fromISODate(d).getDay() + 6) % 7;
}

export default function RecurrenceOverlay({ block, startDate, onDone, onCancel }: Props) {
  const assignOnce = useScheduleStore((s) => s.assignOnce);
  const assignRecurring = useScheduleStore((s) => s.assignRecurring);

  const [view, setView] = useState<'presets' | 'advanced'>('presets');

  const handlePreset = useCallback(
    (p: Preset['id']) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (p === 'today') {
        assignOnce(startDate, block.id);
      } else {
        const wIdx = weekdayIndexFor(startDate);
        let rrule: string;
        if (p === 'weekly-anchor') {
          rrule = buildWeeklyRule([wIdx]);
        } else if (p === 'weekdays') {
          rrule = buildWeeklyRule([0, 1, 2, 3, 4]);
        } else {
          // biweekly-anchor — interval=2 weekly on the anchor weekday
          rrule = buildWeeklyRule([wIdx], 2);
        }
        assignRecurring({
          blockId: block.id,
          rrule,
          startDate,
          endDate: null,
        });
      }
      onDone();
    },
    [assignOnce, assignRecurring, block.id, startDate, onDone],
  );

  return (
    <Animated.View
      entering={FadeIn.duration(160).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(140).easing(Easing.in(Easing.cubic))}
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
    >
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <Animated.View
        entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
        exiting={SlideOutDown.duration(180).easing(Easing.in(Easing.cubic))}
        style={styles.panel}
      >
        {view === 'presets' ? (
          <PresetsView block={block} onPick={handlePreset} onAdvanced={() => setView('advanced')} />
        ) : (
          <AdvancedView
            block={block}
            startDate={startDate}
            onApply={(rrule, endDate) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              assignRecurring({
                blockId: block.id,
                rrule,
                startDate,
                endDate,
              });
              onDone();
            }}
            onBack={() => setView('presets')}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ── Presets view ────────────────────────────────────────────────────────

function PresetsView({
  block,
  onPick,
  onAdvanced,
}: {
  block: WorkoutBlock;
  onPick: (p: Preset['id']) => void;
  onAdvanced: () => void;
}) {
  return (
    <View>
      <Text style={styles.title}>{`Repetir ${block.name}`}</Text>
      <View style={styles.chipStack}>
        {PRESET_ORDER.map((id) => (
          <Pressable
            key={id}
            onPress={() => onPick(id)}
            accessibilityRole="button"
            accessibilityLabel={PRESET_LABELS[id]}
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.chipText}>{PRESET_LABELS[id]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={onAdvanced}
        accessibilityRole="button"
        accessibilityLabel="Patrón avanzado"
        style={({ pressed }) => [styles.advancedLink, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.advancedLinkText}>Patrón avanzado…</Text>
      </Pressable>
    </View>
  );
}

// ── Advanced view ───────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function AdvancedView({
  block,
  startDate,
  onApply,
  onBack,
}: {
  block: WorkoutBlock;
  startDate: ISODate;
  onApply: (rrule: string, endDate: ISODate | null) => void;
  onBack: () => void;
}) {
  const anchorIdx = weekdayIndexFor(startDate);
  const [days, setDays] = useState<number[]>([anchorIdx]);
  const [endMode, setEndMode] = useState<'never' | 'until'>('never');
  // 90 days out is a sensible default that doesn't feel arbitrary.
  const [endDate, setEndDate] = useState<ISODate>(addDaysISO(startDate, 90));
  // Quick presets for the end date — full date pickers belong in v2.
  const endPresets: { label: string; days: number }[] = useMemo(
    () => [
      { label: '1 mes', days: 30 },
      { label: '3 meses', days: 90 },
      { label: '6 meses', days: 180 },
    ],
    [],
  );

  const toggle = useCallback((i: number) => {
    Haptics.selectionAsync().catch(() => {});
    setDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  }, []);

  const canApply = days.length > 0;
  const handleApply = useCallback(() => {
    if (!canApply) return;
    const rrule = buildWeeklyRule(days);
    onApply(rrule, endMode === 'until' ? endDate : null);
  }, [canApply, days, endMode, endDate, onApply]);

  return (
    <View>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Atrás"
        hitSlop={12}
        style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Presets</Text>
      </Pressable>
      <Text style={styles.title}>{`Repetir ${block.name}`}</Text>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Días</Text>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((l, i) => {
            const active = days.includes(i);
            return (
              <Pressable
                key={l}
                onPress={() => toggle(i)}
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
            <Text style={[styles.endChipText, endMode === 'never' && styles.endChipTextActive]}>
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
            <Text style={[styles.endChipText, endMode === 'until' && styles.endChipTextActive]}>
              Hasta una fecha
            </Text>
          </Pressable>
        </View>

        {endMode === 'until' && (
          <View style={styles.endDateBlock}>
            <Text style={styles.endDateLabel}>{formatLongDate(endDate)}</Text>
            <View style={styles.endDatePresetRow}>
              {endPresets.map((p) => {
                const target = addDaysISO(startDate, p.days);
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
                    <Text style={[styles.endPresetText, active && styles.endPresetTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={handleApply}
        disabled={!canApply}
        accessibilityRole="button"
        accessibilityLabel="Aplicar"
        accessibilityState={{ disabled: !canApply }}
        style={({ pressed }) => [
          styles.apply,
          !canApply && styles.applyDisabled,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.applyText}>Aplicar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.paper.scrimSoft,
  },
  // Inline panel pinned at the bottom of the parent sheet so it feels like
  // the same surface, just deepened. Same paddings as the parent.
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.screen.horizontal,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '80%',
  },
  title: {
    ...Type.titleSmall,
    color: Colors.ink.primary,
    marginBottom: Spacing.lg,
  },
  // Vertical chip stack — one preset per row for thumb reach.
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

  // Advanced view
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
  apply: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  applyDisabled: {
    backgroundColor: Colors.hair.strong,
  },
  applyText: {
    ...Type.bodyEmph,
    color: Colors.ink.inverse,
  },
});
