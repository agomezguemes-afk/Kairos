import { describe, expect, it } from 'vitest';

import type { CheckIn, SessionLog } from '../adaptive';
import {
  calibrationReport,
  fitRecalibration,
  intervalReport,
  recalibrate,
  reliability,
  type Forecast,
} from './calibration';
import { replayAdherence, replayLoads, replayPain, replayReadiness } from './backtest';
import { seededRng } from './decision';
import { expertPanel, weeklySets, type PanelInput } from './lenses';
import { readinessV2 } from './readiness';
import { adherence } from './survival';
import { consolidate } from './consolidate';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * D).toISOString();
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

/** n forecasts whose truth is σ(a + b·logit p). */
function synthetic(n: number, a: number, b: number, seed = 'cal'): Forecast[] {
  const rng = seededRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const p = 0.05 + 0.9 * rng();
    const truth = sigmoid(a + b * logit(p));
    return {
      at: new Date(NOW.getTime() + i * 1000).toISOString(),
      p,
      outcome: rng() < truth ? 1 : 0,
    };
  });
}

describe('calibration', () => {
  it('honest forecasts fit the identity and read as calibrated', () => {
    const r = calibrationReport(synthetic(500, 0, 1));
    expect(r.fit.a).toBeCloseTo(0, 0);
    expect(Math.abs(r.fit.b - 1)).toBeLessThan(0.25);
    expect(r.verdict).toBe('calibrated');
    expect(r.skill).toBeGreaterThan(0.1);
  });

  it('too-extreme forecasts are caught and the correction helps', () => {
    const r = calibrationReport(synthetic(400, 0, 0.4, 'over'));
    expect(r.fit.b).toBeLessThan(0.7);
    expect(r.verdict).toBe('overconfident');
    expect(r.correctedBrier).toBeLessThan(r.brier);
    // A 90 % forecast is pulled back toward the middle.
    expect(recalibrate(0.9, r.fit)).toBeLessThan(0.8);
  });

  it('forecasts that come in high are flagged optimistic', () => {
    const r = calibrationReport(synthetic(400, -1, 1, 'opt'));
    expect(r.fit.a).toBeLessThan(-0.5);
    expect(r.verdict).toBe('optimistic');
    expect(recalibrate(0.6, r.fit)).toBeLessThan(0.5);
  });

  it('with a handful of forecasts it is still learning and barely moves', () => {
    const few = synthetic(4, -2, 0.3, 'few');
    const r = calibrationReport(few);
    expect(r.verdict).toBe('learning');
    expect(Math.abs(recalibrate(0.7, fitRecalibration(few)) - 0.7)).toBeLessThan(0.12);
    expect(recalibrate(0.7, null)).toBe(0.7);
  });

  it('a coin-flip forecaster has no skill over the base rate', () => {
    const rng = seededRng('coin');
    const coin: Forecast[] = Array.from({ length: 300 }, (_, i) => ({
      at: String(i).padStart(4, '0'),
      p: 0.5,
      outcome: rng() < 0.5 ? 1 : 0,
    }));
    expect(Math.abs(calibrationReport(coin).skill)).toBeLessThan(0.05);
  });

  it('reliability bins cover every forecast with valid intervals', () => {
    const f = synthetic(120, 0, 1, 'bins');
    const bins = reliability(f);
    expect(bins.reduce((a, b) => a + b.n, 0)).toBe(120);
    for (const b of bins) {
      expect(b.observedLo).toBeGreaterThanOrEqual(0);
      expect(b.observedHi).toBeLessThanOrEqual(1);
      if (b.n) expect(b.observed).toBeGreaterThanOrEqual(b.observedLo - 1e-9);
    }
  });

  it('intervals that are too narrow show up in coverage and the variance factor', () => {
    const rng = seededRng('iv');
    const normal = () => Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
    const wide = Array.from({ length: 200 }, (_, i) => ({
      at: String(i),
      mean: 0,
      sd: 1,
      y: 2 * normal(),
    }));
    const r = intervalReport(wide);
    expect(r.spread).toBeGreaterThan(1.6);
    expect(r.coverage80).toBeLessThan(0.65);
    expect(r.varianceFactor).toBeGreaterThan(3);
    expect(intervalReport([]).varianceFactor).toBe(1);
  });
});

function strength(daysAgo: number, load: number, reps = 5, id = `s${daysAgo}`): SessionLog {
  return {
    id,
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
        target: { sets: 3, repsMin: 5, repsMax: 5, rir: 2 },
        sets: [1, 2, 3].map(() => ({ reps, loadKg: load, rir: 2, completed: true })),
      },
    ],
  };
}

