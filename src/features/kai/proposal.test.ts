import { describe, expect, it } from 'vitest';
import { generateProposals, type ProposalInputs } from './proposal';

const BASE: ProposalInputs = {
  now: Date.now(),
  daysSinceLastWorkout: 1,
  sessionsLast7Days: 2,
  domainCounts: { strength: 2 },
  stalledLift: null,
  recentPr: null,
  streak: 3,
  blocksCount: 4,
};

describe('generateProposals', () => {
  it('says nothing when there is nothing worth saying (silence > noise)', () => {
    expect(generateProposals(BASE)).toEqual([]);
  });

  it('proposes only "start" when the space is empty (and nothing else)', () => {
    const out = generateProposals({ ...BASE, blocksCount: 0, recentPr: { name: 'Banca' } });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('start');
  });

  it('celebrates a PR with the highest non-start priority', () => {
    const out = generateProposals({ ...BASE, recentPr: { name: 'Sentadilla' } });
    expect(out[0].tone).toBe('celebrate');
    expect(out[0].headline).toMatch(/Sentadilla/);
  });

  it('flags overreach at 5+ sessions in 7 days', () => {
    const out = generateProposals({ ...BASE, sessionsLast7Days: 6 });
    expect(out.some((p) => p.kind === 'deload')).toBe(true);
  });

  it('names a plateau only at/after the 3-week threshold', () => {
    expect(generateProposals({ ...BASE, stalledLift: { name: 'Press', weeks: 2 } })).toEqual([]);
    const out = generateProposals({ ...BASE, stalledLift: { name: 'Press', weeks: 4 } });
    expect(out.some((p) => p.kind === 'insight' && p.headline.includes('Press'))).toBe(true);
  });

  it('suggests balance when one domain is ≥85% of a meaningful sample', () => {
    const out = generateProposals({
      ...BASE,
      domainCounts: { strength: 6, running: 0, mobility: 0 },
    });
    expect(out.some((p) => p.kind === 'balance')).toBe(true);
  });

  it('does not cry imbalance on a tiny sample', () => {
    const out = generateProposals({ ...BASE, domainCounts: { strength: 2 } });
    expect(out.some((p) => p.kind === 'balance')).toBe(false);
  });

  it('welcomes back after a 5+ day gap', () => {
    const out = generateProposals({ ...BASE, daysSinceLastWorkout: 6 });
    expect(out.some((p) => p.kind === 'recover')).toBe(true);
  });

  it('celebrates streak milestones only on exact thresholds', () => {
    expect(generateProposals({ ...BASE, streak: 29 }).some((p) => p.id.startsWith('streak'))).toBe(
      false,
    );
    expect(generateProposals({ ...BASE, streak: 30 }).some((p) => p.id === 'streak-30')).toBe(true);
  });

  it('caps output and orders by priority (PR before deload)', () => {
    const out = generateProposals({
      ...BASE,
      recentPr: { name: 'Peso muerto' },
      sessionsLast7Days: 6,
      stalledLift: { name: 'Press', weeks: 5 },
    });
    expect(out).toHaveLength(2);
    expect(out[0].tone).toBe('celebrate'); // PR wins
  });
});
