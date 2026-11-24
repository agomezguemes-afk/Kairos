import { describe, expect, it } from 'vitest';

import type { CheckIn, MovementLog, SessionLog } from '../adaptive';
import {
  dayIndex,
  fitTaus,
  loadPattern,
  normCdf,
  readinessV2,
  runFitnessFatigue,
  strengthObservations,
  type Observation,
} from './index';

const NOW = new Date('2026-11-17T12:00:00Z');
const TODAY = dayIndex(NOW);
const DAY = 86_400_000;

/** Deterministic PRNG so synthetic athletes are reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

/** Ground truth Banister athlete: returns impulses and noisy observations. */
function synthetic(opts: {
  days: number;
  load: (d: number) => number;
  tau1?: number;
  tau2?: number;
  k1?: number;
  k2?: number;
  noise?: number;
  obsEvery?: number;
}) {
  const { days, load, tau1 = 42, tau2 = 7, k1 = 0.06, k2 = 0.18, noise = 1.5, obsEvery = 2 } = opts;
  const r = rng(7);
  const impulses = new Map<number, number>();
  const obs: Observation[] = [];
  let g = 0;
  let h = 0;
  const start = TODAY - days;
  for (let i = 0; i <= days; i++) {
    const w = load(i);
    if (w) impulses.set(start + i, w);
    g = g * Math.exp(-1 / tau1) + w;
    h = h * Math.exp(-1 / tau2) + w;
    if (i % obsEvery === 0) obs.push({ day: start + i, y: k1 * g - k2 * h + noise * gauss(r) });
  }
  return { impulses, obs };
}

describe('normCdf', () => {
  it('matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normCdf(-1)).toBeCloseTo(0.1587, 3);
  });
});

describe('fitness-fatigue filter', () => {
  it('with no data returns the prior and stays uninformed', () => {
    const res = runFitnessFatigue(new Map(), [], TODAY);
    expect(res.observations).toBe(0);
    expect(res.theta).toEqual([0, 0.05, 0.15]);
    expect(readinessV2([], [], NOW).informed).toBe(false);
  });

  it('learns a synthetic athlete: positive gains, shrinking uncertainty, better predictions', () => {
    const { impulses, obs } = synthetic({ days: 90, load: (d) => (d % 7 < 4 ? 3 : 0) });
    const early = runFitnessFatigue(impulses, obs.slice(0, 5), TODAY);
    const late = runFitnessFatigue(impulses, obs, TODAY);
    expect(late.theta[1]).toBeGreaterThan(0);
    expect(late.theta[2]).toBeGreaterThan(0);
    // Posterior variance of k2 shrinks with evidence.
    expect(late.cov[2][2]).toBeLessThan(early.cov[2][2]);
    // Mean absolute error over the last 30 days beats the prior-only run.
    const prior = runFitnessFatigue(impulses, [], TODAY);
    const tail = obs.filter((o) => o.day > TODAY - 30);
    const mae = (r: typeof late) =>
      tail.reduce((a, o) => a + Math.abs(r.days.find((d) => d.day === o.day)!.mean - o.y), 0) /
      tail.length;
    expect(mae(late)).toBeLessThan(mae(prior));
  });

  it('never lets a gain go negative, whatever the data say', () => {
    const impulses = new Map<number, number>();
    const obs: Observation[] = [];
    for (let i = 0; i < 40; i++) {
      impulses.set(TODAY - 40 + i, 4);
      obs.push({ day: TODAY - 40 + i, y: 50 - i * 3 }); // falling with load
    }
    const res = runFitnessFatigue(impulses, obs, TODAY);
    expect(res.theta[1]).toBeGreaterThanOrEqual(0);
    expect(res.theta[2]).toBeGreaterThanOrEqual(0);
  });

  it('the data favour the true fatigue constant over a wrong one', () => {
    // Varied loading so τ2 is identifiable. The literature prior (centred
    // on 7 d) may still win the grid against 5 with little data, which is
    // the intended shrinkage, but the likelihood must rank 5 above 10.
    const load = (d: number) => (d % 10 < 3 ? 6 : d % 10 === 5 ? 2 : 0);
    const { impulses, obs } = synthetic({ days: 120, load, tau2: 5, noise: 0.8, obsEvery: 1 });
    const ll = (tau2: number) => runFitnessFatigue(impulses, obs, TODAY, { tau1: 42, tau2 }).logLik;
    expect(ll(5)).toBeGreaterThan(ll(10));
    expect([5, 7]).toContain(fitTaus(impulses, obs, TODAY).params.tau2);
  });

  it('dips after a load spike and supercompensates after a taper', () => {
    const impulses = new Map<number, number>();
    const base = TODAY - 40;
    for (let i = 0; i < 30; i++) impulses.set(base + i, 2);
    for (let i = 30; i < 33; i++) impulses.set(base + i, 6); // spike
    const res = runFitnessFatigue(impulses, [], TODAY); // prior gains
    const at = (d: number) => res.days.find((x) => x.day === base + d)!.form;
    expect(at(32)).toBeLessThan(at(29));
    expect(at(40)).toBeGreaterThan(at(29));
  });
});

