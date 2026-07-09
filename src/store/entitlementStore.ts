// src/store/entitlementStore.ts
//
// Persisted Pro/trial flag. Fake-door for beta — no RevenueCat yet; setPro is a
// manual grant that a real IAP callback replaces later. All the honesty logic
// (gating, pre-charge notice) lives in src/lib/paywall/paywall.ts; this store
// only holds and persists state and emits the funnel events.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ANALYTICS_EVENTS, track } from '../lib/analytics';
import {
  hasProAccess,
  preChargeNotice,
  startTrialState,
  type Entitlement,
  type PreChargeNotice,
  type TrialState,
} from '../lib/paywall/paywall';

interface EntitlementState {
  isPro: boolean;
  trial: TrialState | null;
  /** Set once the trial's pre-charge banner has been shown, to fire it once. */
  preChargeNoticedAt: number | null;

  /** Begin the free trial (idempotent while one is active). */
  startTrial: () => void;
  /** Manual Pro grant — the fake-door / future IAP callback seam. */
  setPro: (isPro: boolean) => void;
  /** Cancel in one tap: drops Pro + trial. No dark pattern. */
  cancel: () => void;
  /** Record that the pre-charge notice was surfaced (emits once). */
  acknowledgePreChargeNotice: (notice: PreChargeNotice) => void;
  reset: () => void;
}

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set, get) => ({
      isPro: false,
      trial: null,
      preChargeNoticedAt: null,

      startTrial: () => {
        const now = Date.now();
        if (hasProAccess(get(), now)) return; // already Pro or mid-trial
        set({ trial: startTrialState(now), preChargeNoticedAt: null });
        track(ANALYTICS_EVENTS.trial_started, { at: now });
      },

      setPro: (isPro) => set({ isPro }),

      cancel: () => set({ isPro: false, trial: null, preChargeNoticedAt: null }),

      acknowledgePreChargeNotice: (notice) => {
        if (get().preChargeNoticedAt !== null) return;
        set({ preChargeNoticedAt: Date.now() });
        track(ANALYTICS_EVENTS.pre_charge_notice_shown, {
          chargeAt: notice.chargeAt,
          daysLeft: notice.daysLeft,
        });
      },

      reset: () => set({ isPro: false, trial: null, preChargeNoticedAt: null }),
    }),
    {
      name: 'kairos_entitlement_store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Snapshot for gating in non-React contexts (isFeatureGated(feature, …)). */
export function getEntitlement(): Entitlement {
  const { isPro, trial } = useEntitlementStore.getState();
  return { isPro, trial };
}

/** Live pre-charge notice, or null. Read from React with a selector or here. */
export function currentPreChargeNotice(now: number = Date.now()): PreChargeNotice | null {
  return preChargeNotice(useEntitlementStore.getState().trial, now);
}
