// The engine's learned state, kept between passes so it never redoes the
// past. Anything computed about a past session (the forecast it would have
// got, how it went, the context it started from) is stored under a key that
// fingerprints exactly the data it depends on. If that data changes (an old
// workout imported from Health, a session edited), the fingerprint changes
// and only the affected entries are recomputed; everything else is a lookup.
// Each pass also has a budget of fresh computations, so a cold start (first
// launch after an update, a restore) spreads over several passes instead of
// blocking one.

/** Bump when a model changes what a cached value means. */
export const CACHE_VERSION = 1;

export interface EngineCache {
  v: number;
  entries: Record<string, unknown>;
}

/** FNV-1a 32-bit: fast, stable, good enough to detect a changed input. */
export function hash(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Rolling fingerprints of a time-ordered stream: `until(t)` is the
 * fingerprint of every item at or before t, in O(log n).
 */
export class Timeline {
  private times: number[] = [];
  private prefix: number[] = [];

  constructor(items: { t: number; key: string }[]) {
    const sorted = [...items].sort((a, b) => a.t - b.t || (a.key < b.key ? -1 : 1));
    let h = 0x811c9dc5;
    for (const it of sorted) {
      h = hash(it.key, h);
      this.times.push(it.t);
      this.prefix.push(h);
    }
  }

  until(t: number): string {
    let lo = 0;
    let hi = this.times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.times[mid] <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo === 0 ? '0' : `${lo}.${this.prefix[lo - 1].toString(36)}`;
  }
}

export class Memo {
  private prev: Record<string, unknown>;
  private next: Record<string, unknown> = {};
  private fresh = 0;
  private refused = false;

  private deadline: number;

  constructor(
    cache: EngineCache | null | undefined,
    /** Fresh computations allowed this pass; the rest wait for the next one. */
    private budget = Infinity,
    /** Wall-clock time allowed for fresh computations (ms), whatever the device. */
    budgetMs = Infinity,
  ) {
    this.prev = cache?.v === CACHE_VERSION ? cache.entries : {};
    this.deadline = Date.now() + budgetMs;
  }

  /** The cached value, or a fresh one while the budget lasts; null otherwise. */
  get<T>(key: string, compute: () => T): T | null {
    if (key in this.next) return this.next[key] as T;
    if (key in this.prev) {
      this.next[key] = this.prev[key];
      return this.prev[key] as T;
    }
    // At least one fresh computation per pass, so progress is guaranteed.
    if (this.fresh >= this.budget || (this.fresh > 0 && Date.now() > this.deadline)) {
      this.refused = true;
      return null;
    }
    this.fresh++;
    const value = compute();
    this.next[key] = value;
    return value;
  }

  /** Entries from the last pass that this pass no longer used. */
  evicted(): [string, unknown][] {
    return Object.entries(this.prev).filter(([k]) => !(k in this.next));
  }

  /** True when something was left for the next pass. */
  get pending(): boolean {
    return this.refused;
  }

  computed(): number {
    return this.fresh;
  }

  snapshot(): EngineCache {
    return { v: CACHE_VERSION, entries: this.next };
  }
}

/** Fingerprint of one object's content. */
export const fingerprint = (value: unknown) => hash(JSON.stringify(value)).toString(36);

/** A year-old observation counts a quarter of today's. */
export const HALF_LIFE_DAYS = 180;

/** Weight of something `ageMs` old: all data counts, recent data counts more. */
export const decay = (ageMs: number) =>
  Math.pow(2, -Math.max(0, ageMs) / (HALF_LIFE_DAYS * 86_400_000));
