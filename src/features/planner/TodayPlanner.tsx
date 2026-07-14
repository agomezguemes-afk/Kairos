// src/features/planner/TodayPlanner.tsx
// Top-level planner — header + calendar + day card + signal card + sheets.
// Knows how to wire every handler the variants need; everything else is a
// dumb component.

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../theme/tokens';
import HomeHero from './components/HomeHero';
import FirstWorkoutCTA from './components/FirstWorkoutCTA';
import AmbientKaiBar from '../conversation/AmbientKaiBar';
import HomeHeroStats from './components/HomeHeroStats';
import ReadinessRings from './components/ReadinessRings';
import CalendarView from './components/CalendarView';
import DayCard from './components/DayCard';
import KaiSignalCard from './components/KaiSignal';
import AssignBlockSheet from './components/AssignBlockSheet';
import RecurrenceEditorSheet from './components/RecurrenceEditorSheet';
import MovePicker from './components/MovePicker';
import ChangeBlockPicker from './components/ChangeBlockPicker';
import TemplatePickerSheet from '../blocks/components/TemplatePickerSheet';

import { todayISO } from './lib/dates';
import { kaiSignal, type KaiSignal } from './lib/kaiSignal';
import { useDayCardState } from './hooks/useDayCardState';
import { useWorkoutStore } from '../../store/workoutStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useGamification } from '../../context/GamificationContext';
import { isSurfaceVisible } from '../../config/wedge';
import type { ISODate, ResolvedAssignment } from '../../types/schedule';
import { getBlockExercises, type WorkoutBlock } from '../../types/core';
import type { RootStackParamList, DashboardTabParamList } from '../../types/navigation';

type RootNav = NativeStackNavigationProp<RootStackParamList>;
type TabNav = NavigationProp<DashboardTabParamList>;

