// Canonical funnel event names (BACKLOG sprint "Onboarding que activa").
// track() accepts any string — this catalogue exists so emitters across
// DEV-L (store/lib) and DEV-U (screens) never drift on spelling.

export const ANALYTICS_EVENTS = {
  /** Quiz mounted for the first time. */
  onboardingStarted: 'onboarding_started',
  /** Quiz page became visible. Props: { step: number }. */
  quizStepViewed: 'quiz_step_viewed',
  /** Quiz page answered/advanced. Props: { step: number }. */
  onboardingStepCompleted: 'onboarding_step_completed',
  /** Space built. Props: { source: 'ai' | 'template', duration_ms: number }. */
  spaceGenerated: 'space_generated',
  /** Reveal screen visible with blocks + mini-week. */
  planRevealViewed: 'plan_reveal_viewed',
  /** Props: { action: 'start' | 'adjust' | 'regenerate' }. */
  revealAction: 'reveal_action',
  paywallViewed: 'paywall_viewed',
  paywallDismissed: 'paywall_dismissed',
  /** Emitted by workoutStore.completeOnboarding — the canonical flag flip. */
  onboardingCompleted: 'onboarding_completed',
  firstWorkoutStarted: 'first_workout_started',
  firstWorkoutCompleted: 'first_workout_completed',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
