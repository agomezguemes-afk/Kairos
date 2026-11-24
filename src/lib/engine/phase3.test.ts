import { describe, expect, it } from 'vitest';

import type { CheckIn, MovementLog, SessionLog } from '../adaptive';
import {
  dailyImpulses,
  dayIndex,
  fitTaus,
  learnSensitivity,
  MOVEMENT_REGIONS,
  readinessV2,
  recoveryRate,
  recoveryStatus,
  regionHits,
  SENSITIVITY_PRIOR,
  sleepDebt,
  SLEEP_SHAPE,
  SORENESS_SHAPE,
  sorenessLikelihood,
  strengthObservations,
  type DayState,
} from './index';

const NOW = new Date('2026-11-17T12:00:00Z');
const TODAY = dayIndex(NOW);
const H = 3_600_000;
const D = 24 * H;

const pre = (daysAgo: number, sleep?: number, soreness?: number, hoursAgo = 0): CheckIn => ({
  id: `p${daysAgo}-${hoursAgo}`,
  at: new Date(NOW.getTime() - daysAgo * D - hoursAgo * H).toISOString(),
  kind: 'pre',
  sleep,
  soreness,
});

const squat = (sets: number, rir = 1): MovementLog => ({
  movementId: 'back_squat',
  target: { sets, repsMin: 5, repsMax: 5 },
  sets: Array.from({ length: sets }, () => ({ reps: 5, loadKg: 100, rir, completed: true })),
});
const session = (hoursAgo: number, movements: MovementLog[]): SessionLog => ({
  id: `s${hoursAgo}`,
  title: 'F',
  sport: 'strength',
  startedAt: new Date(NOW.getTime() - hoursAgo * H).toISOString(),
  endedAt: new Date(NOW.getTime() - hoursAgo * H).toISOString(),
  durationMin: 60,
  rpe: 8,
  movements,
});

describe('sleep debt', () => {
  it('accumulates over bad nights and decays without vanishing after good ones', () => {
    const bad = [pre(4, 2), pre(3, 2), pre(2, 2)];
    const afterBad = sleepDebt(bad, TODAY - 2).hours;
    expect(afterBad).toBeGreaterThan(4);
    const recovered = sleepDebt([...bad, pre(1, 5), pre(0, 5)], TODAY).hours;
    expect(recovered).toBeLessThan(afterBad);
    expect(recovered).toBeGreaterThan(0);
    expect(sleepDebt([], TODAY).hours).toBe(0);
  });

  it('prefers measured hours over the 1–5 scale', () => {
    const measured: CheckIn = { ...pre(0, 1), sleepHours: 8.5 };
    expect(sleepDebt([measured], TODAY).hours).toBe(0);
  });
});

describe('monotone ordinal shapes', () => {
  it('worse sleep and more soreness never help', () => {
    for (let k = 1; k < 5; k++) {
      expect(SLEEP_SHAPE[k]).toBeLessThanOrEqual(SLEEP_SHAPE[k + 1]);
      expect(SORENESS_SHAPE[k]).toBeGreaterThanOrEqual(SORENESS_SHAPE[k + 1]);
    }
  });
});

describe('personal sensitivity', () => {
  it('moves β_sleep towards a sleep-sensitive athlete and gets more certain', () => {
    // Residuals generated with β_sleep = 6 % (twice the literature prior).
    const days: DayState[] = [];
    const checkins: CheckIn[] = [];
    const levels = [1, 2, 4, 5, 3, 1, 4, 2, 5, 1, 3, 2];
    levels.forEach((k, i) => {
      const day = TODAY - 30 + i * 2;
      days.push({
        day,
        fitness: 0,
        fatigue: 0,
        mean: 0,
        variance: 16,
        form: 0,
        predicted: 0,
        predictedVar: 4,
        observed: 6 * SLEEP_SHAPE[k],
      });
      checkins.push({
        id: `c${i}`,
        at: new Date(day * D + 8 * H).toISOString(),
        kind: 'pre',
        sleep: k,
      });
    });
    const s = learnSensitivity(days, checkins);
    // Level 4 is the reference (shape 0): it carries no information about β.
    expect(s.samples).toBe(levels.filter((k) => k !== 4).length);
    expect(s.mean[0]).toBeGreaterThan(SENSITIVITY_PRIOR.mean[0] + 1);
    expect(s.cov[0][0]).toBeLessThan(SENSITIVITY_PRIOR.cov[0][0]);
  });

  it('never learns that worse sleep improves performance', () => {
    const days: DayState[] = [1, 1, 1, 1].map((_, i) => ({
      day: TODAY - 10 + i,
      fitness: 0,
      fatigue: 0,
      mean: 0,
      variance: 16,
      form: 0,
      predicted: 0,
      predictedVar: 4,
      observed: 10, // much better after awful sleep
    }));
    const checkins = days.map((d, i) => ({
      id: `x${i}`,
      at: new Date(d.day * D + 8 * H).toISOString(),
      kind: 'pre' as const,
      sleep: 1,
    }));
    expect(learnSensitivity(days, checkins).mean[0]).toBeGreaterThanOrEqual(0);
  });
});

