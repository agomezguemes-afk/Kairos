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
import Animated, { LinearTransition, Easing } from 'react-native-reanimated';
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
  getBlockExercises,
  type WorkoutBlock,
  type Discipline,
} from '../../../types/core';
import { todayISO, formatLongDate } from '../lib/dates';
import type { ISODate, ResolvedAssignment } from '../../../types/schedule';

interface Props {
  date: ISODate;
  onAssign:        (date: ISODate) => void;
  /** `resolved` is the schedule context for the day; null when no assignment exists. */
  onStart:         (block: WorkoutBlock, resolved: ResolvedAssignment | null) => void;
  onResume:        (block: WorkoutBlock, resolved: ResolvedAssignment | null) => void;
  onChangeBlock:   (assignmentId: string, date: ISODate) => void;
  onMove:          (assignmentId: string, fromDate: ISODate) => void;
  onEditSeries:    (assignmentId: string) => void;
  onCreateBlock:   () => void;
  /** When provided, no-blocks variant offers a primary "Empezar con plantilla"
   *  CTA that opens the template picker. Falls back to single-CTA when absent. */
  onChooseTemplate?: () => void;
  onSeeBlockFull:  (block: WorkoutBlock) => void;
  onPlanWeek:      () => void;
  onSeeSummary?:   (date: ISODate) => void;
}

export default function DayCard(props: Props) {
  const state = useDayCardState(props.date);

  return (
    <Animated.View layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}>
      <Variant {...props} state={state} />
    </Animated.View>
  );
}

function Variant(props: Props & { state: DayCardState }) {
  const { state, ...handlers } = props;
  switch (state.variant) {
    case 'no-blocks':       return <VariantNoBlocks
                              onCreateBlock={handlers.onCreateBlock}
                              onChooseTemplate={handlers.onChooseTemplate}
                            />;
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

function disciplineColor(d: Discipline): string {
  return Colors.discipline[d] ?? Colors.gold.base;
}

function HeroSerif({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.hero, color && { color }]} numberOfLines={2}>{children}</Text>;
}

/**
 * Two compact pills for duration + sets count. Replaces the old
 * "Strength · 45m · 6 ej · 18 sets" line — discipline already lives on
 * the colored stripe, so the pills only carry the numbers worth showing.
 */
function StatPills({ block }: { block: WorkoutBlock }) {
  const stats = calculateBlockStats(block);
  const dur = stats.estimated_duration > 0 ? `${stats.estimated_duration} min` : null;
  const setsLabel = `${stats.total_sets} ${stats.total_sets === 1 ? 'set' : 'sets'}`;
  return (
    <View style={styles.pillsRow}>
      {dur && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{dur}</Text>
        </View>
      )}
      <View style={styles.pill}>
        <Text style={styles.pillText}>{setsLabel}</Text>
      </View>
    </View>
  );
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && { opacity: 0.6 }}
    >
      <Text style={styles.ghostLink}>{label}</Text>
    </Pressable>
  );
}

/**
 * Bottom action row for the assigned/future variants.
 * Replaces the dot-separated "Mover · Saltar · Cambiar" with a quieter
 * row separated by hairline divider above and a bit of breathing room.
 */