describe('prequential replay', () => {
  const history = Array.from({ length: 16 }, (_, i) => strength(48 - i * 3, 80 + i * 1.25));

  it('load forecasts start at the second exposure and score hits and misses', () => {
    const missed = strength(0.5, 102.5, 2, 'miss');
    const f = replayLoads([...history, missed]);
    expect(f).toHaveLength(history.length);
    expect(f.slice(0, -1).every((x) => x.outcome === 1)).toBe(true);
    expect(f[f.length - 1].outcome).toBe(0);
    for (const x of f) expect(x.p).toBeGreaterThan(0);
  });

  it('readiness forecasts never use the future', () => {
    const base = replayReadiness(history, []);
    expect(base.forecasts.length).toBeGreaterThan(3);
    const changed = replayReadiness([...history.slice(0, -1), strength(3, 200)], []);
    // Every forecast but the last one is unchanged by what came after it.
    expect(changed.forecasts.slice(0, -1)).toEqual(base.forecasts.slice(0, -1));
    for (const x of base.forecasts) expect(x.p).toBeGreaterThan(0);
  });

  it('adherence forecasts wait until the week is over', () => {
    const f = replayAdherence(history, NOW);
    // The last outing (3 days ago) is still unresolved.
    expect(f).toHaveLength(history.length - 1);
    expect(f.every((x) => x.outcome === 1)).toBe(true);
    const later = replayAdherence(history, new Date(NOW.getTime() + 20 * D));
    expect(later[later.length - 1].outcome).toBe(0);
  });

  it('pain forecasts count only new episodes, once a week', () => {
    const checkins: CheckIn[] = [
      { id: 'a', at: ago(46), kind: 'weekly', pain: true },
      { id: 'b', at: ago(20), kind: 'weekly', pain: true },
    ];
    const f = replayPain(history, checkins, [], NOW);
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.outcome === 1)).toBe(true);
    for (let i = 1; i < f.length; i++)
      expect(new Date(f[i].at).getTime() - new Date(f[i - 1].at).getTime()).toBeGreaterThanOrEqual(
        7 * D,
      );
  });
});

describe('expert panel', () => {
  const sessions = Array.from({ length: 10 }, (_, i) => strength(30 - i * 3, 80 + i * 2.5));
  const base = (over: Partial<PanelInput> = {}): PanelInput => ({
    readiness: readinessV2(sessions, [], NOW, { nextMovements: ['back_squat'] }),
    sessions,
    nextMovements: ['back_squat'],
    adherence: adherence(sessions, NOW, 3),
    pain: null,
    painNow: false,
    now: NOW,
    ...over,
  });

  it('every perspective speaks, in decision order', () => {
    const p = expertPanel(base());
    expect(p.lenses.map((l) => l.id)).toEqual([
      'clinical',
      'physiology',
      'memory',
      'behaviour',
      'training',
    ]);
    for (const l of p.lenses) expect(l.reason.length).toBeGreaterThan(0);
  });

  it('pain makes the physio decide, whatever the others think', () => {
    const p = expertPanel(base({ painNow: true }));
    expect(p.verdict.band).toBe('rest');
    expect(p.verdict.lead).toBe('clinical');
    expect(p.verdict.note).toMatch(/dolor/);
  });

  it('a long gap makes the habit lens ask for a short session', () => {
    const later = new Date(NOW.getTime() + 12 * D);
    const p = expertPanel(
      base({
        readiness: readinessV2(sessions, [], later, { nextMovements: ['back_squat'] }),
        adherence: adherence(sessions, later, 3),
        now: later,
      }),
    );
    const habit = p.lenses.find((l) => l.id === 'behaviour')!;
    expect(habit.stance).toBe('ease');
    expect(p.verdict.band).not.toBe('go');
  });

  it('a plateau holds the load without trimming the session', () => {
    const flat = Array.from({ length: 10 }, (_, i) => strength(30 - i * 3, 100));
    const p = expertPanel(
      base({
        sessions: flat,
        readiness: readinessV2(flat, [], NOW, { nextMovements: ['back_squat'] }),
        adherence: adherence(flat, NOW, 3),
      }),
    );
    const training = p.lenses.find((l) => l.id === 'training')!;
    expect(training.stance).toBe('steady');
    expect(training.findings.some((f) => /estancado/.test(f.text))).toBe(true);
  });

  it('an overconfident track record tempers the physiology forecast', () => {
    const over = calibrationReport(synthetic(300, 0, 0.3, 'phys'));
    const raw = expertPanel(base()).lenses.find((l) => l.id === 'physiology')!;
    const tempered = expertPanel(
      base({
        calibration: {
          readiness: over,
          performance: intervalReport([]),
          load: over,
          adherence: over,
          pain: over,
          at: NOW.toISOString(),
        },
      }),
    ).lenses.find((l) => l.id === 'physiology')!;
    expect(Math.abs(tempered.forecast!.p - 0.5)).toBeLessThan(Math.abs(raw.forecast!.p - 0.5));
    expect(tempered.track?.headline).toMatch(/Cuando digo/);
    expect(tempered.findings.some((f) => /tajantes/.test(f.text))).toBe(true);
  });

  it('weekly sets count secondary regions by their weight', () => {
    const dose = weeklySets(sessions, NOW);
    // Two squat sessions in the last 7 days, 3 sets each.
    expect(dose.legs).toBe(6);
    expect(dose.posterior).toBe(3);
  });

  it('consolidation carries the panel decision and the track record', () => {
    const plan = {
      id: 'p',
      createdAt: ago(40),
      goal: { raw: 'fuerza', sports: ['strength'], qualities: ['strength'], daysPerWeek: 3 },
      sessions: [
        {
          id: 'ds1',
          slot: 0,
          title: 'F',
          sport: 'strength',
          status: 'accepted',
          movements: [{ movementId: 'back_squat', target: { sets: 3, repsMin: 5, loadKg: 105 } }],
        },
      ],
    } as never;
    const c = consolidate({ plan, sessions, checkins: [], experiments: [], trials: [], now: NOW });
    expect(c.calibration.load.n).toBeGreaterThan(0);
    expect(c.dayPlan?.lead).toBeDefined();
  });
});

