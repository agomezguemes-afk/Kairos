import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ANALYTICS_EVENTS, getTrackedEventsByName, resetAnalytics } from '../lib/analytics';
import { TRIAL_DAYS } from '../lib/paywall/paywall';
import { currentPreChargeNotice, getEntitlement, useEntitlementStore } from './entitlementStore';

// Mock AsyncStorage so the persisted store imports under the node test env.
// vitest hoists vi.mock above the imports, so the store sees the mock.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

const DAY = 86_400_000;
const NOW = 1_780_000_000_000;

describe('entitlementStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    resetAnalytics();
    useEntitlementStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('starts a trial spanning TRIAL_DAYS and emits trial_started', () => {
    useEntitlementStore.getState().startTrial();
    const { trial } = useEntitlementStore.getState();
    expect(trial).not.toBeNull();
    expect(trial!.startedAt).toBe(NOW);
    expect(trial!.endsAt).toBe(NOW + TRIAL_DAYS * DAY);
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.trial_started)).toHaveLength(1);
  });

  it('is idempotent while a trial is active', () => {
    useEntitlementStore.getState().startTrial();
    const first = useEntitlementStore.getState().trial;
    vi.setSystemTime(NOW + DAY);
    useEntitlementStore.getState().startTrial();
    expect(useEntitlementStore.getState().trial).toEqual(first);
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.trial_started)).toHaveLength(1);
  });

  it('does not start a trial when already Pro', () => {
    useEntitlementStore.getState().setPro(true);
    useEntitlementStore.getState().startTrial();
    expect(useEntitlementStore.getState().trial).toBeNull();
  });

  it('cancels Pro and trial in one call — no dark pattern', () => {
    useEntitlementStore.getState().setPro(true);
    useEntitlementStore.getState().startTrial(); // no-op while pro, but set trial manually
    useEntitlementStore.setState({ trial: { startedAt: NOW, endsAt: NOW + DAY } });
    useEntitlementStore.getState().cancel();
    const ent = getEntitlement();
    expect(ent.isPro).toBe(false);
    expect(ent.trial).toBeNull();
  });

  it('exposes a gating snapshot via getEntitlement', () => {
    useEntitlementStore.getState().setPro(true);
    expect(getEntitlement()).toEqual({ isPro: true, trial: null });
  });

  it('surfaces the pre-charge notice only in the final window, and acknowledges once', () => {
    useEntitlementStore.getState().startTrial();
    expect(currentPreChargeNotice(NOW)).toBeNull();

    const insideWindow = NOW + (TRIAL_DAYS - 1) * DAY;
    vi.setSystemTime(insideWindow);
    const notice = currentPreChargeNotice(insideWindow);
    expect(notice).not.toBeNull();

    useEntitlementStore.getState().acknowledgePreChargeNotice(notice!);
    useEntitlementStore.getState().acknowledgePreChargeNotice(notice!);
    expect(getTrackedEventsByName(ANALYTICS_EVENTS.pre_charge_notice_shown)).toHaveLength(1);
    expect(useEntitlementStore.getState().preChargeNoticedAt).not.toBeNull();
  });
});
