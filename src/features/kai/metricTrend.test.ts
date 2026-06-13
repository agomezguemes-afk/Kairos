import { describe, expect, it } from 'vitest';
import { analyzeMetric, type MetricPoint } from './metricTrend';

const WEEK = 7 * 24 * 3600 * 1000;
const T0 = new Date('2026-01-01T00:00:00Z').getTime();
/** point at `week` offset with `value`. */
const at = (week: number, value: number): MetricPoint => ({ t: T0 + week * WEEK, value });

describe('analyzeMetric', () => {
  it('is insufficient below 3 clean points', () => {
    const r = analyzeMetric([at(0, 100), at(1, 105)]);
    expect(r.direction).toBe('insufficient');
    expect(r.samples).toBe(2);
  });

  it('detects a rising metric (higher is better) as improving, with a recent best', () => {
    const pts = [at(0, 100), at(1, 105), at(2, 110), at(3, 115)];
    const r = analyzeMetric(pts, { now: T0 + 3 * WEEK });
    expect(r.direction).toBe('rising');
    expect(r.improving).toBe(true);
    expect(r.best?.value).toBe(115);
    expect(r.recentBest).toBe(true);
    expect(r.plateaued).toBe(false);
    expect(r.changePct).toBeCloseTo(0.15);
  });

  it('flags a plateau when the best is stale beyond the window', () => {
    // best (120) at week 1, then flat-ish for many weeks
    const pts = [at(0, 118), at(1, 120), at(2, 119), at(3, 120), at(4, 119), at(5, 120)];
    const r = analyzeMetric(pts, { now: T0 + 5 * WEEK, plateauWeeks: 3 });
    expect(r.plateaued).toBe(true);
    expect(r.recentBest).toBe(false);
    expect(r.weeksSinceBest).toBeGreaterThanOrEqual(3);
  });

  it('handles lower-is-better metrics (e.g. 5k time): falling = improving, best = min', () => {
    const pts = [at(0, 1500), at(1, 1470), at(2, 1440), at(3, 1410)]; // seconds, getting faster
    const r = analyzeMetric(pts, { lowerIsBetter: true, now: T0 + 3 * WEEK });
    expect(r.direction).toBe('falling');
    expect(r.improving).toBe(true);
    expect(r.best?.value).toBe(1410); // the minimum is best
    expect(r.recentBest).toBe(true);
  });

  it('treats a tiny change as flat (dead-band), not improving', () => {
    const pts = [at(0, 100), at(1, 100.5), at(2, 101)];
    const r = analyzeMetric(pts, { now: T0 + 2 * WEEK, flatBand: 0.02 });
    expect(r.direction).toBe('flat');
    expect(r.improving).toBe(false);
  });

  it('drops non-finite / malformed points and still analyzes the rest', () => {
    const pts = [
      at(0, 100),
      { t: NaN, value: 999 },
      at(1, 110),
      { t: T0 + 2 * WEEK, value: Infinity },
      at(2, 120),
    ];
    const r = analyzeMetric(pts, { now: T0 + 2 * WEEK });
    expect(r.samples).toBe(3);
    expect(r.best?.value).toBe(120);
  });

  it('never reports negative weeksSinceBest if now precedes the best', () => {
    const pts = [at(0, 100), at(1, 110), at(2, 120)];
    const r = analyzeMetric(pts, { now: T0 }); // now before the best
    expect(r.weeksSinceBest).toBeGreaterThanOrEqual(0);
  });
});