function SecondaryActions({
  items,
}: { items: Array<{ label: string; onPress: () => void }> }) {
  return (
    <View style={styles.secondaryWrap}>
      <View style={styles.divider} />
      <View style={styles.secondaryRow}>
        {items.map((it) => (
          <Pressable
            key={it.label}
            onPress={it.onPress}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            style={({ pressed }) => [styles.secondaryItem, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.secondaryText}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Variants ────────────────────────────────────────────────────────────

function VariantNoBlocks({
  onCreateBlock,
  onChooseTemplate,
}: {
  onCreateBlock: () => void;
  onChooseTemplate?: () => void;
}) {
  // When a template handler is wired, prefer it as the primary action — a
  // brand-new user gets a working block in one tap instead of staring at a
  // blank editor. The "from scratch" path is still one ghost tap away.
  if (onChooseTemplate) {
    return (
      <CardShell>
        <View style={styles.centeredEmpty}>
          <HeroSerif>Tu primer bloque</HeroSerif>
          <Text style={styles.centeredHint}>Empieza con una plantilla o créala desde cero.</Text>
          <View style={styles.centeredCtaWrap}>
            <PrimaryCTA label="Empezar con plantilla" onPress={onChooseTemplate} />
          </View>
          <View style={styles.linkRow}>
            <GhostLink label="Crear desde cero" onPress={onCreateBlock} />
          </View>
        </View>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <View style={styles.centeredEmpty}>
        <HeroSerif>Tu primer bloque</HeroSerif>
        <Text style={styles.centeredHint}>Define una rutina y empieza a planificar.</Text>
        <View style={styles.centeredCtaWrap}>
          <PrimaryCTA label="Crear bloque" onPress={onCreateBlock} />
        </View>
      </View>
    </CardShell>
  );
}

function VariantEmptyToday(props: Props & { state: DayCardState }) {
  // We're in the "has at least one block, but today is unassigned" lane.
  // Show the count as quiet meta so the user remembers they have inventory.
  const blocksCount = useWorkoutStore(
    (s) => s.blocks.filter((b) => !b.is_archived).length,
  );
  const meta = `${blocksCount} ${blocksCount === 1 ? 'bloque' : 'bloques'} disponible${blocksCount === 1 ? '' : 's'}`;
  return (
    <CardShell>
      <View style={styles.centeredEmpty}>
        <HeroSerif>Día sin plan</HeroSerif>
        <Text style={styles.centeredHint}>{meta}</Text>
        <View style={styles.centeredCtaWrap}>
          <PrimaryCTA label="Asignar bloque" onPress={() => props.onAssign(props.date)} />
        </View>
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
    <CardShell stripeColor={disciplineColor(block.discipline)}>
      <HeroSerif>{block.name}</HeroSerif>
      <StatPills block={block} />
      {resolved.isRecurring && (
        <RecurrenceChipForAssignment
          assignmentId={resolved.assignmentId}
          onPress={() => h.onEditSeries(resolved.assignmentId)}
        />
      )}
      <View style={styles.previewWrap}>
        <BlockPreview block={block} onSeeFull={() => h.onSeeBlockFull(block)} subdued />
      </View>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Empezar" onPress={() => h.onStart(block, resolved)} />
      </View>
      <SecondaryActions items={[
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
  const resolved = state.resolved;
  // WorkoutBlock has no flat .exercises field — walk ContentNode[] via helper.
  const totalSets = getBlockExercises(block).reduce(
    (acc, e) => acc + e.sets.length, 0,
  );
  const doneSets = active.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length, 0,
  );
  return (
    <CardShell stripeColor={disciplineColor(block.discipline)}>
      <HeroSerif>{block.name}</HeroSerif>
      <View style={styles.pillsRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{`${doneSets}/${totalSets} sets`}</Text>
        </View>
      </View>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Reanudar" onPress={() => h.onResume(block, resolved)} />
      </View>
    </CardShell>
  );
}

function VariantCompleted({ state, ...h }: Props & { state: DayCardState }) {
  if (!state.block || !state.resolved) return null;
  return (
    <CardShell stripeColor={disciplineColor(state.block.discipline)} tint="warm">
      <Text style={styles.heroSecondary}>{`✓  ${state.block.name}`}</Text>
      <Text style={styles.metaCompleted}>Sesión completada</Text>
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
  return (
    <CardShell stripeColor={disciplineColor(block.discipline)}>
      <HeroSerif>{block.name}</HeroSerif>
      <StatPills block={block} />
      {resolved.isRecurring && (
        <RecurrenceChipForAssignment
          assignmentId={resolved.assignmentId}
          onPress={() => h.onEditSeries(resolved.assignmentId)}
        />
      )}
      <View style={styles.previewWrap}>
        <BlockPreview block={block} onSeeFull={() => h.onSeeBlockFull(block)} subdued />
      </View>
      <View style={styles.ctaWrap}>
        <Text style={styles.programmedLabel}>Programado</Text>
      </View>
      <SecondaryActions items={[
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
      <Text style={styles.metaQuiet}>{formatLongDate(state.date)}</Text>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Asignar bloque" onPress={() => onAssign(state.date)} ghost />
      </View>
    </CardShell>
  );
}

function VariantPastSkipped({ state, ...h }: Props & { state: DayCardState }) {
  if (!state.block) return null;
  return (
    <CardShell stripeColor={disciplineColor(state.block.discipline)} dim>
      <Text style={styles.heroMuted}>{state.block.name}</Text>
      <Text style={styles.metaQuiet}>{`Saltado · ${formatLongDate(state.date)}`}</Text>
      <View style={styles.linkRow}>
        <GhostLink label="Reasignar a hoy" onPress={() => h.onAssign(todayISO())} />
      </View>
    </CardShell>
  );
}

function VariantPastEmpty({ state }: { state: DayCardState }) {
  return (
    <CardShell dim>
      <Text style={styles.heroMutedSmall}>Sin plan</Text>
      <Text style={styles.metaQuiet}>{formatLongDate(state.date)}</Text>
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
    fontSize: 24,
    lineHeight: 28,
    color: Colors.ink.primary,
  },
  heroSecondary: {
    ...Type.title,
    fontSize: 20,
    lineHeight: 24,
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
  // Quiet meta line below muted heroes (past/future-empty).
  metaQuiet: {
    ...Type.caption,
    color: Colors.ink.muted,
    marginTop: 4,
  },
  metaCompleted: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 4,
  },
  // Pills row replacing the verbose meta string.
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
  },
  pillText: {
    ...Type.micro,
    color: Colors.ink.secondary,
  },
  // BlockPreview indented to read as secondary information.
  previewWrap: {
    paddingLeft: Spacing.md,
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
  // Secondary action row pinned at the bottom of the card with a hairline
  // divider above. Matches Apple Wallet card-detail rows.
  secondaryWrap: {
    marginTop: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.hair.subtle,
    marginBottom: Spacing.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  secondaryText: {
    ...Type.micro,
    color: Colors.ink.tertiary,
    fontWeight: '500',
  },
  linkRow: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  // Centered empty / no-blocks layout. Padding keeps things vertically airy
  // without inflating the card height too much.
  centeredEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  centeredHint: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  centeredCtaWrap: {
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
  },
});
