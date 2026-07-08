import { describe, expect, it } from 'vitest';
import { FULL_MOTION, motionDuration, REDUCED_MOTION_PLAN, resolveMotionPlan } from './motion';

describe('resolveMotionPlan', () => {
  it('returns full motion when reduce-motion is off', () => {
    expect(resolveMotionPlan(false)).toBe(FULL_MOTION);
    expect(resolveMotionPlan(false).expressive).toBe(true);
    expect(resolveMotionPlan(false).loops).toBe(true);
  });

  it('collapses to the reduced plan when reduce-motion is on', () => {
    const plan = resolveMotionPlan(true);
    expect(plan).toBe(REDUCED_MOTION_PLAN);
    expect(plan.expressive).toBe(false);
    expect(plan.loops).toBe(false);
    expect(plan.durations.micro).toBe(0);
  });

  it('keeps reduced standard/complex non-zero so fades stay legible', () => {
    const plan = resolveMotionPlan(true);
    expect(plan.durations.standard).toBeGreaterThan(0);
    expect(plan.durations.complex).toBeGreaterThan(0);
    // Reduced is never slower than full.
    expect(plan.durations.standard).toBeLessThanOrEqual(FULL_MOTION.durations.standard);
    expect(plan.durations.complex).toBeLessThanOrEqual(FULL_MOTION.durations.complex);
  });

  it('full-motion durations respect the design-system bounds', () => {
    expect(FULL_MOTION.durations.micro).toBeLessThanOrEqual(100);
    expect(FULL_MOTION.durations.standard).toBeGreaterThanOrEqual(180);
    expect(FULL_MOTION.durations.standard).toBeLessThanOrEqual(280);
    expect(FULL_MOTION.durations.complex).toBeLessThanOrEqual(480);
  });
});

describe('motionDuration', () => {
  it('reads the tier duration from the plan', () => {
    expect(motionDuration(FULL_MOTION, 'standard')).toBe(240);
    expect(motionDuration(REDUCED_MOTION_PLAN, 'micro')).toBe(0);
  });
});
