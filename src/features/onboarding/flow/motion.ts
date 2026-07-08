// KAIROS — onboarding motion plan (pure).
//
// Centralizes the reduce-motion decision so every onboarding animation degrades
// the same accessible way. See docs/ONBOARDING_BEST_IN_CLASS.md §4. The native
// hook that reads the OS setting lives in useReducedMotion.ts; this file is
// pure so the timing logic is unit-tested directly.

export type MotionTier = 'micro' | 'standard' | 'complex';

export interface MotionPlan {
  /** Whether expressive motion (slides, scale, idle loops) is enabled. */
  expressive: boolean;
  /** Per-tier durations in ms, already reduce-motion aware. */
  durations: Record<MotionTier, number>;
  /** Whether idle loops (e.g. the logo "breathing") should run. */
  loops: boolean;
}

// Durations align with the design system (CLAUDE.md): micro 100ms, standard
// 180–280ms, complex layout shifts ≤480ms.
export const FULL_MOTION: MotionPlan = {
  expressive: true,
  durations: { micro: 100, standard: 240, complex: 460 },
  loops: true,
};

// Reduce-motion: collapse to near-instant cross-fades, no idle loops. Standard/
// complex stay non-zero so a fade is still legible rather than a jarring snap.
export const REDUCED_MOTION_PLAN: MotionPlan = {
  expressive: false,
  durations: { micro: 0, standard: 120, complex: 120 },
  loops: false,
};

export function resolveMotionPlan(reduceMotion: boolean): MotionPlan {
  return reduceMotion ? REDUCED_MOTION_PLAN : FULL_MOTION;
}

/** Duration for a motion tier, reduce-motion aware. */
export function motionDuration(plan: MotionPlan, tier: MotionTier): number {
  return plan.durations[tier];
}
