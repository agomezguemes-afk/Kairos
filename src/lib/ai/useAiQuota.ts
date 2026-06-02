// KAIROS — useAiQuota
// Proactive quota display for the chat UI: "27/30 mensajes hoy".
//
// Reads the user's tier from profiles and the rolling-24h count from the
// ai_quota_count_24h RPC. Cheap (single RPC call, single column on
// profiles); refresh is exposed so the chat screen can re-pull after
// every AI response or when a QuotaExceededError fires.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../../store/useAuthStore';

export interface AiQuotaSnapshot {
  tier: 'free' | 'pro';
  usedToday: number;
  dailyCap: number;
  remaining: number;
  isLoading: boolean;
  /** Hard error from the RPC. UI can ignore — quota tracking is non-essential. */
  error: string | null;
  /** Re-fetch from the server. Call after each AI message or 429. */
  refresh: () => Promise<void>;
}

// Mirror of the server policy in supabase/functions/_shared/tiers.ts.
// Kept in sync by convention — if the server cap changes, change here
// too. Worst case: client UI is one deploy behind, which only affects
// the "remaining" pill (the gate is enforced server-side anyway).
const CAP_BY_TIER = { free: 30, pro: 500 } as const;

export function useAiQuota(): AiQuotaSnapshot {
  const session = useAuthStore((s) => s.session);
  const [state, setState] = useState<Omit<AiQuotaSnapshot, 'refresh'>>({
    tier: 'free',
    usedToday: 0,
    dailyCap: CAP_BY_TIER.free,
    remaining: CAP_BY_TIER.free,
    isLoading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      // No auth → no quota tracking. Keep defaults and stop loading.
      setState((s) => ({ ...s, isLoading: false, error: null }));
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));

    // Parallel fetch: tier + 24h count.
    const [profileRes, countRes] = await Promise.all([
      supabase.from('profiles').select('subscription_tier').eq('id', userId).maybeSingle(),
      supabase.rpc('ai_quota_count_24h', { p_user_id: userId }),
    ]);

    if (profileRes.error && profileRes.error.code !== 'PGRST116') {
      setState((s) => ({ ...s, isLoading: false, error: profileRes.error!.message }));
      return;
    }
    if (countRes.error) {
      setState((s) => ({ ...s, isLoading: false, error: countRes.error!.message }));
      return;
    }

    const tier = (profileRes.data?.subscription_tier as 'free' | 'pro' | undefined) ?? 'free';
    const cap = CAP_BY_TIER[tier];
    const used = Number(countRes.data ?? 0);
    setState({
      tier,
      usedToday: used,
      dailyCap: cap,
      remaining: Math.max(0, cap - used),
      isLoading: false,
      error: null,
    });
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
