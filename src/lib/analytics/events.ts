// src/lib/analytics/events.ts
// Central registry of analytics event names. One source of truth so callers
// never pass free-form strings — a typo becomes a type error, and the funnel
// stays greppable. DEV-U emits the onboarding/paywall funnel events; DEV-L
// owns the Kai + data-ownership events. Everyone imports from here.

export const ANALYTICS_EVENTS = {
  // ── Onboarding funnel (emitted by DEV-U screens) ──────────────────────────
  onboarding_started: 'onboarding_started',
  onboarding_step_answered: 'onboarding_step_answered',
  onboarding_reveal_shown: 'onboarding_reveal_shown',
  onboarding_completed: 'onboarding_completed',

  // ── Kai one-tap next step (L-B) ───────────────────────────────────────────
  kai_signal_viewed: 'kai_signal_viewed',
  kai_action_applied: 'kai_action_applied',

  // ── Paywall, anti-dark-pattern (L-C) ──────────────────────────────────────
  paywall_viewed: 'paywall_viewed',
  paywall_dismissed: 'paywall_dismissed',
  trial_started: 'trial_started',
  pre_charge_notice_shown: 'pre_charge_notice_shown',

  // ── Data ownership (L-C export / L-D import) ──────────────────────────────
  data_exported: 'data_exported',
  data_imported: 'data_imported',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Flat, serializable properties. Keep values primitive so any sink can ship them. */
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;
