import { beforeEach, describe, expect, it } from 'vitest';

import { ANALYTICS_EVENTS, getTrackedEventsByName, resetAnalytics } from '../analytics';
import {
  FREE_ALWAYS,
  PAYWALL_COPY,
  PRE_CHARGE_NOTICE_DAYS,
  TRIAL_DAYS,
  hasProAccess,
  isFeatureGated,
  isTrialActive,
  preChargeCopy,
  preChargeNotice,
  startTrialState,
  trackPaywallDismissed,
  trackPaywallViewed,
  trialDaysLeft,
  type Entitlement,
} from './paywall';

const DAY = 86_400_000;
const NOW = 1_780_000_000_000;
const FREE: Entitlement = { isPro: false, trial: null };

describe('gating', () => {
  it('never gates always-free features, even for a free user', () => {
    for (const f of FREE_ALWAYS) {
      expect(isFeatureGated(f, FREE, NOW)).toBe(false);
    }
  });

  it('keeps export and paywall-close free — the anti-dark-pattern guarantees', () => {
    expect(isFeatureGated('export_data', FREE, NOW)).toBe(false);
    expect(isFeatureGated('close_paywall', FREE, NOW)).toBe(false);
    expect(isFeatureGated('csv_import', FREE, NOW)).toBe(false);
  });

  it('gates Pro features for a free user with no trial', () => {
    expect(isFeatureGated('ai_coach_unlimited', FREE, NOW)).toBe(true);
    expect(isFeatureGated('unlimited_blocks', FREE, NOW)).toBe(true);
  });

  it('unlocks Pro features when isPro', () => {
    const pro: Entitlement = { isPro: true, trial: null };
    expect(isFeatureGated('ai_coach_unlimited', pro, NOW)).toBe(false);
    expect(hasProAccess(pro, NOW)).toBe(true);
  });

  it('unlocks Pro features during an active trial', () => {
    const ent: Entitlement = { isPro: false, trial: startTrialState(NOW) };
    expect(isFeatureGated('advanced_insights', ent, NOW + DAY)).toBe(false);
    expect(hasProAccess(ent, NOW + DAY)).toBe(true);
  });

  it('re-gates after the trial ends', () => {
    const ent: Entitlement = { isPro: false, trial: startTrialState(NOW) };
    const afterEnd = NOW + (TRIAL_DAYS + 1) * DAY;
    expect(isFeatureGated('advanced_insights', ent, afterEnd)).toBe(true);
    expect(hasProAccess(ent, afterEnd)).toBe(false);
  });
});

describe('trial lifecycle', () => {
  it('runs for exactly TRIAL_DAYS', () => {
    const t = startTrialState(NOW);
    expect(t.endsAt - t.startedAt).toBe(TRIAL_DAYS * DAY);
  });

  it('is active from start (inclusive) to end (exclusive)', () => {
    const t = startTrialState(NOW);
    expect(isTrialActive(t, NOW)).toBe(true);
    expect(isTrialActive(t, t.endsAt - 1)).toBe(true);
    expect(isTrialActive(t, t.endsAt)).toBe(false);
    expect(isTrialActive(null, NOW)).toBe(false);
  });

  it('reports whole days left', () => {
    const t = startTrialState(NOW);
    expect(trialDaysLeft(t, NOW)).toBe(TRIAL_DAYS);
    expect(trialDaysLeft(t, t.endsAt - DAY)).toBe(1);
    expect(trialDaysLeft(t, t.endsAt)).toBe(0);
  });
});

describe('pre-charge notice — warn before billing', () => {
  const t = startTrialState(NOW);

  it('is silent early in the trial', () => {
    expect(preChargeNotice(t, NOW)).toBeNull();
    expect(preChargeNotice(t, t.endsAt - (PRE_CHARGE_NOTICE_DAYS + 1) * DAY)).toBeNull();
  });

  it('fires inside the final notice window with the charge date', () => {
    const inside = t.endsAt - PRE_CHARGE_NOTICE_DAYS * DAY + 1;
    const notice = preChargeNotice(t, inside);
    expect(notice).not.toBeNull();
    expect(notice!.chargeAt).toBe(t.endsAt);
    expect(notice!.daysLeft).toBeGreaterThan(0);
  });

  it('is silent once the trial has ended', () => {
    expect(preChargeNotice(t, t.endsAt)).toBeNull();
  });

  it('produces human copy in Spanish, singular and plural', () => {
    expect(preChargeCopy({ chargeAt: t.endsAt, daysLeft: 1 })).toContain('1 día');
    expect(preChargeCopy({ chargeAt: t.endsAt, daysLeft: 2 })).toContain('2 días');
  });
});

describe('copy', () => {
  it('states the three honesty promises verbatim', () => {
    const joined = PAYWALL_COPY.promises.join(' ').toLowerCase();
    expect(joined).toContain('2 días antes de cobrar');
    expect(joined).toContain('exporta tus datos');
    expect(joined).toContain('cancela en un tap');
  });

  it('always offers a visible close (the X)', () => {
    expect(PAYWALL_COPY.closeLabel).toBeTruthy();
  });

  it('mentions the trial length in the CTA', () => {
    expect(PAYWALL_COPY.ctaLabel).toContain(String(TRIAL_DAYS));
  });
});

describe('analytics', () => {
  beforeEach(() => resetAnalytics());

  it('emits paywall_viewed and paywall_dismissed with the source', () => {
    trackPaywallViewed('onboarding_reveal');
    trackPaywallDismissed('onboarding_reveal');
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.paywall_viewed)[0].props).toEqual({
      source: 'onboarding_reveal',
    });
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.paywall_dismissed)[0].props).toEqual({
      source: 'onboarding_reveal',
    });
  });
});
