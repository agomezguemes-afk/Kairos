import { describe, expect, it } from 'vitest';

import type { CheckIn, PlanDraft, SessionLog } from '../adaptive';
import { backdoorSet, dSeparated, PHYSIO_DAG, safeCovariates } from './dag';
import { chooseLoad, lossRatioFor, seededRng } from './decision';
import { adherence, fitWeibull, painRecurrence, riskWithin, survivalAt } from './survival';
import { abSchedule, analyseTrial, createTrial, trialPoints, type TrialPoint } from './trial';
import { consolidate, trimTargets } from './consolidate';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * D).toISOString();

describe('physiological DAG', () => {
  it('conditioning on a collider opens a path', () => {
    // load → soreness ← sleep
    expect(dSeparated(PHYSIO_DAG, ['load'], ['sleep'])).toBe(true);
    expect(dSeparated(PHYSIO_DAG, ['load'], ['sleep'], ['soreness'])).toBe(false);
  });

  it('only pre-treatment covariates are safe for a trial', () => {
    expect(safeCovariates(PHYSIO_DAG, 'treatment', ['sleep', 'soreness', 'load', 'pain'])).toEqual([
      'sleep',
    ]);
  });

  it('finds back-door sets and admits when there is none', () => {
    expect(backdoorSet(PHYSIO_DAG, 'treatment', 'performance')).toEqual([]);
    expect(backdoorSet(PHYSIO_DAG, 'soreness', 'performance')?.sort()).toEqual(['load', 'sleep']);
    // Stress is unmeasured and drives both sleep and performance.
    expect(backdoorSet(PHYSIO_DAG, 'sleep', 'performance')).toBeNull();
  });
});

describe('Weibull survival', () => {
  it('with no data the prior median holds', () => {
    const post = fitWeibull([], {
      shapes: [1.5],
      shapeCentre: 1.5,
      shapeLogSd: 0.5,
      median: 3,
      a0: 50,
      betas: [0],
      betaSd: 1,
    });
    expect(survivalAt(post, 3)).toBeCloseTo(0.5, 1);
  });

  it('censoring lowers the hazard estimate', () => {
    const prior = {
      shapes: [1],
      shapeCentre: 1,
      shapeLogSd: 1,
      median: 5,
      a0: 2,
      betas: [0],
      betaSd: 1,
    };
    const events = [2, 3, 2, 4].map((t) => ({ t, event: true }));
    const a = fitWeibull(events, prior);
    const b = fitWeibull([...events, { t: 20, event: false }], prior);
    expect(survivalAt(b, 5)).toBeGreaterThan(survivalAt(a, 5));
    expect(riskWithin(a, 0, 1000)).toBeCloseTo(1, 3);
  });

  it('adherence: a regular trainee is likely to train soon; a long gap raises lapse risk', () => {
    const regular: SessionLog[] = Array.from({ length: 12 }, (_, i) => session(36 - i * 3, 80));
    const fresh = adherence(regular, new Date(NOW.getTime() + 0 * D), 3)!;
    expect(fresh.informed).toBe(true);
    expect(fresh.within7).toBeGreaterThan(0.8);
    const late = adherence(regular, new Date(NOW.getTime() + 9 * D), 3)!;
    expect(late.lapseRisk).toBeGreaterThan(fresh.lapseRisk);
  });

  it('pain: episodes merge, and risk is highest right after one', () => {
    const checkins: CheckIn[] = [
      { id: 'a', at: ago(60), kind: 'weekly', pain: true },
      { id: 'b', at: ago(57), kind: 'weekly', pain: true },
      { id: 'c', at: ago(10), kind: 'weekly', pain: true },
    ];
    const r = painRecurrence(checkins, [], NOW)!;
    expect(r.episodes).toBe(2);
    const later = painRecurrence(checkins, [], new Date(NOW.getTime() + 120 * D))!;
    expect(r.risk14).toBeGreaterThan(later.risk14);
    expect(painRecurrence([], [], NOW)).toBeNull();
  });

  it('pain risk makes load steps more cautious', () => {
    expect(lossRatioFor(0)).toBe(1.5);
    expect(lossRatioFor(0.25)).toBeCloseTo(2.25);
    const sets = [1, 2, 3].map(() => ({ reps: 8, loadKg: 60, rir: 2, completed: true }));
    const opts = { current: 60, increment: 2.5, lastSets: sets, repsMin: 6, rirTarget: 2 };
    expect(chooseLoad(opts).load).toBe(62.5);
    expect(chooseLoad({ ...opts, lossRatio: lossRatioFor(0.6) }).load).toBe(60);
  });
});

/** Synthetic trial: B adds `effect` % on top of a trend and noise. */
function simulate(effect: number, pairs: number, seed: string, noise = 1.5): TrialPoint[] {
  const rng = seededRng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  return abSchedule(seed, pairs).map((c, i) => ({
    condition: c,
    y: 0.3 * i + (c === 'B' ? effect : 0) + noise * gauss(),
  }));
}

