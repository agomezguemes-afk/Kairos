// src/screens/tabs/HomeTab.tsx
// HomeTab is a thin wrapper around TodayPlanner. It also owns the first-launch
// PlannerTour overlay so the tour is independent of the planner's internals —
// the planner doesn't need to know it's being demoed.

import React, { useEffect, useState } from 'react';
import TodayPlanner from '../../features/planner/TodayPlanner';
import PlannerTour from '../../features/onboarding/PlannerTour';
import { useWorkoutStore } from '../../store/workoutStore';

export default function HomeTab() {
  const tourCompletedAt = useWorkoutStore((s) => s.tourCompletedAt);
  const [tourOpen, setTourOpen] = useState(false);

  // Wait one beat after mount so the planner finishes layout before the modal
  // takes over. Without this the modal can flash before the screen has paint.
  useEffect(() => {
    if (tourCompletedAt != null) return;
    const id = setTimeout(() => setTourOpen(true), 250);
    return () => clearTimeout(id);
  }, [tourCompletedAt]);

  return (
    <>
      <TodayPlanner />
      <PlannerTour visible={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
}
