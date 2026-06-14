import { describe, expect, it } from 'vitest';
import { deriveSnapshot, type StoreSnapshot } from './deriveSnapshot';
import { think } from './brain';
import { EMPTY_MEMORY } from './memory';

const DAY = 24 * 3600 * 1000;
const NOW = new Date('2026-06-14T12:00:00Z').getTime();
const daysAgo = (d: number) => NOW - d * DAY;

const STORE: StoreSnapshot = {
  blocksCount: 4,
  streak: 9,
  history: [
    {
      endedAt: daysAgo(1),
      domain: 'strength',
      exercises: [{ name: 'Press banca', maxWeight: 100 }],
    },
    {
      endedAt: daysAgo(4),
      domain: 'strength',
      exercises: [{ name: 'Press banca', maxWeight: 95 }],
    },
    { endedAt: daysAgo(9), domain: 'running', exercises: [] },
    {
      endedAt: daysAgo(11),
      domain: 'strength',
      exercises: [{ name: 'Press banca', maxWeight: 90 }],
    },
  ],
};

describe('deriveSnapshot', () => {
  it('derives cadence, domain counts and blocks/streak passthrough', () => {
    const s = deriveSnapshot(STORE, NOW);
    expect(s.daysSinceLastWorkout).toBe(1);
    expect(s.sessionsLast7Days).toBe(2); // days 1 and 4
    expect(s.domainCounts).toEqual({ strength: 3, running: 1 });
    expect(s.blocksCount).toBe(4);
    expect(s.streak).toBe(9);
  });

  it('builds a per-lift series only when there are ≥3 points', () => {
    const s = deriveSnapshot(STORE, NOW);
    expect(s.metricSeries?.['Press banca']?.length).toBe(3);
    // sorted ascending in time → rising 90→95→100
    const vals = s.metricSeries!['Press banca'].map((p) => p.value);
    expect(vals).toEqual([90, 95, 100]);
  });

  it('drops garbage timestamps and non-finite weights', () => {
    const s = deriveSnapshot(
      {
        ...STORE,
        history: [
          { endedAt: NaN, exercises: [{ name: 'X', maxWeight: 50 }] },
          { endedAt: daysAgo(1), exercises: [{ name: 'X', maxWeight: Infinity }] },
        ],
      },
      NOW,
    );
    expect(s.daysSinceLastWorkout).toBe(1); // the NaN entry is dropped
    expect(s.metricSeries?.['X']).toBeUndefined(); // no finite points
  });

  it('handles empty history as a never-trained user', () => {
    const s = deriveSnapshot({ history: [], blocksCount: 0, streak: 0 }, NOW);
    expect(s.daysSinceLastWorkout).toBeNull();
    expect(s.sessionsLast7Days).toBe(0);
  });

  it('feeds brain.think end-to-end: a rising lift surfaces a PR', () => {
    const s = deriveSnapshot(STORE, NOW); // Press banca 90→95→100, last is best & recent
    const out = think(EMPTY_MEMORY, s, NOW, 1);
    expect(out[0]?.tone).toBe('celebrate');
    expect(out[0]?.headline).toMatch(/Press banca/);
  });
});
