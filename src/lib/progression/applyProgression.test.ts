import { describe, it, expect } from 'vitest';

import { applyProgression } from './applyProgression';
import { createWorkoutBlock, createExerciseCard } from '../../types/core';
import type { WorkoutBlock, ExerciseCard } from '../../types/core';
import { createExerciseNode } from '../../types/content';
import { entry, exSummary, pset } from './_fixtures';
import type { AdaptationSignal } from '../readiness/adaptiveEngine';

function blockWith(exercises: ExerciseCard[]): WorkoutBlock {
  const block = createWorkoutBlock('user_001', 0, 'strength', { name: 'Hoy' });
  return { ...block, content: exercises.map((ex, i) => createExerciseNode(i, ex)) };
}

describe('applyProgression — pre-fills a freshly built block', () => {
  it('carries last weight into every set + sets goals (strength)', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla con barra' });
    const block = blockWith([squat]);
    const history = [
      entry([exSummary('Sentadilla con barra', [pset({ weight: 60, reps: 8 }, { rpe: 6 })])]),
    ];

    const enriched = applyProgression(block, history);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(ex).not.toBeNull();
    // RPE 6 (easy) → 60 kg nudged to 62.5 across all sets.
    for (const s of ex!.sets) {
      expect(s.values['weight']).toBe(62.5);
      expect(s.values['reps']).toBe(8);
    }
    expect(ex!.goalWeight).toBe(62.5);
    expect(ex!.goalReps).toBe(8);
  });

  it('carries pace/distance for endurance work (no nudge)', () => {
    const run = createExerciseCard('b', 0, 'running', { name: 'Rodaje continuo' });
    const block = blockWith([run]);
    const history = [
      entry([exSummary('Rodaje continuo', [pset({ distance: 8, duration: 40, pace: 5 })])]),
    ];

    const enriched = applyProgression(block, history);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(ex!.sets[0].values['distance']).toBe(8);
    expect(ex!.sets[0].values['pace']).toBe(5);
  });

  it('leaves exercises without history untouched', () => {
    const known = createExerciseCard('b', 0, 'strength', { name: 'Press banca' });
    const novel = createExerciseCard('b', 1, 'strength', { name: 'Ejercicio nuevo' });
    const block = blockWith([known, novel]);
    const history = [entry([exSummary('Press banca', [pset({ weight: 80, reps: 5 })])])];

    const enriched = applyProgression(block, history);
    const novelOut =
      enriched.content[1].type === 'exercise' ? enriched.content[1].data.exercise : null;
    expect(novelOut!.sets.every((s) => s.values['weight'] === null)).toBe(true);
    expect(novelOut!.goalWeight).toBeUndefined();
  });

  it('empty history → returns the block unchanged (same reference)', () => {
    const block = blockWith([createExerciseCard('b', 0, 'strength', { name: 'Sentadilla' })]);
    expect(applyProgression(block, [])).toBe(block);
  });

  it('is immutable — the input block and its sets are not mutated', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla' });
    const block = blockWith([squat]);
    const originalWeight =
      block.content[0].type === 'exercise'
        ? block.content[0].data.exercise.sets[0].values['weight']
        : undefined;
    const history = [entry([exSummary('Sentadilla', [pset({ weight: 90, reps: 5 })])])];

    applyProgression(block, history);

    const afterWeight =
      block.content[0].type === 'exercise'
        ? block.content[0].data.exercise.sets[0].values['weight']
        : undefined;
    expect(afterWeight).toBe(originalWeight); // still null on the source
  });

  it('matches by normalized name (whitespace/case differences)', () => {
    const ex = createExerciseCard('b', 0, 'strength', { name: 'Press  Militar' });
    const block = blockWith([ex]);
    const history = [entry([exSummary('press militar', [pset({ weight: 40, reps: 8 })])])];

    const enriched = applyProgression(block, history);
    const out = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(out!.sets[0].values['weight']).toBe(40);
  });

  // The BlockReadyCard "memoria que compone" cue reads exactly this contract:
  // a changed reference ⇒ enrichment happened ⇒ show the cue.
  it('returns a NEW reference when it actually enriched (cue signal)', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla' });
    const block = blockWith([squat]);
    const history = [entry([exSummary('Sentadilla', [pset({ weight: 90, reps: 5 })])])];
    expect(applyProgression(block, history)).not.toBe(block);
  });
});

describe('applyProgression — warmup sets skip the RPE nudge', () => {
  function withWarmupFirst(ex: ExerciseCard): ExerciseCard {
    return { ...ex, sets: ex.sets.map((s, i) => (i === 0 ? { ...s, kind: 'warmup' } : s)) };
  }

  it('carries the last weight forward on a warmup set, nudges only working sets', () => {
    const squat = withWarmupFirst(createExerciseCard('b', 0, 'strength', { name: 'Sentadilla' }));
    const block = blockWith([squat]);
    // RPE 6 (easy) → working sets nudge 60 → 62.5; warmup holds at 60.
    const history = [entry([exSummary('Sentadilla', [pset({ weight: 60, reps: 8 }, { rpe: 6 })])])];

    const enriched = applyProgression(block, history);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(ex!.sets[0].kind).toBe('warmup');
    expect(ex!.sets[0].values['weight']).toBe(60);
    for (let i = 1; i < ex!.sets.length; i++) {
      expect(ex!.sets[i].values['weight']).toBe(62.5);
    }
    // The working goal still reflects the nudge.
    expect(ex!.goalWeight).toBe(62.5);
  });

  it('reverses a nudge-down too (hard last set → working backs off, warmup holds)', () => {
    const dead = withWarmupFirst(createExerciseCard('b', 0, 'strength', { name: 'Peso muerto' }));
    const block = blockWith([dead]);
    // RPE 10 (maxed) → working sets 100 → 97.5; warmup holds at 100.
    const history = [
      entry([exSummary('Peso muerto', [pset({ weight: 100, reps: 3 }, { rpe: 10 })])]),
    ];

    const enriched = applyProgression(block, history);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(ex!.sets[0].values['weight']).toBe(100);
    expect(ex!.sets[1].values['weight']).toBe(97.5);
  });
});

describe('applyProgression — with adaptation signal', () => {
  it('deload signal suppresses an increase when pre-filling a new block', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla con barra' });
    const block = blockWith([squat]);
    const history = [
      entry([exSummary('Sentadilla con barra', [pset({ weight: 60, reps: 8 }, { rpe: 6 })])]),
    ];
    const adaptation: AdaptationSignal = { value: -0.8, confidence: 'high', dominant: 'recovery' };

    const enriched = applyProgression(block, history, adaptation);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    for (const s of ex!.sets) {
      expect(s.values['weight']).toBe(60); // increase suppressed
    }
  });

  it('omitting adaptation reproduces the exact pre-change output (regression)', () => {
    const squat = createExerciseCard('b', 0, 'strength', { name: 'Sentadilla con barra' });
    const block = blockWith([squat]);
    const history = [
      entry([exSummary('Sentadilla con barra', [pset({ weight: 60, reps: 8 }, { rpe: 6 })])]),
    ];
    const enriched = applyProgression(block, history);
    const ex = enriched.content[0].type === 'exercise' ? enriched.content[0].data.exercise : null;
    expect(ex!.sets[0].values['weight']).toBe(62.5);
  });
});
