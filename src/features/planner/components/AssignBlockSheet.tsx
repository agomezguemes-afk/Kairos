// src/features/planner/components/AssignBlockSheet.tsx
// Bottom sheet with 4 linear steps: pick block → frequency → pattern → range.
// Closes back into the planner via assignOnce / assignRecurring.

import React, { useMemo, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
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
import { useWorkoutStore } from '../../../store/workoutStore';
import { useScheduleStore } from '../../../store/scheduleStore';
import {
  RRULE_PRESETS,
  buildWeeklyRule,
  parseRRule,
  summarizeRule,
} from '../lib/rrule';
import {
  todayISO,
  addDaysISO,
  addMonthsISO,
  monthGridDays,
  formatLongDate,
  formatMonthYear,
  fromISODate,
} from '../lib/dates';
import DayCell from './DayCell';
import type { ISODate } from '../../../types/schedule';
import { DISCIPLINE_CONFIGS } from '../../../types/core';

type Frequency = 'once' | 'weekly' | 'advanced';
type Step = 1 | 2 | 3 | 4 | 5;

interface Props {
  visible: boolean;
  initialDate?: ISODate;
  onClose: () => void;
}

export default function AssignBlockSheet({ visible, initialDate, onClose }: Props) {
  const insets = useSafeAreaInsets();

  // WHY: WorkoutBlock has no parentBlockId — every entry in the store is a
  // master block, so the only filter we need is is_archived.
  // Subscribe to the raw array (stable reference). Filter in useMemo so the
  // selector doesn't return a new array on every render — that would trip
  // useSyncExternalStore's getSnapshot caching and infinite-loop the screen.
  const allBlocks = useWorkoutStore((s) => s.blocks);
  const blocks = useMemo(() => allBlocks.filter((b) => !b.is_archived), [allBlocks]);
  const assignOnce = useScheduleStore((s) => s.assignOnce);
  const assignRecurring = useScheduleStore((s) => s.assignRecurring);

  const baseDate = initialDate ?? todayISO();

  const [step, setStep] = useState<Step>(1);
  const [pickedBlockId, setPickedBlockId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [pickedDate, setPickedDate] = useState<ISODate>(baseDate);
  const [pickedWeekdays, setPickedWeekdays] = useState<number[]>(() => {
    // Mon=0..Sun=6 (Spanish convention).
    const idx = (fromISODate(baseDate).getDay() + 6) % 7;
    return [idx];
  });
  const [advancedRRule, setAdvancedRRule] = useState<string>('');
  const [endMode, setEndMode] = useState<'never' | 'until' | 'count'>('never');
  const [endDate, setEndDate] = useState<ISODate>(addDaysISO(baseDate, 90));
  const [count, setCount] = useState<string>('10');

  const reset = useCallback(() => {
    const d = initialDate ?? todayISO();
    setStep(1);
    setPickedBlockId(null);
    setFrequency('once');
    setPickedDate(d);
    setPickedWeekdays([(fromISODate(d).getDay() + 6) % 7]);
    setAdvancedRRule('');
    setEndMode('never');
    setEndDate(addDaysISO(d, 90));
    setCount('10');
  }, [initialDate]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const goTo = useCallback((s: Step) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(s);
  }, []);

  const finalRRule = useMemo<string | null>(() => {
    if (frequency === 'once') return null;
    if (frequency === 'weekly' && pickedWeekdays.length > 0) {
      try {
        return buildWeeklyRule(pickedWeekdays);
      } catch {
        return null;
      }
    }
    if (frequency === 'advanced') {
      const parsed = parseRRule(advancedRRule);
      return parsed.ok ? advancedRRule : null;
    }
    return null;
  }, [frequency, pickedWeekdays, advancedRRule]);

  const confirm = useCallback(() => {
    if (!pickedBlockId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (frequency === 'once') {
      assignOnce(pickedDate, pickedBlockId);
    } else if (finalRRule) {
      const countNum = Math.max(1, Math.floor(Number(count)));
      const rule = endMode === 'count' && Number.isFinite(countNum) && countNum > 0
        ? `${finalRRule};COUNT=${countNum}`
        : finalRRule;
      assignRecurring({
        blockId: pickedBlockId,
        rrule: rule,
        startDate: pickedDate,
        endDate: endMode === 'until' ? endDate : null,
      });
    }
    close();
  }, [
    pickedBlockId, frequency, finalRRule, count, endMode, endDate,
    pickedDate, assignOnce, assignRecurring, close,
  ]);

  const handleNext = useCallback(() => {
    if (step === 3 && frequency === 'once') {
      // Skip "hasta cuándo" for one-time assignments.
      goTo(5);
      return;
    }
    if (step === 3 && frequency === 'weekly' && pickedWeekdays.length === 0) return;
    if (step === 3 && frequency === 'advanced' && !parseRRule(advancedRRule).ok) return;
    if (step < 5) goTo((step + 1) as Step);
  }, [step, frequency, pickedWeekdays.length, advancedRRule, goTo]);

  const handleBack = useCallback(() => {
    if (step <= 1) return;
    // From the confirm step a one-time flow jumped here from step 3.
    if (step === 5 && frequency === 'once') {
      goTo(3);
      return;
    }
    goTo((step - 1) as Step);
  }, [step, frequency, goTo]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            {step > 1 ? (
              <Pressable onPress={handleBack} hitSlop={12} accessibilityLabel="Atrás">
                <Text style={styles.backArrow}>‹</Text>
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={styles.stepTitle}>
              {step === 1 && 'Elige un bloque'}
              {step === 2 && '¿Cuándo?'}
              {step === 3 && (
                frequency === 'once' ? 'Elige la fecha'
                  : frequency === 'weekly' ? 'Días de la semana'
                  : 'Regla avanzada'
              )}
              {step === 4 && 'Hasta cuándo'}
              {step === 5 && 'Confirmar'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.content}>
            {step === 1 && (
              <FlatList
                data={blocks}
                keyExtractor={(b) => b.id}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                ListEmptyComponent={() => (
                  <Text style={styles.emptyHint}>
                    Crea un bloque primero desde la pestaña Bloques.
                  </Text>
                )}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setPickedBlockId(item.id);
                      goTo(2);
                    }}
                    style={({ pressed }) => [styles.blockRow, pressed && { opacity: 0.7 }]}
                  >
                    <View style={[styles.blockSwatch, { backgroundColor: item.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.blockMeta}>
                        {DISCIPLINE_CONFIGS[item.discipline]?.name ?? item.discipline}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            )}

            {step === 2 && (
              <View style={{ gap: Spacing.md }}>
                <FrequencyPill
                  label="Una vez"
                  active={frequency === 'once'}
                  onPress={() => { setFrequency('once'); goTo(3); }}
                />
                <FrequencyPill
                  label="Cada semana"
                  active={frequency === 'weekly'}
                  onPress={() => { setFrequency('weekly'); goTo(3); }}
                />
                <FrequencyPill
                  label="Avanzado"
                  active={frequency === 'advanced'}
                  onPress={() => { setFrequency('advanced'); goTo(3); }}
                />
              </View>
            )}

            {step === 3 && frequency === 'once' && (
              <InlineMonthPicker value={pickedDate} onChange={setPickedDate} />
            )}

            {step === 3 && frequency === 'weekly' && (
              <WeekdayPicker value={pickedWeekdays} onChange={setPickedWeekdays} />
            )}

            {step === 3 && frequency === 'advanced' && (
              <View style={{ gap: Spacing.md }}>
                <Text style={styles.help}>
                  RRULE (RFC 5545). Empieza con un preset y edítalo.
                </Text>
                {RRULE_PRESETS.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setAdvancedRRule(p.build(pickedDate))}
                    style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.presetLabel}>{p.label}</Text>
                  </Pressable>
                ))}
                <TextInput
                  multiline
                  value={advancedRRule}
                  onChangeText={setAdvancedRRule}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                  placeholderTextColor={Colors.ink.muted}
                  style={styles.rruleInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {advancedRRule.length > 0 && (
                  parseRRule(advancedRRule).ok
                    ? <Text style={styles.rruleSummary}>{summarizeRule(advancedRRule)}</Text>
                    : <Text style={styles.rruleError}>Regla no válida</Text>
                )}
              </View>
            )}

            {step === 4 && (
              <View style={{ gap: Spacing.md }}>
                <FrequencyPill
                  label="Sin fin"
                  active={endMode === 'never'}
                  onPress={() => setEndMode('never')}
                />
                <FrequencyPill
                  label="Hasta una fecha"
                  active={endMode === 'until'}
                  onPress={() => setEndMode('until')}
                />
                <FrequencyPill
                  label="Un nº de veces"
                  active={endMode === 'count'}
                  onPress={() => setEndMode('count')}
                />
                {endMode === 'until' && (
                  <InlineMonthPicker
                    value={endDate}
                    onChange={setEndDate}
                    minDate={pickedDate}
                  />
                )}
                {endMode === 'count' && (
                  <TextInput
                    keyboardType="number-pad"
                    value={count}
                    onChangeText={setCount}
                    style={styles.countInput}
                    accessibilityLabel="Número de veces"
                  />
                )}
              </View>
            )}

            {step === 5 && pickedBlockId && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bloque: </Text>
                  {blocks.find((b) => b.id === pickedBlockId)?.name ?? '—'}
                </Text>
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cuándo: </Text>
                  {frequency === 'once'
                    ? formatLongDate(pickedDate)
                    : finalRRule
                      ? summarizeRule(finalRRule)
                      : '—'}
                </Text>
                {frequency !== 'once' && (
                  <Text style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Inicia: </Text>
                    {formatLongDate(pickedDate)}
                  </Text>
                )}
                {frequency !== 'once' && endMode === 'until' && (
                  <Text style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Hasta: </Text>
                    {formatLongDate(endDate)}
                  </Text>
                )}
                {frequency !== 'once' && endMode === 'count' && (
                  <Text style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Repeticiones: </Text>
                    {count}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {step < 5 ? (
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
                accessibilityLabel="Siguiente"
              >
                <Text style={styles.primaryText}>Siguiente</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={confirm}
                style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
                accessibilityLabel="Asignar"
              >
                <Text style={styles.primaryText}>Asignar</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function FrequencyPill({
  label, active, onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.freqPill,
        active && styles.freqPillActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.freqPillText, active && styles.freqPillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function WeekdayPicker({
  value, onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const toggle = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort());
  };
  return (
    <View style={styles.weekdayRow}>
      {labels.map((l, i) => (
        <Pressable
          key={l}
          onPress={() => toggle(i)}
          style={({ pressed }) => [
            styles.weekdayBtn,
            value.includes(i) && styles.weekdayBtnActive,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel={l}
          accessibilityState={{ selected: value.includes(i) }}
        >
          <Text style={[styles.weekdayBtnText, value.includes(i) && styles.weekdayBtnTextActive]}>
            {l}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function InlineMonthPicker({
  value, onChange, minDate,
}: {
  value: ISODate;
  onChange: (d: ISODate) => void;
  minDate?: ISODate;
}) {
  const [anchor, setAnchor] = useState<ISODate>(value);
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const focusedMonth = fromISODate(anchor).getMonth();
  const today = todayISO();

  return (
    <View>
      <View style={styles.pickerHeader}>
        <Pressable onPress={() => setAnchor(addMonthsISO(anchor, -1))} hitSlop={12} accessibilityLabel="Mes anterior">
          <Text style={styles.pickerArrow}>‹</Text>
        </Pressable>
        <Text style={styles.pickerMonth}>{formatMonthYear(anchor)}</Text>
        <Pressable onPress={() => setAnchor(addMonthsISO(anchor, 1))} hitSlop={12} accessibilityLabel="Mes siguiente">
          <Text style={styles.pickerArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.pickerWeekdayHeader}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((w) => (
          <Text key={w} style={styles.pickerWeekdayLabel}>{w}</Text>
        ))}
      </View>
      <View style={styles.pickerGrid}>
        {days.map((d) => {
          const disabled = !!minDate && d < minDate;
          return (
            <View key={d} style={[styles.pickerCell, disabled && { opacity: 0.35 }]}>
              <DayCell
                date={d}
                selected={d === value}
                isToday={d === today}
                hasAssignment={false}
                isOtherMonth={fromISODate(d).getMonth() !== focusedMonth}
                size="month"
                onPress={(picked) => {
                  if (disabled) return;
                  onChange(picked);
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.ink.secondary,
    width: 24,
    textAlign: 'center',
  },
  stepTitle: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingVertical: Spacing.md,
    minHeight: 240,
  },
  footer: { paddingTop: Spacing.md },
  primary: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  primaryText: {
    ...Type.bodyEmph,
    color: Colors.ink.inverse,
  },

  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
  },
  blockSwatch: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
  },
  blockName: { ...Type.bodyEmph, color: Colors.ink.primary },
  blockMeta: { ...Type.micro, color: Colors.ink.tertiary, marginTop: 2 },
  emptyHint: {
    ...Type.body,
    color: Colors.ink.tertiary,
    textAlign: 'center',
    padding: Spacing.lg,
  },

  freqPill: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  freqPillActive: {
    borderColor: Colors.gold.base,
    backgroundColor: Colors.gold.glow,
  },
  freqPillText: {
    ...Type.body,
    color: Colors.ink.secondary,
    textAlign: 'center',
  },
  freqPillTextActive: {
    color: Colors.gold.deep,
    fontWeight: '600',
  },

  weekdayRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
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
  rruleSummary: { ...Type.micro, color: Colors.gold.deep },
  rruleError: { ...Type.micro, color: Colors.semantic.error },

  countInput: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.md,
    ...Type.body,
    color: Colors.ink.primary,
    textAlign: 'center',
  },

  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  pickerArrow: {
    fontSize: 24,
    color: Colors.ink.secondary,
    paddingHorizontal: Spacing.sm,
  },
  pickerMonth: {
    ...Type.bodyEmph,
    color: Colors.ink.primary,
    textTransform: 'capitalize',
  },
  pickerWeekdayHeader: {
    flexDirection: 'row',
    paddingBottom: Spacing.xs,
  },
  pickerWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    ...Type.micro,
    color: Colors.ink.tertiary,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerCell: {
    width: `${100 / 7}%`,
    paddingVertical: 2,
  },

  help: { ...Type.micro, color: Colors.ink.tertiary },

  summaryRow: { ...Type.body, color: Colors.ink.primary },
  summaryLabel: { color: Colors.ink.tertiary },
});
