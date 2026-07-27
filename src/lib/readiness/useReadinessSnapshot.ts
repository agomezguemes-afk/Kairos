// src/lib/readiness/useReadinessSnapshot.ts
//
// Single source of truth for "today's readiness + adaptation signal",
// assembled from live store state. Every consumer (ReadinessLine's headline,
// TodayPlanner's Kai signal, ActiveWorkoutScreen's progression suggestions)
// uses this hook instead of independently rebuilding a
// ReadinessBiometricContext — one assembly point, one behavior, no drift
// between surfaces.

import { useMemo } from 'react';
import { useWorkoutStore } from '../../store/workoutStore';
import { useHealthStore } from '../../store/healthStore';
import { useUserProfile } from '../../context/UserProfileContext';
import { computeReadiness, type ReadinessSnapshot } from './readiness';

function todayISODate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function useReadinessSnapshot(): ReadinessSnapshot {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const samples = useHealthStore((s) => s.samples);
  const { profile } = useUserProfile();

  return useMemo(() => {
    const today = todayISODate();
    const todaySample = samples.find((s) => s.date === today);
    return computeReadiness(history, Date.now(), {
      samples,
      today: { hrvMs: todaySample?.hrvMs ?? null, sleepHours: todaySample?.sleepHours ?? null },
      goal: profile.primaryGoal,
      weeklyFrequency: profile.weeklyFrequency,
    });
  }, [history, samples, profile.primaryGoal, profile.weeklyFrequency]);
}
