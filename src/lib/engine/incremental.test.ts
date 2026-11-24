import { describe, expect, it } from 'vitest';

import type { CheckIn, SessionLog } from '../adaptive';
import { decay, HALF_LIFE_DAYS, Memo, Timeline } from './cache';
import { emptyArchive, foldEpisodes, foldForecasts, archivedForecasts } from './archive';
import { consolidate, type ConsolidationInput } from './consolidate';
import { REPLAY_MAX } from './backtest';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86_400_000;

function history(n: number): { sessions: SessionLog[]; checkins: CheckIn[] } {
  const sessions: SessionLog[] = Array.from({ length: n }, (_, i) => {
    const start = NOW.getTime() - (n - i) * 2 * D;
    return {
      id: `s${i}`,
      draftSessionId: 'ds1',
      title: 'F',
      sport: 'strength',
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(start + 3_000_000).toISOString(),
      durationMin: 50,
      rpe: 6 + (i % 3),
      movements: [
        {
          movementId: 'back_squat',
          target: { sets: 3, repsMin: 5, rir: 2 },
          sets: [1, 2, 3].map(() => ({
            reps: 5 - (i % 4 === 0 ? 1 : 0),
            loadKg: 80 + (i % 30),
            rir: 2,
            completed: true,
          })),
        },
      ],
    };
  });
  const checkins: CheckIn[] = sessions.map((s, i) => ({
    id: `c${i}`,
    at: new Date(new Date(s.startedAt).getTime() - 3_600_000).toISOString(),
    kind: 'pre',
    sleep: 2 + (i % 4),
    soreness: 1 + (i % 3),
    pain: i % 37 === 5,
  }));
  return { sessions, checkins };
}

const base = (sessions: SessionLog[], checkins: CheckIn[]): ConsolidationInput => ({
  plan: null,
  sessions,
  checkins,
  experiments: [],
  trials: [],
  now: NOW,
});

describe('engine cache', () => {
  it('timeline fingerprints change only for the affected prefix', () => {
    const a = new Timeline([
      { t: 1, key: 'a' },
      { t: 5, key: 'b' },
    ]);
    const b = new Timeline([
      { t: 1, key: 'a' },
      { t: 5, key: 'B' },
    ]);
    expect(a.until(0)).toBe('0');
    expect(a.until(3)).toBe(b.until(3));
    expect(a.until(5)).not.toBe(b.until(5));
  });

  it('memo reuses, respects the budget and reports what it dropped', () => {
    const m = new Memo(null, 1);
    expect(m.get('x', () => 1)).toBe(1);
    expect(m.get('y', () => 2)).toBeNull();
    expect(m.pending).toBe(true);
    const next = new Memo(m.snapshot(), 0);
    expect(next.get('x', () => 99)).toBe(1);
    expect(new Memo({ v: -1, entries: { x: 1 } }).get('x', () => 7)).toBe(7);
    const third = new Memo(next.snapshot());
    third.get('z', () => 3);
    expect(third.evicted().map(([k]) => k)).toEqual(['x']);
  });

  it('decay halves every half-life and never reaches zero', () => {
    expect(decay(0)).toBe(1);
    expect(decay(HALF_LIFE_DAYS * D)).toBeCloseTo(0.5);
    expect(decay(10 * HALF_LIFE_DAYS * D)).toBeGreaterThan(0);
  });
});

