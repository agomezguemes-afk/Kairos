import { describe, expect, it } from 'vitest';

import type { CheckIn, SessionLog } from '../adaptive';
import { replayStates } from './backtest';
import { consolidate } from './consolidate';
import { expertPanel, type PanelInput } from './lenses';
import {
  buildEpisodes,
  completionOf,
  decisionContext,
  recall,
  similarity,
  type DecisionContext,
  type Episode,
} from './memory';
import { readinessV2 } from './readiness';
import { adherence } from './survival';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * D).toISOString();

function strength(daysAgo: number, load: number, done = 3, id = `s${daysAgo}`): SessionLog {
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
        sets: [1, 2, 3].map((n) => ({ reps: 5, loadKg: load, rir: 2, completed: n <= done })),
      },
    ],
  };
}

const ctx = (over: Partial<DecisionContext> = {}): DecisionContext => ({
  p: 0.7,
  debt: 0,
  recovered: 1,
  ratio: 1,
  gap: 2,
  soreness: 1,
  ...over,
});

const episode = (i: number, context: DecisionContext, bad: boolean): Episode => ({
  sessionId: `e${i}`,
  at: ago(60 - i),
  context,
  action: 'full',
  completion: 1,
  perf: bad ? -5 : 1,
  pain: false,
  bad,
});

describe('decision memory', () => {
  it('completion counts done sets against the plan', () => {
    expect(completionOf(strength(1, 80, 2))).toBeCloseTo(2 / 3);
    expect(completionOf(strength(1, 80, 3))).toBe(1);
  });

  it('similarity is 1 for the same day and fades with distance', () => {
    expect(similarity(ctx(), ctx())).toBe(1);
    expect(similarity(ctx(), ctx({ p: 0.4, debt: 6 }))).toBeLessThan(0.01);
    expect(similarity(ctx(), ctx({ debt: 1 }))).toBeGreaterThan(0.8);
  });

  it('recall answers from the nearest cases, not the whole history', () => {
    const tired = ctx({ p: 0.4, debt: 5 });
    const fresh = ctx({ p: 0.8, debt: 0 });
    const eps = [
      ...Array.from({ length: 6 }, (_, i) => episode(i, tired, true)),
      ...Array.from({ length: 6 }, (_, i) => episode(10 + i, fresh, false)),
    ];
    const a = recall(tired, eps)!;
    const b = recall(fresh, eps)!;
    expect(a.pBad).toBeGreaterThan(0.6);
    expect(b.pBad).toBeLessThan(0.25);
    expect(a.nEff).toBeGreaterThanOrEqual(5);
    expect(a.similar.every((e) => e.bad)).toBe(true);
    expect(recall(tired, [])).toBeNull();
    // A different action has no cases yet: the prior (base rate) answers.
    expect(recall(tired, eps, 'reduced')!.nEff).toBe(0);
  });

  it('episodes wait 72 h for pain, and pain makes a session a bad case', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => strength(30 - i * 3, 80 + i * 2.5));
    const pain: CheckIn[] = [{ id: 'p', at: ago(19), kind: 'weekly', pain: true }];
    const states = replayStates(sessions, pain);
    const eps = buildEpisodes(states, pain, [], NOW);
    // The last session (3 days ago minus a bit) is old enough; none are skipped
    // for lack of time except those within 72 h.
    expect(eps.length).toBeGreaterThan(0);
    const afterPain = eps.find((e) => e.sessionId === 's21');
    expect(afterPain?.pain).toBe(true);
    expect(afterPain?.bad).toBe(true);
    const soon = buildEpisodes(states, [], [], new Date(NOW.getTime() - 2 * D));
    expect(soon.some((e) => e.sessionId === 's3')).toBe(false);
  });

  it('advice from the journal is attached to its session', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => strength(30 - i * 3, 80 + i * 2.5));
    const advice = [{ sessionId: 's9', at: ago(9), band: 'easy' as const }];
    const c = consolidate({
      plan: null,
      sessions,
      checkins: [],
      experiments: [],
      trials: [],
      advice,
      now: NOW,
    });
    expect(c.memory.find((e) => e.sessionId === 's9')?.advised?.band).toBe('easy');
  });
});

describe('experience in the panel', () => {
  const sessions = Array.from({ length: 10 }, (_, i) => strength(30 - i * 3, 80 + i * 2.5));
  const r = readinessV2(sessions, [], NOW, { nextMovements: ['back_squat'] });
  const base = (over: Partial<PanelInput> = {}): PanelInput => ({
    readiness: r,
    sessions,
    nextMovements: ['back_squat'],
    adherence: adherence(sessions, NOW, 3),
    pain: null,
    painNow: false,
    checkins: [],
    now: NOW,
    ...over,
  });
  const today = (input: PanelInput) =>
    decisionContext(input.readiness, input.sessions, [], input.nextMovements, input.now);

  it('with no similar days, experience stays quiet', () => {
    const memory = expertPanel(base()).lenses.find((l) => l.id === 'memory')!;
    expect(memory.stance).toBe('push');
    expect(memory.findings).toHaveLength(0);
  });

  it('days like this that went badly ask for a lighter session', () => {
    const input = base();
    const here = today(input);
    const memory = [
      ...Array.from({ length: 5 }, (_, i) => episode(i, here, true)),
      ...Array.from({ length: 8 }, (_, i) => episode(10 + i, ctx({ p: 0.3, debt: 6 }), false)),
    ];
    const p = expertPanel({ ...input, memory });
    const lens = p.lenses.find((l) => l.id === 'memory')!;
    expect(lens.stance).toBe('ease');
    expect(lens.findings.length).toBeGreaterThan(0);
    expect(p.verdict.band).toBe('easy');
  });

  it('experience can lift a caution that rests on state alone', () => {
    const tired = { ...r, predictive: 0.5, probability: 0.5 };
    const input = base({ readiness: tired });
    const here = today(input);
    const memory = Array.from({ length: 8 }, (_, i) => episode(i, here, false));
    const without = expertPanel(input);
    expect(without.verdict.band).toBe('easy');
    const p = expertPanel({ ...input, memory });
    expect(p.verdict.band).toBe('go');
    expect(p.verdict.lead).toBe('memory');
  });

  it('but never over pain', () => {
    const tired = { ...r, predictive: 0.5, probability: 0.5 };
    const input = base({ readiness: tired, painNow: true });
    const memory = Array.from({ length: 8 }, (_, i) => episode(i, today(input), false));
    const p = expertPanel({ ...input, memory });
    expect(p.verdict.band).toBe('rest');
    expect(p.verdict.lead).toBe('clinical');
  });
});