describe('n-of-1 ABAB trials', () => {
  it('schedules randomised pairs, reproducibly', () => {
    const s = abSchedule('x', 4);
    expect(s).toHaveLength(8);
    for (let i = 0; i < 8; i += 2) expect(new Set(s.slice(i, i + 2)).size).toBe(2);
    expect(abSchedule('x', 4)).toEqual(s);
  });

  it('detects a real effect and reports B', () => {
    const a = analyseTrial(simulate(5, 4, 'real'));
    expect(a.effect.mean).toBeGreaterThan(2);
    expect(a.pBWorthwhile).toBeGreaterThan(0.9);
    expect(a.verdict).toBe('B');
    expect(a.bf10).toBeGreaterThan(3);
  });

  it('does not invent an effect from noise', () => {
    const a = analyseTrial(simulate(0, 4, 'null'));
    expect(a.verdict).not.toBe('B');
    expect(a.verdict).not.toBe('A');
    expect(a.effect.lo).toBeLessThan(0);
    expect(a.effect.hi).toBeGreaterThan(0);
  });

  it('a trend alone is not mistaken for an effect', () => {
    const pts: TrialPoint[] = abSchedule('trend', 4).map((c, i) => ({ condition: c, y: 1.2 * i }));
    expect(Math.abs(analyseTrial(pts).effect.mean)).toBeLessThan(1);
  });

  it('needs both arms before deciding; closes as unclear when the schedule ends', () => {
    expect(analyseTrial(simulate(8, 1, 'short')).decided).toBe(false);
    const done = analyseTrial(simulate(0.5, 2, 'end', 3), { complete: true });
    expect(done.decided).toBe(true);
  });

  it('reads outcomes from logs, with sleep as a covariate only', () => {
    const t = createTrial('rest', 'back_squat', new Date(NOW.getTime() - 30 * D));
    const logs = [session(40, 80), session(37, 80), ...[25, 22, 19, 16].map((d) => session(d, 82))];
    const pts = trialPoints(t, logs, [{ id: 'c', at: ago(25.1), kind: 'pre', sleep: 2 }]);
    expect(pts).toHaveLength(4);
    expect(pts[0].condition).toBe(t.schedule[0]);
    expect(pts[0].sleep).toBeCloseTo(-0.55);
    expect(pts[1].sleep).toBeUndefined();
    expect(pts[0].y).toBeCloseTo(2.5, 1);
  });
});

describe('background consolidation', () => {
  const plan: PlanDraft = {
    id: 'p',
    createdAt: ago(60),
    goal: {
      raw: '',
      sports: ['strength'],
      qualities: ['strength'],
      daysPerWeek: 3,
      horizonWeeks: 8,
      confidence: 1,
      matched: [],
    },
    sessions: [
      {
        id: 'ds1',
        title: 'Fuerza',
        focus: 'strength',
        sport: 'strength',
        slot: 0,
        durationMin: 50,
        rationale: '',
        status: 'accepted',
        movements: [
          {
            movementId: 'back_squat',
            target: { sets: 3, repsMin: 5, repsMax: 5, loadKg: 80, rir: 2 },
          },
        ],
      },
    ],
  };

  it('starts a silent rest trial once a movement has history and patches the plan', () => {
    const sessions = [12, 9, 6].map((d) => session(d, 80));
    const c = consolidate({ plan, sessions, checkins: [], experiments: [], trials: [], now: NOW });
    expect(c.trials).toHaveLength(1);
    const target = c.plan!.sessions[0].movements[0].target;
    expect([120, 210]).toContain(target.restSec);
    expect(c.dayPlan?.draftSessionId).toBe('ds1');
    expect(c.signals.adherence).not.toBeNull();
    // Running it again changes nothing: one trial at a time.
    const again = consolidate({ ...c, sessions, checkins: [], experiments: [], now: NOW });
    expect(again.trials).toHaveLength(1);
  });

  it('a recent pain report makes tomorrow a rest day with a note', () => {
    const sessions = [12, 9, 6, 1].map((d) => session(d, 80));
    const c = consolidate({
      plan,
      sessions,
      checkins: [{ id: 'p', at: ago(0.1), kind: 'weekly', pain: true }],
      experiments: [],
      trials: [],
      now: NOW,
    });
    expect(c.dayPlan?.band).toBe('rest');
    expect(c.dayPlan?.trimSets).toBe(true);
    expect(c.dayPlan?.note).toMatch(/dolor/);
  });

  it('trims one set per strength movement, never below two', () => {
    expect(trimTargets(plan.sessions[0]).movements[0].target.sets).toBe(2);
    const two = trimTargets(trimTargets(plan.sessions[0]));
    expect(two.movements[0].target.sets).toBe(2);
  });
});

function session(daysAgo: number, load: number): SessionLog {
  return {
    id: `s${daysAgo}`,
    draftSessionId: 'ds1',
    title: 'F',
    sport: 'strength',
    startedAt: ago(daysAgo),
    endedAt: new Date(NOW.getTime() - daysAgo * D + 3_000_000).toISOString(),
    durationMin: 50,
    rpe: 7,
    movements: [
      {
        movementId: 'back_squat',
        target: { sets: 3, repsMin: 5, repsMax: 5 },
        sets: [1, 2, 3].map(() => ({ reps: 5, loadKg: load, rir: 2, completed: true })),
      },
    ],
  };
}
