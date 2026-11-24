import { describe, expect, it } from 'vitest';

import {
  generateSuggestions,
  startExperiment,
  type MovementLog,
  type SessionLog,
  type Suggestion,
} from '../adaptive';
import { increments, isPlateau, progressionState } from './changepoint';
import {
  armPosterior,
  chooseLoad,
  sampleBeta,
  seededRng,
  thompsonChoice,
  type ArmOutcome,
} from './decision';

describe('BOCPD progression state', () => {
  it('a flat series is a plateau, a steadily rising one is not', () => {
    expect(isPlateau(progressionState([0, 0, 0]))).toBe(true);
    expect(isPlateau(progressionState([2, 2.2, 1.9, 2.1]))).toBe(false);
    expect(isPlateau(progressionState([0, 0]))).toBe(false); // too few
  });

  it('flags a regime change after progress stalls', () => {
    const before = progressionState([2, 2, 2, 2]);
    // Right after a regime change the boundary itself is uncertain, so it
    // takes ~6 stalled exposures (not 4) to call the new regime a plateau.
    const early = progressionState([2, 2, 2, 2, -0.2, 0, 0.1, 0]);
    expect(early.rate).toBeLessThan(before.rate);
    expect(early.expectedRun).toBeLessThan(8);
    const after = progressionState([2, 2, 2, 2, -0.2, 0, 0.1, 0, 0, 0.1]);
    expect(isPlateau(after)).toBe(true);
  });

  it('run-length posterior is a proper distribution', () => {
    const s = progressionState([1, 0.5, 2, 0, 1]);
    expect(s.runLength.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('increments are relative changes between exposures', () => {
    const xs = increments([100, 102, 102]);
    expect(xs[0]).toBeCloseTo(2, 9);
    expect(xs[1]).toBeCloseTo(0, 9);
  });
});

describe('asymmetric-loss load choice', () => {
  const sets = (n: number, reps: number, load: number, rir: number) =>
    Array.from({ length: n }, () => ({ reps, loadKg: load, rir, completed: true }));

  it('8×3 at 60 kg with RIR 2 (target 6–8) steps to 62.5, not 65', () => {
    const c = chooseLoad({
      current: 60,
      increment: 2.5,
      lastSets: sets(3, 8, 60, 2),
      repsMin: 6,
      rirTarget: 2,
    });
    expect(c.load).toBe(62.5);
    expect(c.probability).toBeGreaterThan(0.6);
    expect(c.candidates[2].probability).toBeLessThan(0.6);
  });

  it('stays put when the success probability is not above 60 %', () => {
    // Barely at the top with no reserve: the next step is a coin flip.
    const c = chooseLoad({
      current: 60,
      increment: 2.5,
      lastSets: sets(3, 8, 60, 0),
      repsMin: 8,
      rirTarget: 1,
    });
    expect(c.load).toBe(60);
  });

  it('noisy history widens uncertainty and makes it more cautious', () => {
    const base = {
      current: 60,
      increment: 2.5,
      lastSets: sets(3, 8, 60, 2),
      repsMin: 6,
      rirTarget: 2,
    };
    const calm = chooseLoad({ ...base, history: [79, 79.5, 80] });
    const noisy = chooseLoad({ ...base, history: [70, 88, 72] });
    expect(noisy.capacity.sd).toBeGreaterThan(calm.capacity.sd);
    expect(noisy.candidates[1].probability).toBeLessThan(calm.candidates[1].probability);
  });
});

describe('contextual Thompson sampling', () => {
  const ctxGood = { band: 'go' as const, debtHigh: false };
  const ctxTired = { band: 'easy' as const, debtHigh: true };

  it('is reproducible for the same seed', () => {
    const a = seededRng('s1');
    const b = seededRng('s1');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('Beta samples have the right mean', () => {
    const rng = seededRng('beta');
    const n = 4000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sampleBeta(3, 7, rng);
    expect(sum / n).toBeCloseTo(0.3, 1);
  });

  it('prefers the lever that worked in this context', () => {
    const outcomes: ArmOutcome[] = [
      ...Array.from({ length: 5 }, () => ({
        arm: 'add_set' as const,
        context: ctxTired,
        success: true,
      })),
      ...Array.from({ length: 5 }, () => ({
        arm: 'increase_load' as const,
        context: ctxTired,
        success: false,
      })),
    ];
    let volume = 0;
    for (let i = 0; i < 200; i++) {
      if (
        thompsonChoice(['increase_load', 'add_set'], outcomes, ctxTired, seededRng(`t${i}`)).arm ===
        'add_set'
      )
        volume++;
    }
    expect(volume / 200).toBeGreaterThan(0.9);
  });

  it('an unseen context inherits the pooled global posterior (half weight)', () => {
    const outcomes: ArmOutcome[] = Array.from({ length: 4 }, () => ({
      arm: 'increase_load' as const,
      context: ctxTired,
      success: true,
    }));
    const p = armPosterior('increase_load', outcomes, ctxGood);
    expect(p).toMatchObject({ a: 1 + 2, b: 1, ln: 0, n: 4 });
  });
});

describe('engine integration', () => {
  const NOW = new Date('2026-11-17T12:00:00Z');
  const squat = (reps: number[], load: number, rir = 2): MovementLog => ({
    movementId: 'back_squat',
    target: { sets: 3, repsMin: 6, repsMax: 8, rir: 2, loadKg: load },
    sets: reps.map((r) => ({ reps: r, loadKg: load, rir, completed: true })),
  });
  const session = (m: MovementLog[], id = 's'): SessionLog => ({
    id,
    title: 'F',
    sport: 'strength',
    startedAt: NOW.toISOString(),
    endedAt: NOW.toISOString(),
    durationMin: 60,
    rpe: 7,
    movements: m,
  });

  it('shows the success probability on a load step', () => {
    const out = generateSuggestions({
      session: session([squat([8, 8, 8], 60)]),
      history: [],
      now: NOW,
    });
    expect(out[0].evidence.some((e) => /Probabilidad de completar 6 reps a 62.5 kg/.test(e))).toBe(
      true,
    );
  });

  it('uses context: volume wins on tired days where it has worked', () => {
    const tired = { band: 'easy' as const, debtHigh: true };
    const base: Suggestion = {
      id: 'x',
      kind: 'add_set',
      movementId: 'pull_up',
      sessionId: 'old',
      title: '',
      rationale: '',
      evidence: [],
      confidence: 'emerging',
      rarity: 'common',
      createdAt: NOW.toISOString(),
      status: 'accepted',
    };
    const closed = (kind: 'add_set' | 'increase_load', success: boolean, i: number) => ({
      ...startExperiment(
        { ...base, id: `e${i}`, kind },
        new Date(NOW.getTime() - 40 * 864e5),
        undefined,
        tired,
      ),
      status: (success ? 'kept' : 'reverted') as 'kept' | 'reverted',
      success,
    });
    const experiments = [
      ...[1, 2, 3, 4].map((i) => closed('add_set', true, i)),
      closed('increase_load', false, 5),
      closed('increase_load', false, 6),
    ];
    let volume = 0;
    for (let i = 0; i < 40; i++) {
      const out = generateSuggestions({
        session: session([squat([8, 8, 8], 60)], `s${i}`),
        history: [],
        now: NOW,
        experiments,
        context: tired,
      });
      if (out.find((x) => x.movementId === 'back_squat')?.kind === 'add_set') volume++;
    }
    expect(volume / 40).toBeGreaterThan(0.7);
  });
});