describe('strength observations', () => {
  const lift = (load: number, reps = 5): MovementLog => ({
    movementId: 'back_squat',
    target: { sets: 3, repsMin: 5, repsMax: 5 },
    sets: [{ reps, loadKg: load, completed: true }],
  });
  const sess = (day: number, m: MovementLog[]): SessionLog => ({
    id: `s${day}`,
    title: 'F',
    sport: 'strength',
    startedAt: new Date(NOW.getTime() - day * DAY).toISOString(),
    endedAt: new Date(NOW.getTime() - day * DAY).toISOString(),
    durationMin: 50,
    rpe: 7,
    movements: m,
  });

  it('scores each session against the person’s own reference, ignoring >10-rep sets', () => {
    const sessions = [10, 9, 8, 7].map((d) => sess(d, [lift(100)])).concat(sess(6, [lift(110)]));
    sessions.push(sess(5, [lift(200, 15)]));
    const obs = strengthObservations(sessions, dayIndex);
    expect(obs).toHaveLength(2);
    expect(obs[0].y).toBeCloseTo(0, 5);
    expect(obs[1].y).toBeCloseTo(10, 0);
  });
});

describe('load pattern (Foster)', () => {
  const s = (day: number, min: number, rpe = 6): SessionLog => ({
    id: `l${day}`,
    title: 'x',
    sport: 'running',
    startedAt: new Date(NOW.getTime() - day * DAY).toISOString(),
    endedAt: new Date(NOW.getTime() - day * DAY).toISOString(),
    durationMin: min,
    rpe,
    movements: [],
  });

  it('identical daily loads are maximally monotonous; varied weeks are not', () => {
    const same = [0, 1, 2, 3, 4, 5, 6].map((d) => s(d, 60));
    const varied = [s(0, 90), s(2, 30), s(5, 60)];
    expect(loadPattern(same, NOW).monotony).toBeGreaterThan(5);
    expect(loadPattern(varied, NOW).monotony!).toBeLessThan(1.5);
    expect(loadPattern([], NOW).monotony).toBeNull();
  });
});

describe('readiness v2', () => {
  const pre = (sleep: number, soreness: number, pain = false): CheckIn => ({
    id: 'p',
    at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
    kind: 'pre',
    sleep,
    soreness,
    pain,
  });

  it('check-ins move the probability in the documented direction', () => {
    const base = readinessV2([], [], NOW).probability;
    expect(readinessV2([], [pre(1, 1)], NOW).probability).toBeLessThan(base);
    expect(readinessV2([], [pre(5, 1)], NOW).probability).toBeGreaterThan(base);
    expect(readinessV2([], [pre(3, 5)], NOW).probability).toBeLessThan(base);
  });

  it('pain forces the rest band and every reason carries a source', () => {
    const r = readinessV2([], [pre(5, 1, true)], NOW);
    expect(r.band).toBe('rest');
    expect(r.evidence.every((e) => e.source.length > 0)).toBe(true);
  });
});
