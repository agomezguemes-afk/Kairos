import { beforeEach, describe, expect, it } from 'vitest';
import {
  isOnboardedThisSession,
  markOnboardedThisSession,
  resetOnboardedSessionFlag,
  shouldShowPlannerTour,
} from './plannerTourGate';

describe('shouldShowPlannerTour', () => {
  it('shows for a returning user who has not seen it (onboarded a prior session)', () => {
    expect(shouldShowPlannerTour({ tourCompletedAt: null, onboardedThisSession: false })).toBe(
      true,
    );
  });

  it('defers on the same session onboarding just finished (momentum guard)', () => {
    expect(shouldShowPlannerTour({ tourCompletedAt: null, onboardedThisSession: true })).toBe(
      false,
    );
  });

  it('never shows again once completed — even fresh out of onboarding', () => {
    expect(
      shouldShowPlannerTour({
        tourCompletedAt: '2026-07-08T10:00:00.000Z',
        onboardedThisSession: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPlannerTour({
        tourCompletedAt: '2026-07-08T10:00:00.000Z',
        onboardedThisSession: false,
      }),
    ).toBe(false);
  });
});

describe('onboarded-this-session flag', () => {
  beforeEach(() => resetOnboardedSessionFlag());

  it('starts false (a cold start never defers)', () => {
    expect(isOnboardedThisSession()).toBe(false);
  });

  it('flips to true once marked, simulating a completed onboarding', () => {
    markOnboardedThisSession();
    expect(isOnboardedThisSession()).toBe(true);
    // Next-session simulation: the flag resets and the tour is allowed again.
    resetOnboardedSessionFlag();
    expect(
      shouldShowPlannerTour({
        tourCompletedAt: null,
        onboardedThisSession: isOnboardedThisSession(),
      }),
    ).toBe(true);
  });
});
