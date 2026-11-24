import { describe, expect, it } from 'vitest';

import { startExperiment, type CheckIn, type SessionLog, type Suggestion } from '../adaptive';
import { brainSnapshot } from './brain';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86_400_000;

const session = (daysAgo: number, load: number): SessionLog => ({
  id: `s${daysAgo}`,
  title: 'F',
  sport: 'strength',
  startedAt: new Date(NOW.getTime() - daysAgo * D).toISOString(),
  endedAt: new Date(NOW.getTime() - daysAgo * D).toISOString(),
  durationMin: 50,
  rpe: 7,
  movements: [
    {
      movementId: 'back_squat',
      target: { sets: 3, repsMin: 5, repsMax: 5 },
      sets: [1, 2, 3].map(() => ({ reps: 5, loadKg: load, rir: 2, completed: true })),
    },
  ],
});

describe('brain snapshot', () => {
  it('starts from the literature: everything is a hypothesis', () => {
    const b = brainSnapshot([], [], [], NOW);
    expect(b.totals.beliefs).toBe(0);
    expect(b.nodes.every((n) => n.origin === 'literature')).toBe(true);
    expect(b.nodes.find((n) => n.id === 'beta-sleep')?.value).toBe(3);
  });

  it('turns data into beliefs and adds per-exercise trends', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(30 - i * 3, 80 + i * 1.5));
    const checkins: CheckIn[] = [
      {
        id: 'c',
        at: new Date(NOW.getTime() - 3_600_000).toISOString(),
        kind: 'pre',
        sleep: 2,
        soreness: 4,
      },
    ];
    const b = brainSnapshot(sessions, checkins, [], NOW);
    expect(b.totals.beliefs).toBeGreaterThan(0);
    const trend = b.nodes.find((n) => n.id === 'trend-back_squat');
    expect(trend?.value).toBeGreaterThan(1);
    expect(b.nodes.some((n) => n.id === 'sleep-debt')).toBe(true);
    for (const n of b.nodes) {
      expect(n.certainty).toBeGreaterThanOrEqual(0);
      expect(n.certainty).toBeLessThanOrEqual(1);
      expect(n.source.length).toBeGreaterThan(0);
    }
  });

  it('shows tested levers as experiment-origin nodes', () => {
    const base: Suggestion = {
      id: 'x',
      kind: 'add_set',
      movementId: 'back_squat',
      sessionId: 'o',
      title: '',
      rationale: '',
      evidence: [],
      confidence: 'emerging',
      rarity: 'common',
      createdAt: NOW.toISOString(),
      status: 'accepted',
    };
    const exps = [1, 2, 3].map((i) => ({
      ...startExperiment({ ...base, id: `e${i}` }, new Date(NOW.getTime() - 30 * D)),
      status: 'kept' as const,
      success: true,
    }));
    const node = brainSnapshot([], [], exps, NOW).nodes.find((n) => n.id === 'arm-add_set');
    expect(node?.origin).toBe('experiment');
    expect(node?.value).toBeGreaterThan(50);
  });
});
