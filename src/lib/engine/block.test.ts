import { describe, expect, it } from 'vitest';

import type { DraftSession, PlanDraft, SessionLog } from '../adaptive';
import type { CaseRecord } from './backtest';
import {
  applyDose,
  eventDate,
  layoutWeeks,
  reviewBlock,
  weekAt,
  weekIndex,
  type BlockSignals,
} from './block';
import { consolidate, shapeSession } from './consolidate';
import { readinessV2 } from './readiness';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86_400_000;
const W = 7 * D;

const draft: DraftSession = {
  id: 'ds1',
  title: 'Fuerza',
  focus: 'strength',
  sport: 'strength',
  slot: 0,
  durationMin: 60,
  rationale: '',
  status: 'accepted',
  movements: [
    { movementId: 'back_squat', target: { sets: 4, repsMin: 5, repsMax: 6, rir: 2, loadKg: 100 } },
    { movementId: 'easy_run', target: { durationMin: 30 } },
  ],
};

const plan = (raw = 'ganar fuerza, 3 días', id = 'p1', createdAt = NOW): PlanDraft =>
  ({
    id,
    createdAt: createdAt.toISOString(),
    goal: {
      raw,
      sports: ['strength'],
      qualities: ['strength'],
      daysPerWeek: 3,
      horizonWeeks: 10,
      confidence: 1,
      matched: [],
    },
    sessions: [draft],
  }) as PlanDraft;

function strength(daysAgo: number, load: number, id = `s${daysAgo}`): SessionLog {
  return {
    id,
    draftSessionId: 'ds1',
    title: 'F',
    sport: 'strength',
    startedAt: new Date(NOW.getTime() - daysAgo * D).toISOString(),
    endedAt: new Date(NOW.getTime() - daysAgo * D + 3_000_000).toISOString(),
    durationMin: 50,
    rpe: 7,
    movements: [
      {
        movementId: 'back_squat',
        target: { sets: 3, repsMin: 5, rir: 2 },
        sets: [1, 2, 3].map(() => ({ reps: 5, loadKg: load, rir: 2, completed: true })),
      },
    ],
  };
}

const progressing = Array.from({ length: 12 }, (_, i) => strength(36 - i * 3, 80 + i * 2.5));

function signals(over: Partial<BlockSignals> = {}): BlockSignals {
  const sessions = over.sessions ?? progressing;
  const now = over.now ?? NOW;
  return {
    readiness: readinessV2(sessions, [], now, { nextMovements: ['back_squat'] }),
    cases: [],
    sessions,
    painNow: false,
    painRisk: null,
    plan: plan(),
    now,
    ...over,
  };
}

const lowCase = (daysAgo: number): CaseRecord => ({
  sessionId: `c${daysAgo}`,
  at: new Date(NOW.getTime() - daysAgo * D).toISOString(),
  p: 0.3,
  level: 0,
  expMean: 0,
  expSd: 4,
  informed: true,
  y: null,
  context: { p: 0.3, debt: 0, recovered: 1, ratio: 1, gap: 2, soreness: 1 },
});

describe('block layout', () => {
  it('without a date: three loading weeks, then a deload', () => {
    const w = layoutWeeks(NOW.getTime(), 'volume');
    expect(w.map((x) => x.phase)).toEqual(['build', 'build', 'push', 'deload']);
    expect(w[1].dose.setsDelta).toBe(1);
    expect(w[3].dose.setsFactor).toBeLessThan(1);
  });

  it('towards a date: 3:1 cycles ending in taper and event week', () => {
    const event = new Date(NOW.getTime() + 10 * W).toISOString();
    const phases = layoutWeeks(NOW.getTime(), 'volume', event).map((x) => x.phase);
    expect(phases).toHaveLength(10);
    expect(phases.slice(-2)).toEqual(['taper', 'peak']);
    expect(phases[3]).toBe('deload');
    // Never a deload right before the taper.
    expect(phases[phases.length - 3]).not.toBe('deload');
    expect(
      layoutWeeks(NOW.getTime(), 'volume', new Date(NOW.getTime() + 2 * W).toISOString()).map(
        (x) => x.phase,
      ),
    ).toEqual(['build', 'peak']);
  });

  it('a dated goal needs an event and an explicit horizon', () => {
    expect(eventDate(plan('correr un 10k en 8 semanas'))).toBeDefined();
    expect(eventDate(plan('ganar fuerza para escalada, 3 días'))).toBeUndefined();
    expect(eventDate(plan('mejorar en 10 semanas'))).toBeUndefined();
  });
});

