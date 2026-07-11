// KAIROS — STT usage tracking against the AI quota.
//
// Server-side ai_quota only sees proxied chat completions; STT goes
// direct to Groq (dev fallback) until the ai-stt Edge Function exists.
// So voice calls are counted here, on-device, in the same rolling-24h
// window the server uses, and useAiQuota folds them into the pill.
// Tracking is best-effort by design: a storage failure must never break
// the voice loop, only under-count it.

import type { KeyValueStorage } from '../../analytics/queue';
import type { SttUsageTracker } from './types';

/**
 * Quota units per STT call. whisper-large-v3-turbo costs $0.04/hour —
 * a ~10s push-to-talk utterance is ≈$0.0001, roughly 1/5 of one chat
 * completion (~1.5k tokens on llama-3.3-70b). 0.2 keeps a 15-utterance
 * gym session at ~3 quota units instead of eating half the free cap.
 */
export const STT_QUOTA_COST = 0.2;

/** STT calls → whole quota units. Ceil so usage is never invisible. */
export function sttQuotaUnits(callCount: number): number {
  if (callCount <= 0) return 0;
  return Math.ceil(callCount * STT_QUOTA_COST);
}

const STORAGE_KEY = 'kairos_stt_usage_v1';
const WINDOW_MS = 24 * 3600 * 1000;
// Bounds the persisted array; far above any realistic 24h of push-to-talk.
const MAX_TIMESTAMPS = 1000;

export function createSttUsageTracker(
  storage: KeyValueStorage,
  key: string = STORAGE_KEY,
): SttUsageTracker {
  // In-memory mirror so a broken storage still counts within the session.
  let cache: number[] | null = null;

  async function hydrate(now: number): Promise<number[]> {
    if (cache === null) {
      try {
        const raw = await storage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as { timestamps?: unknown }) : null;
        cache = Array.isArray(parsed?.timestamps)
          ? parsed.timestamps.filter(
              (t): t is number => typeof t === 'number' && Number.isFinite(t),
            )
          : [];
      } catch {
        // Corrupt or unreadable payload → start fresh rather than block voice.
        cache = [];
      }
    }
    cache = cache.filter((t) => now - t < WINDOW_MS);
    return cache;
  }

  return {
    async record(now: number = Date.now()): Promise<void> {
      const list = await hydrate(now);
      list.push(now);
      if (list.length > MAX_TIMESTAMPS) list.splice(0, list.length - MAX_TIMESTAMPS);
      cache = list;
      try {
        await storage.setItem(key, JSON.stringify({ timestamps: list }));
      } catch {
        // Persistence is best-effort; the in-memory cache still counts this session.
      }
    },

    async count24h(now: number = Date.now()): Promise<number> {
      return (await hydrate(now)).length;
    },

    async clear(): Promise<void> {
      cache = [];
      try {
        await storage.removeItem(key);
      } catch {
        // Same best-effort stance as record().
      }
    },
  };
}

// ======================== SHARED INSTANCE ========================

let shared: SttUsageTracker | null = null;

/**
 * The app-wide tracker. Singleton so transcribeAudio (writer) and
 * useAiQuota (reader) agree even when the in-memory fallback is active.
 */
export function sharedSttUsageTracker(): SttUsageTracker {
  if (!shared) shared = createSttUsageTracker(resolveDefaultStorage());
  return shared;
}

function resolveDefaultStorage(): KeyValueStorage {
  try {
    // Lazy require keeps the RN storage module out of the node test graph
    // (same pattern as conversation/defaultDeps.ts).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage') as {
      default: KeyValueStorage;
    };
    return mod.default;
  } catch {
    // Node / storage unavailable → session-scoped memory. Under-counts
    // across restarts, which only makes the pill optimistic, never blocking.
    const mem = new Map<string, string>();
    return {
      getItem: async (k) => mem.get(k) ?? null,
      setItem: async (k, v) => {
        mem.set(k, v);
      },
      removeItem: async (k) => {
        mem.delete(k);
      },
    };
  }
}