describe('incremental consolidation', () => {
  it('a warm pass reproduces a cold one exactly, computing almost nothing', () => {
    const { sessions, checkins } = history(60);
    const cold = consolidate({ ...base(sessions, checkins), budget: Infinity });
    const warm = consolidate({ ...base(sessions, checkins), cache: cold.cache, budget: 0 });
    expect(warm.pending).toBe(false);
    expect(warm.calibration).toEqual(cold.calibration);
    expect(warm.memory).toEqual(cold.memory);
    expect(warm.dayPlan).toEqual(cold.dayPlan);
  });

  it('a cold start spreads over passes and converges to the full result', () => {
    const { sessions, checkins } = history(60);
    const full = consolidate({ ...base(sessions, checkins), budget: Infinity });
    let c = consolidate({ ...base(sessions, checkins), budget: 10 });
    expect(c.pending).toBe(true);
    let passes = 1;
    while (c.pending && passes < 30) {
      c = consolidate({ ...base(sessions, checkins), cache: c.cache, budget: 10 });
      passes++;
    }
    expect(c.pending).toBe(false);
    expect(passes).toBeGreaterThan(2);
    expect(c.calibration).toEqual(full.calibration);
  });

  it('changing an old session recomputes what depends on it, not before', () => {
    const { sessions, checkins } = history(40);
    const first = consolidate({ ...base(sessions, checkins), budget: Infinity });
    const edited = sessions.map((s, i) => (i === 30 ? { ...s, rpe: 10 } : s));
    const again = consolidate({ ...base(edited, checkins), cache: first.cache, budget: Infinity });
    const keys = (c: typeof first) => new Set(Object.keys(c.cache.entries));
    const before = keys(first);
    const fresh = [...keys(again)].filter((k) => !before.has(k) && k.startsWith('r:'));
    // Sessions 30..39 depend on session 30 (it ends before they start); 0..29 don't.
    expect(fresh.length).toBe(10);
  });

  it('sessions leaving the window are folded into the archive, not lost', () => {
    const { sessions, checkins } = history(REPLAY_MAX + 20);
    // Pass 1 sees the first REPLAY_MAX + 10, pass 2 everything: 10 cases leave the window.
    const early = sessions.slice(0, REPLAY_MAX + 10);
    const p1 = consolidate({ ...base(early, checkins), budget: Infinity });
    const p2 = consolidate({
      ...base(sessions, checkins),
      cache: p1.cache,
      archive: p1.archive,
      budget: Infinity,
    });
    const bins = p2.archive.readiness.bins.reduce((a, b) => a + b.w, 0);
    expect(bins).toBeGreaterThan(0);
    expect(p2.archive.prototypes.length).toBeGreaterThan(0);
    expect(p2.memory.some((e) => e.sessionId.startsWith('proto-'))).toBe(true);
    // Folding is idempotent: a third identical pass adds nothing.
    const p3 = consolidate({
      ...base(sessions, checkins),
      cache: p2.cache,
      archive: p2.archive,
      budget: Infinity,
    });
    expect(p3.archive.readiness.bins.reduce((a, b) => a + b.w, 0)).toBeCloseTo(bins, 6);
  });

  it('stays fast however long the history: 1000 sessions, warm pass', () => {
    const { sessions, checkins } = history(1000);
    let c = consolidate({ ...base(sessions, checkins), budget: Infinity });
    // A new session arrives: one fresh case, everything else cached.
    const next: SessionLog = {
      ...sessions[sessions.length - 1],
      id: 'new',
      startedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
      endedAt: new Date(NOW.getTime() - 600_000).toISOString(),
    };
    const t = performance.now();
    c = consolidate({
      ...base([...sessions, next], checkins),
      cache: c.cache,
      archive: c.archive,
    });
    const elapsed = performance.now() - t;
    expect(c.pending).toBe(false);
    expect(elapsed).toBeLessThan(400);
  }, 120_000);
});

describe('archive', () => {
  it('folded forecasts come back as weighted bins, older ones lighter', () => {
    const t = NOW.getTime();
    const recent = { at: new Date(t - D).toISOString(), p: 0.75, outcome: 1 };
    const old = { at: new Date(t - 400 * D).toISOString(), p: 0.72, outcome: 0 };
    const f = foldForecasts(emptyArchive().readiness, [old, recent], t);
    const [bin] = archivedForecasts(f, t);
    expect(bin.w).toBeLessThan(2);
    expect(bin.w).toBeGreaterThan(1);
    // The recent hit outweighs the old miss.
    expect(bin.outcome).toBeGreaterThan(0.5);
    expect(foldForecasts(f, [old, recent], t)).toEqual(f);
  });

  it('similar days merge into one prototype; different days stay apart', () => {
    const ctx = { p: 0.7, debt: 0, recovered: 1, ratio: 1, gap: 2, soreness: 1 };
    const ep = (i: number, over = {}, bad = false) => ({
      sessionId: `e${i}`,
      at: new Date(NOW.getTime() - (100 - i) * D).toISOString(),
      context: { ...ctx, ...over },
      action: 'full' as const,
      completion: 1,
      perf: 0,
      pain: false,
      bad,
    });
    const { prototypes } = foldEpisodes(
      [],
      [ep(1), ep(2, { debt: 0.5 }, true), ep(3, { p: 0.3, debt: 6 })],
      0,
      NOW.getTime(),
    );
    expect(prototypes).toHaveLength(2);
    const merged = prototypes.find((p) => p.context.p > 0.5)!;
    expect(merged.badShare).toBeGreaterThan(0.3);
    expect(merged.badShare).toBeLessThan(0.7);
  });
});