describe('weekly dose', () => {
  it('a deload keeps the load and cuts sets, minutes and effort', () => {
    const d = applyDose(draft, layoutWeeks(NOW.getTime(), 'volume')[3].dose);
    const squat = d.movements[0].target;
    expect(squat.sets).toBe(2);
    expect(squat.rir).toBe(4);
    expect(squat.loadKg).toBe(100);
    expect(d.movements[1].target.durationMin).toBe(18);
    expect(d.durationMin).toBe(36);
  });

  it('loading weeks add sets or bring sets closer to failure, within bounds', () => {
    const [w0, w1, w2] = layoutWeeks(NOW.getTime(), 'volume');
    expect(applyDose(draft, w0.dose).movements[0].target.rir).toBe(3);
    expect(applyDose(draft, w1.dose).movements[0].target.sets).toBe(5);
    expect(applyDose(draft, w2.dose).movements[0].target.rir).toBe(1);
    const hard = {
      ...draft,
      movements: [{ movementId: 'back_squat', target: { sets: 2, rir: 1 } }],
    };
    const intense = layoutWeeks(NOW.getTime(), 'intensity')[2].dose;
    expect(applyDose(hard, intense).movements[0].target).toMatchObject({ sets: 2, rir: 1 });
    expect(applyDose(draft, null)).toBe(draft);
  });
});

describe('weekly review', () => {
  it('a plan gets a block that starts today', () => {
    const b = reviewBlock(null, signals());
    expect(weekIndex(b, NOW)).toBe(0);
    expect(weekAt(b, NOW)?.phase).toBe('build');
    expect(b.emphasis).toBe('volume');
  });

  it('fatigue piling up brings the deload forward, with its reason', () => {
    const b0 = reviewBlock(null, signals());
    const r = signals().readiness;
    const tired = signals({
      now: new Date(NOW.getTime() + 8 * D),
      cases: [lowCase(-6), lowCase(-7)],
      readiness: { ...r, informed: true, form: { mean: -5, sd: 1 } },
    });
    const b1 = reviewBlock(b0, tired);
    expect(weekAt(b1, tired.now)?.phase).toBe('deload');
    expect(b1.changes[0].reason).toMatch(/Descarga anticipada/);
    // The block ends after the deload; the next one starts the week after.
    expect(b1.weeks).toHaveLength(2);
  });

  it('pain alone is enough to deload', () => {
    const b = reviewBlock(null, signals({ painNow: true }));
    expect(weekAt(b, NOW)?.phase).toBe('deload');
  });

  it('a person absorbing the load well gets one more loading week', () => {
    const b0 = reviewBlock(null, signals());
    const r = signals().readiness;
    const at = new Date(NOW.getTime() + 3 * W + D);
    const fresh = signals({
      now: at,
      cases: [
        { ...lowCase(-21), p: 0.85 },
        { ...lowCase(-22), p: 0.8 },
      ],
      readiness: { ...r, form: { mean: 2, sd: 1 } },
    });
    const b1 = reviewBlock(b0, fresh);
    expect(weekAt(b1, at)?.phase).toBe('push');
    expect(b1.weeks[b1.weeks.length - 1].phase).toBe('deload');
    // Reviewed once: a later pass in the same week doesn't flip it again.
    expect(reviewBlock(b1, fresh)).toEqual(b1);
  });

  it('after a finished block the next one alternates emphasis, novices stay on volume', () => {
    const many = Array.from({ length: 30 }, (_, i) => strength(90 - i * 3, 80 + i));
    const b0 = reviewBlock(null, signals({ sessions: many }));
    const later = new Date(NOW.getTime() + 4 * W + D);
    const next = reviewBlock(b0, signals({ sessions: many, now: later }));
    expect(next.emphasis).toBe('intensity');
    expect(next.sequence).toBe(1);
    const novice = reviewBlock(b0, signals({ now: later }));
    expect(novice.emphasis).toBe('volume');
  });

  it('a new goal starts a new block', () => {
    const b0 = reviewBlock(null, signals());
    const b1 = reviewBlock(b0, signals({ plan: plan('otra cosa', 'p2') }));
    expect(b1.planId).toBe('p2');
    expect(b1.sequence).toBe(0);
  });
});

describe('blocks in the day plan', () => {
  it('the day plan carries the week, and sessions are shaped by it', () => {
    const c = consolidate({
      plan: plan(),
      sessions: progressing,
      checkins: [],
      experiments: [],
      trials: [],
      now: NOW,
    });
    expect(c.block).not.toBeNull();
    expect(c.dayPlan?.phase).toBe('build');
    const shaped = shapeSession(draft, c.dayPlan);
    expect(shaped.movements[0].target.rir).toBe(3);
    // A deload week says so in one line.
    const deloadBlock = {
      ...c.block!,
      weeks: c.block!.weeks.map((w, i) =>
        i === 0 ? { ...w, phase: 'deload' as const, dose: layoutWeeks(0, 'volume')[3].dose } : w,
      ),
      reviewedWeek: 0,
    };
    const d = consolidate({
      plan: plan(),
      sessions: progressing,
      checkins: [],
      experiments: [],
      trials: [],
      block: deloadBlock,
      now: NOW,
    });
    if (d.dayPlan?.band === 'go') expect(d.dayPlan.note).toMatch(/descarga/);
    expect(d.trials).toHaveLength(0);
  });
});