describe('region recovery', () => {
  it('heavy legs yesterday are under 70 %, recovered after 4 days; more volume recovers slower', () => {
    const legs = (s: SessionLog[], h = 0) =>
      recoveryStatus(s, new Date(NOW.getTime() + h * H), 1).find((r) => r.region === 'legs')!;
    const heavy = [session(20, [squat(12)])];
    expect(legs(heavy).recovered).toBeLessThan(0.7);
    expect(legs(heavy, 76).recovered).toBeGreaterThan(0.9);
    const light = [session(20, [squat(4)])];
    expect(legs(light).recovered).toBeGreaterThan(legs(heavy).recovered);
    expect(legs(heavy).hoursToReady).toBeGreaterThan(legs(light).hoursToReady);
    // Untouched regions stay fully recovered.
    expect(recoveryStatus(heavy, NOW, 1).find((r) => r.region === 'pull')!.recovered).toBe(1);
  });

  it('cumulative-logit likelihood sums to 1 and favours high soreness under high fatigue', () => {
    const total = [1, 2, 3, 4, 5].reduce((a, k) => a + sorenessLikelihood(k, 0.6), 0);
    expect(total).toBeCloseTo(1, 5);
    expect(sorenessLikelihood(5, 0.9)).toBeGreaterThan(sorenessLikelihood(5, 0.1));
  });

  it('soreness the model did not expect raises the personal recovery rate', () => {
    // Moderate session 3 days ago; model expects ~recovered; person reports 5/5.
    const sessions = [session(72, [squat(6, 2)])];
    const surprised = recoveryRate(sessions, [pre(0, 4, 5, 0)]);
    const baseline = recoveryRate(sessions, []);
    expect(surprised.mean).toBeGreaterThan(baseline.mean);
    expect(surprised.reports).toBe(1);
  });
});

describe('readiness v2.1', () => {
  it('drops when the next session loads an unrecovered region, not otherwise', () => {
    const sessions = [session(18, [squat(12)])];
    const legsNext = readinessV2(sessions, [], NOW, { nextMovements: ['back_squat'] });
    const pullNext = readinessV2(sessions, [], NOW, { nextMovements: ['pull_up'] });
    expect(legsNext.probability).toBeLessThan(pullNext.probability);
    expect(legsNext.evidence.some((e) => e.label.includes('piernas'))).toBe(true);
  });

  it('reports sleep debt and keeps pain as a hard rest', () => {
    const r = readinessV2(
      [],
      [pre(3, 1), pre(2, 1), pre(1, 1), { ...pre(0, 2, 1, 1), pain: true }],
      NOW,
    );
    expect(r.sleep.hours).toBeGreaterThan(5);
    expect(r.evidence.some((e) => e.label.includes('deuda de sueño'))).toBe(true);
    expect(r.band).toBe('rest');
  });
});

describe('corrupted timestamps', () => {
  const progressing = (daysAgo: number, kg: number): SessionLog => ({
    ...session(daysAgo * 24, []),
    id: `prog${daysAgo}`,
    movements: [
      {
        movementId: 'back_squat',
        target: { sets: 3, repsMin: 5, repsMax: 5 },
        sets: Array.from({ length: 3 }, () => ({ reps: 5, loadKg: kg, rir: 2, completed: true })),
      },
    ],
  });
  const history = Array.from({ length: 12 }, (_, i) => progressing(30 - 2 * i, 100 + 2 * i));

  it('one unparseable session is skipped instead of turning readiness into NaN', () => {
    const clean = readinessV2(history, [], NOW, { nextMovements: ['back_squat'] });
    const broken = { ...progressing(1, 130), id: 'broken', endedAt: '' };
    const r = readinessV2([...history, broken], [], NOW, { nextMovements: ['back_squat'] });
    expect(Number.isFinite(r.probability)).toBe(true);
    expect(r.probability).toBeCloseTo(clean.probability, 6);
    expect(r.observations).toBe(clean.observations);
    for (const region of r.recovery.regions) expect(Number.isFinite(region.recovered)).toBe(true);
  });

  it('an unparseable check-in does not poison the day it would have landed on', () => {
    const bad: CheckIn = { ...pre(0, 1, 5), id: 'bad', at: 'not a date' };
    const r = readinessV2(history, [pre(0, 4, 2), bad], NOW);
    expect(Number.isFinite(r.probability)).toBe(true);
  });
});

describe('net form uncertainty', () => {
  it('form.sd is the SD of k1·g − k2·h, without the baseline', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session((10 - i) * 24, [squat(5)]));
    const r = readinessV2(sessions, [], NOW);
    const ff = fitTaus(
      dailyImpulses(sessions, dayIndex),
      strengthObservations(sessions, dayIndex),
      TODAY,
    );
    const last = ff.days[ff.days.length - 1];
    const v = [0, last.fitness, -last.fatigue];
    const Pv = ff.cov.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
    const expected = Math.sqrt(v[0] * Pv[0] + v[1] * Pv[1] + v[2] * Pv[2]);
    expect(r.form.sd).toBeCloseTo(expected, 6);
  });
});

describe('recovery follows the spec formula', () => {
  const squatRirs = (rirs: number[]): MovementLog => ({
    movementId: 'back_squat',
    target: { sets: rirs.length, repsMin: 5, repsMax: 5 },
    sets: rirs.map((rir) => ({ reps: 5, loadKg: 100, rir, completed: true })),
  });

  it('damage sums i(RIR) set by set', () => {
    const legs = regionHits([session(1, [squatRirs([0, 0, 6, 6])])]).find(
      (h) => h.region === 'legs',
    )!;
    // Spec: Σ i(RIR) = 1.45 + 1.45 + 1 + 1 = 4.9, times the region weight.
    expect(legs.damage).toBeCloseTo(4.9 * MOVEMENT_REGIONS.back_squat.legs!, 9);
  });

  it('the same training logged as one entry or two recovers alike', () => {
    const one = recoveryStatus([session(48, [squatRirs(Array(12).fill(1))])], NOW, 1);
    const two = recoveryStatus(
      [session(48, [squatRirs(Array(6).fill(1)), squatRirs(Array(6).fill(1))])],
      NOW,
      1,
    );
    const legs = (r: typeof one) => r.find((x) => x.region === 'legs')!.recovered;
    expect(legs(two)).toBeCloseTo(legs(one), 9);
  });
});
