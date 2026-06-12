// KAIROS — onboarding motion hook (honors the OS "Reduce Motion" setting).
//
// Screens read durations/flags from here so every onboarding animation degrades
// consistently and accessibly. Thin native glue over the pure resolver in
// motion.ts (which is unit-tested).

import { useReducedMotion } from 'react-native-reanimated';
import { resolveMotionPlan, type MotionPlan } from './motion';

/** The onboarding motion plan for the current accessibility setting. */
export function useMotionPlan(): MotionPlan {
  const reduceMotion = useReducedMotion();
  return resolveMotionPlan(reduceMotion);
}
