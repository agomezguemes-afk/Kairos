import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENTS } from '../../../lib/analytics/events';
import {
  mapOnboardingEvent,
  onboardingStepIndex,
  ONBOARDING_STEP_ORDER,
} from './onboardingAnalytics';

describe('onboardingStepIndex', () => {
  it('numbers the canonical steps in order', () => {
    expect(onboardingStepIndex('welcome')).toBe(0);
    expect(onboardingStepIndex('auth')).toBe(1);
    expect(onboardingStepIndex('manuscrito')).toBe(2);
    expect(onboardingStepIndex('presentation')).toBe(3);
  });

  it('returns -1 for off-path steps (still recorded, just unordered)', () => {
    expect(onboardingStepIndex('coach')).toBe(-1);
  });
});

describe('mapOnboardingEvent', () => {
  it('maps started to onboarding_started with no props', () => {
    expect(mapOnboardingEvent({ type: 'started' })).toEqual({
      name: ANALYTICS_EVENTS.onboardingStarted,
    });
  });

  it('maps step_viewed to quiz_step_viewed with numeric step + name', () => {
    expect(mapOnboardingEvent({ type: 'step_viewed', step: 'manuscrito' })).toEqual({
      name: ANALYTICS_EVENTS.quizStepViewed,
      props: { step: 2, step_name: 'manuscrito' },
    });
  });

  it('maps step_completed to onboarding_step_completed', () => {
    expect(mapOnboardingEvent({ type: 'step_completed', step: 'auth' })).toEqual({
      name: ANALYTICS_EVENTS.onboardingStepCompleted,
      props: { step: 1, step_name: 'auth' },
    });
  });

  it('maps reveal_viewed to plan_reveal_viewed', () => {
    expect(mapOnboardingEvent({ type: 'reveal_viewed' })).toEqual({
      name: ANALYTICS_EVENTS.planRevealViewed,
    });
  });

  it('maps reveal_action(start) to reveal_action with the action prop', () => {
    expect(mapOnboardingEvent({ type: 'reveal_action', action: 'start' })).toEqual({
      name: ANALYTICS_EVENTS.revealAction,
      props: { action: 'start' },
    });
  });

  it('covers every canonical step name', () => {
    for (const step of ONBOARDING_STEP_ORDER) {
      expect(onboardingStepIndex(step)).toBeGreaterThanOrEqual(0);
    }
  });
});
