// KAIROS — Onboarding funnel events (pure, node-testable).
//
// The premium flow is presentational and must not import the analytics queue
// (AsyncStorage) or the store. Instead it emits a small, RN-free event union
// through an `onEvent` callback; the host screen maps each event to the real
// analytics catalogue and calls track(). This module owns that mapping so the
// event names/props are unit-tested and can't drift from ANALYTICS_EVENTS.
//
// Import only from `events` (plain consts) — never the index barrel — so the
// mapper stays free of AsyncStorage and runs under vitest's node env.

import { ANALYTICS_EVENTS, type AnalyticsEventName } from '../../../lib/analytics/events';

// Canonical, guest-first step order. Index = the `step` number. Auth is LAST —
// value (manuscrito → building → presentation) is delivered before the account
// is ever asked for.
export const ONBOARDING_STEP_ORDER = [
  'welcome',
  'manuscrito',
  'building',
  'presentation',
  'auth',
] as const;

export type OnboardingStepName = (typeof ONBOARDING_STEP_ORDER)[number] | string;

/** Position in the canonical order; -1 for off-path steps (still recorded). */
export function onboardingStepIndex(step: string): number {
  return (ONBOARDING_STEP_ORDER as readonly string[]).indexOf(step);
}

/** What happened, in flow terms — decoupled from analytics naming. */
export type OnboardingAnalyticsEvent =
  | { type: 'started' }
  | { type: 'step_viewed'; step: OnboardingStepName }
  | { type: 'step_completed'; step: OnboardingStepName }
  | { type: 'reveal_viewed' }
  | { type: 'reveal_action'; action: 'start' };

export interface MappedAnalyticsEvent {
  name: AnalyticsEventName;
  props?: Record<string, unknown>;
}

/** Translate a flow event to the real analytics catalogue entry + props. */
export function mapOnboardingEvent(event: OnboardingAnalyticsEvent): MappedAnalyticsEvent {
  switch (event.type) {
    case 'started':
      return { name: ANALYTICS_EVENTS.onboardingStarted };
    case 'step_viewed':
      return {
        name: ANALYTICS_EVENTS.quizStepViewed,
        props: { step: onboardingStepIndex(event.step), step_name: event.step },
      };
    case 'step_completed':
      return {
        name: ANALYTICS_EVENTS.onboardingStepCompleted,
        props: { step: onboardingStepIndex(event.step), step_name: event.step },
      };
    case 'reveal_viewed':
      return { name: ANALYTICS_EVENTS.planRevealViewed };
    case 'reveal_action':
      return { name: ANALYTICS_EVENTS.revealAction, props: { action: event.action } };
  }
}