describe('recalibration fit at the edges', () => {
  const at = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * D).toISOString();

  it('confident forecasts that all failed pull the correction down', () => {
    // Plain Newton used to stop at the identity here and call it calibrated.
    const fit = fitRecalibration(Array.from({ length: 100 }, () => ({ p: 0.97, outcome: 0 })));
    expect(recalibrate(0.97, fit)).toBeLessThan(0.5);
  });

  it('saturated forecasts that hit 60 % are corrected towards 60 %', () => {
    const rng = seededRng('sat');
    const fs: Forecast[] = Array.from({ length: 120 }, (_, i) => ({
      at: at(i),
      p: 0.97 + 0.03 * rng(),
      outcome: rng() < 0.6 ? 1 : 0,
    }));
    const report = calibrationReport(fs);
    expect(report.verdict).not.toBe('underconfident');
    const corrected = recalibrate(0.99, fitRecalibration(fs));
    expect(corrected).toBeGreaterThan(0.4);
    expect(corrected).toBeLessThan(0.8);
  });

  it('never reverses the order of forecasts', () => {
    const fit = fitRecalibration(Array.from({ length: 200 }, () => ({ p: 0.9, outcome: 0 })));
    expect(fit.b).toBeGreaterThanOrEqual(0);
    expect(recalibrate(0.9, fit)).toBeGreaterThanOrEqual(recalibrate(0.3, fit));
  });

  it('reaches the constrained optimum when the slope sits on its bound', () => {
    const n = 200;
    const fit = fitRecalibration(Array.from({ length: n }, () => ({ p: 0.9, outcome: 0 })));
    const s = sigmoid(fit.a + fit.b * logit(0.9));
    // ∂ log-posterior / ∂a = −a/σa² + Σ(y − s) must vanish at the MAP.
    expect(Math.abs(-fit.a / 0.09 - n * s)).toBeLessThan(1e-4);
  });
});

describe('prequential correction stays honest when it refits less often', () => {
  it('matches the refit-every-step score on a long history', () => {
    const rng = seededRng('preq');
    const fs: Forecast[] = Array.from({ length: 600 }, (_, i) => {
      const p = 0.5 + 0.49 * rng();
      return {
        at: new Date(Date.UTC(2024, 0, 1) + i * D).toISOString(),
        p,
        outcome: rng() < p - 0.1 ? 1 : 0,
      };
    });
    let exact = 0;
    fs.forEach((f, i) => {
      const fit = i ? fitRecalibration(fs.slice(0, i)) : null;
      exact += (recalibrate(f.p, fit) - f.outcome) ** 2;
    });
    const report = calibrationReport(fs);
    expect(report.correctedBrier).toBeCloseTo(exact / fs.length, 3);
    expect(report.fit.b).toBeCloseTo(fitRecalibration(fs).b, 6);
  });

  it('a warm start reaches the same MAP as a cold one', () => {
    const fs = synthetic(300, 0.3, 0.7);
    const cold = fitRecalibration(fs);
    const warm = fitRecalibration(fs, { a: 2, b: 3 });
    expect(warm.a).toBeCloseTo(cold.a, 6);
    expect(warm.b).toBeCloseTo(cold.b, 6);
  });
});
