// src/features/planner/TodayPlanner.tsx
// Top-level planner — header + calendar + day card + signal card + sheets.
// Knows how to wire every handler the variants need; everything else is a
// dumb component.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../theme/tokens';
import PlannerHeader from './components/PlannerHeader';
import CalendarView from './components/CalendarView';
import DayCard from './components/DayCard';
import KaiSignalCard from './components/KaiSignal';
import AssignBlockSheet from './components/AssignBlockSheet';
import RecurrenceEditorSheet from './components/RecurrenceEditorSheet';
import MovePicker from './components/MovePicker';
import ChangeBlockPicker from './components/ChangeBlockPicker';

import { todayISO } from './lib/dates';
import { kaiSignal, type KaiSignal } from './lib/kaiSignal';
import { useDayCardState } from './hooks/useDayCardState';
import { useWorkoutStore } from '../../store/workoutStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useGamification } from '../../context/GamificationContext';
import type { ISODate, ResolvedAssignment } from '../../types/schedule';
import { getBlockExercises, type WorkoutBlock } from '../../types/core';
import type { RootStackParamList, DashboardTabParamList } from '../../types/navigation';

type RootNav = NativeStackNavigationProp<RootStackParamList>;
type TabNav  = NavigationProp<DashboardTabParamList>;

export default function TodayPlanner() {
  const insets = useSafeAreaInsets();
  // Single hook for both root-stack and parent tab navigation. Cast at the
  // call site instead of choosing a single generic — the planner needs both.
  const nav = useNavigation<RootNav>();

  const [selectedDate, setSelectedDate]         = useState<ISODate>(todayISO());
  const [assignSheetOpen, setAssignSheetOpen]   = useState(false);
  const [editSeriesSheet, setEditSeriesSheet]   = useState<string | null>(null);
  const [moveTarget, setMoveTarget]             = useState<{ assignmentId: string; fromDate: ISODate } | null>(null);
  const [changeBlockTarget, setChangeBlockTarget] = useState<{ assignmentId: string; date: ISODate } | null>(null);

  const startWorkout  = useWorkoutStore((s) => s.startWorkout);
  const blocks        = useWorkoutStore((s) => s.blocks);
  const history       = useWorkoutStore((s) => s.workoutHistory);
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const { streak }    = useGamification();

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
        isToday:          dayState.isToday,
        isPast:           dayState.isPast,
        resolved:         dayState.resolved,
        streak:           streak.current,
        blocksCount:      blocks.length,
        hasActiveWorkout: !!activeWorkout,
        lastSession,
      }),
    [selectedDate, dayState, streak.current, blocks.length, activeWorkout, lastSession],
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleStart = useCallback((block: WorkoutBlock, resolved: ResolvedAssignment | null) => {
    const ctx = {
      assignmentId:  resolved?.assignmentId,
      scheduledDate: resolved?.date ?? selectedDate,
      source:        'today' as const,
    };
    startWorkout(block.id, ctx);
    nav.navigate('ActiveWorkout', { blockId: block.id, ...ctx });
  }, [startWorkout, nav, selectedDate]);

  const handleResume = useCallback((block: WorkoutBlock, resolved: ResolvedAssignment | null) => {
    nav.navigate('ActiveWorkout', {
      blockId:       block.id,
      assignmentId:  resolved?.assignmentId,
      scheduledDate: resolved?.date ?? selectedDate,
      source:        'today',
    });
  }, [nav, selectedDate]);

  const handleCreateBlock = useCallback(() => {
    // Tab routes aren't part of RootStackParamList — cast to the tab nav shape.
    (nav as unknown as TabNav).navigate('WorkoutTab');
  }, [nav]);

  const handleSeeBlockFull = useCallback((block: WorkoutBlock) => {
    (nav as unknown as TabNav).navigate('WorkoutTab', { highlightBlockId: block.id });
  }, [nav]);

  const handlePlanWeek = useCallback(() => {
    (nav as unknown as TabNav).navigate('AILabTab');
  }, [nav]);

  const handleSignalAction = useCallback((action: KaiSignal['action']) => {
    if (!action) return;
    switch (action.kind) {
      case 'create-block': handleCreateBlock(); break;
      case 'assign':       setAssignSheetOpen(true); break;
      case 'resume':
        if (activeWorkout) nav.navigate('ActiveWorkout', { blockId: activeWorkout.blockId });
        break;
    }
  }, [handleCreateBlock, activeWorkout, nav]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PlannerHeader />
        <CalendarView selectedDate={selectedDate} onSelect={setSelectedDate} />
        <DayCard
          date={selectedDate}
          onAssign={(d) => { setSelectedDate(d); setAssignSheetOpen(true); }}
          onStart={handleStart}
          onResume={handleResume}
          onChangeBlock={(assignmentId, date) => setChangeBlockTarget({ assignmentId, date })}
          onMove={(assignmentId, fromDate) => setMoveTarget({ assignmentId, fromDate })}
          onEditSeries={(assignmentId) => setEditSeriesSheet(assignmentId)}
          onCreateBlock={handleCreateBlock}
          onSeeBlockFull={handleSeeBlockFull}
          onPlanWeek={handlePlanWeek}
        />
        <KaiSignalCard signal={signal} onAction={handleSignalAction} />
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg.void },
  content: {},
});
