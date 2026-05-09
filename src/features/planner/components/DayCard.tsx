// src/features/planner/components/DayCard.tsx
// Variant dispatcher + inline implementations. Each variant is a small pure
// component sharing the CardShell. Variants are colocated here rather than in
// 9 separate files because they share styles and are tiny.
//
// The dispatcher receives every handler a variant might need. The orchestrator
// in TodayPlanner wires real navigation/store calls; this file knows nothing
// about navigation.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import { CardShell } from './DayCardShared';
import BlockPreview from './BlockPreview';
import RecurrenceChip from './RecurrenceChip';
import { useDayCardState, type DayCardState } from '../hooks/useDayCardState';
import { useScheduleStore } from '../../../store/scheduleStore';
import { useWorkoutStore } from '../../../store/workoutStore';
import {
  calculateBlockStats,
  DISCIPLINE_CONFIGS,
  getBlockExercises,
  type WorkoutBlock,
} from '../../../types/core';
import { daysBetween, todayISO, formatLongDate } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';

interface Props {
  date: ISODate;
  onAssign:        (date: ISODate) => void;
  onStart:         (block: WorkoutBlock) => void;
  onResume:        (block: WorkoutBlock) => void;
  onChangeBlock:   (assignmentId: string, date: ISODate) => void;
  onMove:          (assignmentId: string, fromDate: ISODate) => void;
  onEditSeries:    (assignmentId: string) => void;
  onCreateBlock:   () => void;
  onSeeBlockFull:  (block: WorkoutBlock) => void;
  onPlanWeek:      () => void;
  onSeeSummary?:   (date: ISODate) => void;
}

export default function DayCard(props: Props) {
  const state = useDayCardState(props.date);

  return (
    <Animated.View layout={Layout.springify().damping(18)}>
      <Variant {...props} state={state} />
    </Animated.View>
  );
}

function Variant(props: Props & { state: DayCardState }) {
  const { state, ...handlers } = props;
  switch (state.variant) {
    case 'no-blocks':       return <VariantNoBlocks   onCreateBlock={handlers.onCreateBlock} />;
    case 'empty':           return <VariantEmptyToday {...handlers} state={state} />;
    case 'assigned':        return <VariantAssigned   state={state} {...handlers} />;
    case 'in-progress':     return <VariantInProgress state={state} {...handlers} />;
    case 'completed':       return <VariantCompleted  state={state} {...handlers} />;
    case 'future-assigned': return <VariantFuture     state={state} {...handlers} />;
    case 'future-empty':    return <VariantFutureEmpty {...handlers} state={state} />;
    case 'past-skipped':    return <VariantPastSkipped state={state} {...handlers} />;
    case 'past-empty':      return <VariantPastEmpty   state={state} />;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function metaLine(block: WorkoutBlock): string {
  const stats = calculateBlockStats(block);
  const disc = DISCIPLINE_CONFIGS[block.discipline]?.name ?? block.discipline;
  // estimated_duration lives on the computed stats, not on the block itself
  const dur = stats.estimated_duration > 0 ? `${stats.estimated_duration}m · ` : '';
  return `${disc} · ${dur}${stats.total_exercises} ej · ${stats.total_sets} sets`;
}

function HeroSerif({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.hero, color && { color }]} numberOfLines={2}>{children}</Text>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <Text style={styles.meta} numberOfLines={1}>{children}</Text>;
}

function PrimaryCTA({ label, onPress, ghost = false, accessibilityLabel }: {
  label: string; onPress: () => void; ghost?: boolean; accessibilityLabel?: string;
}) {
  const handle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };
  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        ghost ? styles.ctaGhost : styles.cta,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={ghost ? styles.ctaGhostText : styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

function GhostLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text style={styles.ghostLink}>{label}</Text>
    </Pressable>
  );
}

