import { describe, expect, it } from 'vitest';
import { think, type ActivitySnapshot } from './brain';
import { EMPTY_MEMORY, observeProposalDecision, type KaiMemory } from './memory';
import type { MetricPoint } from './metricTrend';

const WEEK = 7 * 24 * 3600 * 1000;
const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const at = (week: number, value: number): MetricPoint => ({ t: NOW - week * WEEK, value });

const CALM: ActivitySnapshot = {
  daysSinceLastWorkout: 1,
  sessionsLast7Days: 3,
  domainCounts: { strength: 2, running: 1 },
  streak: 5,
  blocksCount: 4,
};

describe('think (passive loop, composed)', () => {
  it('stays silent when nothing is worth saying', () => {
    expect(think(EMPTY_MEMORY, CALM, NOW)).toEqual([]);
  });

  it('derives a PR from a recent metric best and celebrates it', () => {
    const snap: ActivitySnapshot = {
      ...CALM,
      metricSeries: { Banca: [at(3, 90), at(2, 95), at(0, 102)] }, // best is now → recent PR
    };
    const out = think(EMPTY_MEMORY, snap, NOW, 1);
    expect(out).toHaveLength(1);
    expect(out[0].tone).toBe('celebrate');
    expect(out[0].headline).toMatch(/Banca/);
  });

  it('derives a plateau from a stale metric best', () => {
    const snap: ActivitySnapshot = {
      ...CALM,
      // best (120) 5 weeks ago, flat since → plateau
      metricSeries: { Press: [at(6, 118), at(5, 120), at(3, 119), at(1, 120), at(0, 119)] },
    };
    const out = think(EMPTY_MEMORY, snap, NOW, 2);
    expect(out.some((p) => p.kind === 'insight' && p.headline.includes('Press'))).toBe(true);
  });

  it('treats a lower-is-better metric correctly (faster 5k = PR, not plateau)', () => {
    const snap: ActivitySnapshot = {
      ...CALM,
      metricSeries: { '5k': [at(3, 1500), at(2, 1470), at(0, 1430)] },
      lowerIsBetter: ['5k'],
    };
    const out = think(EMPTY_MEMORY, snap, NOW, 1);
    expect(out[0].tone).toBe('celebrate');
  });

  it('respects learned bias: a kind the user keeps dismissing is dropped', () => {
    // Build a memory that dismisses "balance" repeatedly.
    let mem: KaiMemory = EMPTY_MEMORY;
    for (let i = 0; i < 3; i++) mem = observeProposalDecision(mem, 'balance', false, i);
    const snap: ActivitySnapshot = {
      ...CALM,
      sessionsLast7Days: 2,
      domainCounts: { strength: 6, running: 0 }, // would trigger balance
    };
    const withMem = think(mem, snap, NOW, 3);
    expect(withMem.some((p) => p.kind === 'balance')).toBe(false);
    // sanity: without that bias, balance would appear
    const withoutMem = think(EMPTY_MEMORY, snap, NOW, 3);
    expect(withoutMem.some((p) => p.kind === 'balance')).toBe(true);
  });

  it('caps to max, highest priority first', () => {
    const snap: ActivitySnapshot = {
      ...CALM,
      sessionsLast7Days: 6, // deload
      metricSeries: { Sentadilla: [at(2, 140), at(1, 145), at(0, 150)] }, // PR
    };
    const out = think(EMPTY_MEMORY, snap, NOW, 1);
    expect(out).toHaveLength(1);
    expect(out[0].tone).toBe('celebrate'); // PR outranks deload
  });
});
