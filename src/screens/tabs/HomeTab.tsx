// src/screens/tabs/HomeTab.tsx
// HomeTab wraps TodayPlanner and owns the first-launch coach-mark. The old
// 3-page PlannerTour is gone: the first Dashboard entry after onboarding shows
// the user's real space with a single contextual coach-mark anchored to their
// real first block, dismissable and first-time-only (gated by tourCompletedAt,
// so existing users are unaffected).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TodayPlanner from '../../features/planner/TodayPlanner';
import BlockCoachMark from '../../features/onboarding/BlockCoachMark';
import { shouldShowBlockCoachMark } from '../../features/onboarding/coachMarkGate';
import { useWorkoutStore } from '../../store/workoutStore';

export default function HomeTab() {
  const tourCompletedAt = useWorkoutStore((s) => s.tourCompletedAt);
  const blocks = useWorkoutStore((s) => s.blocks);
  const markTourCompleted = useWorkoutStore((s) => s.markTourCompleted);

  // The block the coach-mark names — the favorite (first) block, mirroring the
  // planner's own first-workout pick.
  const firstBlock = useMemo(
    () => blocks.find((b) => b.is_favorite && !b.is_archived) ?? blocks[0] ?? null,
    [blocks],
  );

  const [dismissed, setDismissed] = useState(false);
  const [settled, setSettled] = useState(false);

  const eligible =
    !dismissed && shouldShowBlockCoachMark({ tourCompletedAt, hasBlock: !!firstBlock });

  // Wait one beat after mount so the planner finishes layout before the
  // coach-mark fades in — otherwise it can flash before the screen has paint.
  useEffect(() => {
    if (!eligible) return;
    const id = setTimeout(() => setSettled(true), 350);
    return () => clearTimeout(id);
  }, [eligible]);

  const onDismiss = useCallback(() => {
    setDismissed(true);
    markTourCompleted();
  }, [markTourCompleted]);

  const showCoachMark = eligible && settled && !!firstBlock;

  return (
    <View style={styles.root}>
      <TodayPlanner />
      {showCoachMark && firstBlock ? (
        <BlockCoachMark blockName={firstBlock.name} onDismiss={onDismiss} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