function SecondaryRow({ items }: { items: Array<{ label: string; onPress: () => void }> }) {
  return (
    <View style={styles.secondaryRow}>
      {items.map((it, idx) => (
        <React.Fragment key={it.label}>
          <Pressable onPress={it.onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={styles.secondaryText}>{it.label}</Text>
          </Pressable>
          {idx < items.length - 1 && <Text style={styles.secondaryDot}> · </Text>}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Variants ────────────────────────────────────────────────────────────

function VariantNoBlocks({ onCreateBlock }: { onCreateBlock: () => void }) {
  return (
    <CardShell>
      <HeroSerif>Tu primer bloque</HeroSerif>
      <Meta>Define una rutina y empieza a planificar.</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Crear bloque" onPress={onCreateBlock} />
      </View>
    </CardShell>
  );
}

function VariantEmptyToday(props: Props & { state: DayCardState }) {
  const blocksCount = useWorkoutStore((s) => s.blocks.length);
  return (
    <CardShell>
      <HeroSerif>Día sin plan</HeroSerif>
      <Meta>{`Tienes ${blocksCount} ${blocksCount === 1 ? 'bloque listo' : 'bloques listos'}.`}</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Asignar bloque" onPress={() => props.onAssign(props.date)} />
      </View>
      <View style={styles.linkRow}>
        <GhostLink label="Kai, planifica mi semana" onPress={props.onPlanWeek} />
      </View>
    </CardShell>
  );
}

function VariantAssigned({ state, ...h }: Props & { state: DayCardState }) {
  const skip = useScheduleStore((s) => s.skipOccurrence);
  if (!state.block || !state.resolved) return null;
  const block = state.block;
  const resolved = state.resolved;
  return (
    <CardShell>
      <HeroSerif>{block.name}</HeroSerif>
      <Meta>{metaLine(block)}</Meta>
      {resolved.isRecurring && (
        <RecurrenceChipForAssignment
          assignmentId={resolved.assignmentId}
          onPress={() => h.onEditSeries(resolved.assignmentId)}
        />
      )}
      <BlockPreview block={block} onSeeFull={() => h.onSeeBlockFull(block)} />
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Empezar" onPress={() => h.onStart(block)} />
      </View>
      <SecondaryRow items={[
        { label: 'Mover',   onPress: () => h.onMove(resolved.assignmentId, state.date) },
        { label: 'Saltar',  onPress: () => skip(resolved.assignmentId, state.date) },
        { label: 'Cambiar', onPress: () => h.onChangeBlock(resolved.assignmentId, state.date) },
      ]}/>
    </CardShell>
  );
}

function VariantInProgress({ state, ...h }: Props & { state: DayCardState }) {
  const active = useWorkoutStore((s) => s.activeWorkout);
  if (!state.block || !state.resolved || !active) return null;
  const block = state.block;
  // WorkoutBlock has no flat .exercises field — walk ContentNode[] via helper.
  const totalSets = getBlockExercises(block).reduce(
    (acc, e) => acc + e.sets.length, 0,
  );
  const doneSets = active.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length, 0,
  );
  return (
    <CardShell>
      <HeroSerif>{block.name}</HeroSerif>
      <Meta>{`${doneSets}/${totalSets} sets hechos`}</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Reanudar" onPress={() => h.onResume(block)} />
      </View>
    </CardShell>
  );
}

function VariantCompleted({ state, ...h }: Props & { state: DayCardState }) {
  if (!state.block || !state.resolved) return null;
  return (
    <CardShell>
      <Text style={styles.heroSecondary}>{`✓  ${state.block.name}`}</Text>
      <Meta>Sesión completada</Meta>
      {h.onSeeSummary && (
        <View style={styles.linkRow}>
          <GhostLink label="Ver resumen" onPress={() => h.onSeeSummary?.(state.date)} />
        </View>
      )}
    </CardShell>
  );
}

function VariantFuture({ state, ...h }: Props & { state: DayCardState }) {
  const skip = useScheduleStore((s) => s.skipOccurrence);
  if (!state.block || !state.resolved) return null;
  const block = state.block;
  const resolved = state.resolved;
  // daysBetween returns the absolute day delta — we want days from today to the
  // selected (future) date, so call daysBetween(future, today) to get a positive number.
  const inDays = daysBetween(state.date, todayISO());
  const disc = DISCIPLINE_CONFIGS[block.discipline]?.name ?? block.discipline;
  return (
    <CardShell>
      <HeroSerif>{block.name}</HeroSerif>
      <Meta>{`En ${inDays} ${inDays === 1 ? 'día' : 'días'} · ${disc}`}</Meta>
      {resolved.isRecurring && (
        <RecurrenceChipForAssignment
          assignmentId={resolved.assignmentId}
          onPress={() => h.onEditSeries(resolved.assignmentId)}
        />
      )}
      <BlockPreview block={block} onSeeFull={() => h.onSeeBlockFull(block)} />
      <View style={styles.ctaWrap}>
        <Text style={styles.programmedLabel}>Programado</Text>
      </View>
      <SecondaryRow items={[
        { label: 'Mover',   onPress: () => h.onMove(resolved.assignmentId, state.date) },
        { label: 'Saltar',  onPress: () => skip(resolved.assignmentId, state.date) },
        { label: 'Cambiar', onPress: () => h.onChangeBlock(resolved.assignmentId, state.date) },
      ]}/>
    </CardShell>
  );
}

function VariantFutureEmpty({ state, onAssign }: Props & { state: DayCardState }) {
  return (
    <CardShell>
      <Text style={styles.heroSmall}>Sin plan</Text>
      <Meta>{formatLongDate(state.date)}</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Asignar bloque" onPress={() => onAssign(state.date)} ghost />
      </View>
    </CardShell>
  );
}

function VariantPastSkipped({ state, ...h }: Props & { state: DayCardState }) {
  if (!state.block) return null;
  return (
    <CardShell>
      <Text style={styles.heroMuted}>{state.block.name}</Text>
      <Meta>{`Saltado · ${formatLongDate(state.date)}`}</Meta>
      <View style={styles.linkRow}>
        <GhostLink label="Reasignar a hoy" onPress={() => h.onAssign(todayISO())} />
      </View>
    </CardShell>
  );
}

function VariantPastEmpty({ state }: { state: DayCardState }) {
  return (
    <CardShell>
      <Text style={styles.heroMutedSmall}>Sin plan</Text>
      <Text style={styles.metaMuted}>{formatLongDate(state.date)}</Text>
    </CardShell>
  );
}

// Local helper that pulls rrule from the store for the chip. Kept inside this
// file because it's only used by Assigned/Future variants.
function RecurrenceChipForAssignment({
  assignmentId, onPress,
}: { assignmentId: string; onPress: () => void }) {
  const assignment = useScheduleStore(
    (s) => s.assignments.find((a) => a.id === assignmentId),
  );
  if (!assignment || assignment.kind !== 'recurring') return null;
  return <RecurrenceChip rrule={assignment.rrule} onPress={onPress} />;
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hero: {
    ...Type.title,
    fontSize: 22,
    color: Colors.ink.primary,
  },
  heroSecondary: {
    ...Type.title,
    fontSize: 20,
    color: Colors.ink.tertiary,
  },
  heroSmall: {
    ...Type.bodyEmph,
    fontSize: 18,
    color: Colors.ink.tertiary,
  },
  heroMuted: {
    ...Type.bodyEmph,
    fontSize: 18,
    color: Colors.ink.muted,
  },
  heroMutedSmall: {
    ...Type.body,
    fontSize: 16,
    color: Colors.ink.muted,
  },
  meta: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 4,
  },
  metaMuted: {
    ...Type.caption,
    color: Colors.ink.muted,
    marginTop: 4,
  },
  ctaWrap: {
    marginTop: Spacing.lg,
  },
  cta: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaText: {
    ...Type.bodyEmph,
    color: Colors.ink.inverse,
  },
  ctaGhost: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaGhostText: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
  },
  ghostLink: {
    ...Type.micro,
    color: Colors.gold.deep,
    paddingVertical: 6,
  },
  programmedLabel: {
    ...Type.bodyEmph,
    color: Colors.gold.deep,
    textAlign: 'center',
    paddingVertical: 12,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  secondaryText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  secondaryDot: {
    ...Type.micro,
    color: Colors.ink.muted,
  },
  linkRow: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
});