export default function TodayPlanner() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  // Single hook for both root-stack and parent tab navigation. Cast at the
  // call site instead of choosing a single generic — the planner needs both.
  const nav = useNavigation<RootNav>();

  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO());
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [editSeriesSheet, setEditSeriesSheet] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ assignmentId: string; fromDate: ISODate } | null>(
    null,
  );
  const [changeBlockTarget, setChangeBlockTarget] = useState<{
    assignmentId: string;
    date: ISODate;
  } | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const blocks = useWorkoutStore((s) => s.blocks);
  const history = useWorkoutStore((s) => s.workoutHistory);
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const { streak } = useGamification();

  // Prune expired undo entries every 5s while the screen is mounted.
  const pruneExpired = useScheduleStore((s) => s.pruneExpiredDeletions);
  useEffect(() => {
    const interval = setInterval(pruneExpired, 5_000);
    return () => clearInterval(interval);
  }, [pruneExpired]);

  const dayState = useDayCardState(selectedDate);

  // Last completed session for the resolved block, used to feed kaiSignal.
  // WorkoutBlock has no flat `exercises` — walk content via getBlockExercises.
  const lastSession = useMemo(() => {
    if (!dayState.resolved) return null;
    const blockId = dayState.resolved.blockId;
    const last = history.find((h) => h.blockId === blockId);
    if (!last) return null;
    const target = blocks.find((b) => b.id === blockId);
    const targetSetCount = target
      ? getBlockExercises(target).reduce((acc, e) => acc + e.sets.length, 0)
      : 0;
    return { setCount: last.setCount, targetSetCount };
  }, [dayState.resolved, history, blocks]);

  const signal: KaiSignal | null = useMemo(
    () =>
      kaiSignal({
        selectedDate,
        isToday: dayState.isToday,
        isPast: dayState.isPast,
        resolved: dayState.resolved,
        streak: streak.current,
        blocksCount: blocks.length,
        hasActiveWorkout: !!activeWorkout,
        lastSession,
      }),
    [selectedDate, dayState, streak, blocks.length, activeWorkout, lastSession],
  );

  // First-workout hero: only until the first session lands in history.
  const firstWorkoutBlock = useMemo(() => {
    if (history.length > 0 || activeWorkout || blocks.length === 0) return null;
    return blocks.find((b) => b.is_favorite && !b.is_archived) ?? blocks[0];
  }, [history.length, activeWorkout, blocks]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleStart = useCallback(
    (block: WorkoutBlock, resolved: ResolvedAssignment | null) => {
      const ctx = {
        assignmentId: resolved?.assignmentId,
        scheduledDate: resolved?.date ?? selectedDate,
        source: 'today' as const,
      };
      startWorkout(block.id, ctx);
      nav.navigate('ActiveWorkout', { blockId: block.id, ...ctx });
    },
    [startWorkout, nav, selectedDate],
  );

  const handleResume = useCallback(
    (block: WorkoutBlock, resolved: ResolvedAssignment | null) => {
      nav.navigate('ActiveWorkout', {
        blockId: block.id,
        assignmentId: resolved?.assignmentId,
        scheduledDate: resolved?.date ?? selectedDate,
        source: 'today',
      });
    },
    [nav, selectedDate],
  );

  const handleCreateBlock = useCallback(() => {
    // Tab routes aren't part of RootStackParamList — cast to the tab nav shape.
    (nav as unknown as TabNav).navigate('WorkoutTab');
  }, [nav]);

  const handleSeeBlockFull = useCallback(
    (block: WorkoutBlock) => {
      (nav as unknown as TabNav).navigate('WorkoutTab', { highlightBlockId: block.id });
    },
    [nav],
  );

  const handlePlanWeek = useCallback(() => {
    // AI Lab is demoted out of the beta wedge (premise P3). Gate the only
    // navigation wire to it; the screen stays registered for deep links/dev.
    if (!isSurfaceVisible('aiLab')) return;
    nav.navigate('AILabScreen');
  }, [nav]);

  const handleOpenKai = useCallback(() => {
    nav.navigate('KaiToday');
  }, [nav]);

  // The calendar is demoted below the primary day card (Design v2). When the
  // user picks a day down there, scroll the focused-day card back into view so
  // the control→result link stays legible despite the reversed order.
  const handleSelectDate = useCallback(
    (d: ISODate) => {
      setSelectedDate(d);
      scrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
    },
    [reduceMotion],
  );

  const handleSignalAction = useCallback(
    (action: KaiSignal['action']) => {
      if (!action) return;
      switch (action.kind) {
        case 'create-block':
          handleCreateBlock();
          break;
        case 'assign':
          setAssignSheetOpen(true);
          break;
        case 'resume':
          if (activeWorkout) nav.navigate('ActiveWorkout', { blockId: activeWorkout.blockId });
          break;
      }
    },
    [handleCreateBlock, activeWorkout, nav],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          // Bottom padding clears the pinned ambient Kai bar (which itself floats
          // above the tab capsule) so no content ever hides behind it.
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 172 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: one dominant statement + the focused-day session card. The
            greeting owns nothing gold; the session card wears its discipline
            tint + an ink CTA. The single gold on this screen is the Kai orb in
            the ambient bar below. */}
        <HomeHero />
        {firstWorkoutBlock ? (
          <FirstWorkoutCTA block={firstWorkoutBlock} onStart={(b) => handleStart(b, null)} />
        ) : null}
        <DayCard
          date={selectedDate}
          onAssign={(d) => {
            setSelectedDate(d);
            setAssignSheetOpen(true);
          }}
          onStart={handleStart}
          onResume={handleResume}
          onChangeBlock={(assignmentId, date) => setChangeBlockTarget({ assignmentId, date })}
          onMove={(assignmentId, fromDate) => setMoveTarget({ assignmentId, fromDate })}
          onEditSeries={(assignmentId) => setEditSeriesSheet(assignmentId)}
          onCreateBlock={handleCreateBlock}
          onChooseTemplate={() => setTemplatePickerOpen(true)}
          onSeeBlockFull={handleSeeBlockFull}
          onPlanWeek={handlePlanWeek}
        />

        {/* Demoted zone — quieter, below the fold. Calendar sits closest to the
            card it drives; weekly stats / readiness / señal recede further. */}
        <CalendarView selectedDate={selectedDate} onSelect={handleSelectDate} />
        <ReadinessRings />
        <HomeHeroStats />
        <KaiSignalCard signal={signal} onAction={handleSignalAction} />
      </ScrollView>

      <AmbientKaiBar onPress={handleOpenKai} />

      <AssignBlockSheet
        visible={assignSheetOpen}
        initialDate={selectedDate}
        onClose={() => setAssignSheetOpen(false)}
      />
      <RecurrenceEditorSheet
        visible={!!editSeriesSheet}
        assignmentId={editSeriesSheet}
        selectedDate={selectedDate}
        onClose={() => setEditSeriesSheet(null)}
      />
      <MovePicker
        visible={!!moveTarget}
        assignmentId={moveTarget?.assignmentId ?? null}
        fromDate={moveTarget?.fromDate ?? null}
        onClose={() => setMoveTarget(null)}
      />
      <ChangeBlockPicker
        visible={!!changeBlockTarget}
        assignmentId={changeBlockTarget?.assignmentId ?? null}
        date={changeBlockTarget?.date ?? null}
        onClose={() => setChangeBlockTarget(null)}
      />
      <TemplatePickerSheet
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onCreated={() => {
          // After a fresh template instantiation the user is one tap from
          // assigning. Chain into the assign sheet on the currently-selected
          // date — keeps the empty → planned arc end-to-end in two taps.
          setTemplatePickerOpen(false);
          setAssignSheetOpen(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.void },
  content: {},
});
