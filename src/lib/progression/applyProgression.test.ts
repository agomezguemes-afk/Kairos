import { describe, it, expect } from 'vitest';

import { applyProgression } from './applyProgression';
import { createWorkoutBlock, createExerciseCard } from '../../types/core';
import type { WorkoutBlock, ExerciseCard } from '../../types/core';
import { createExerciseNode } from '../../types/content';
import { entry, exSummary, pset } from './_fixtures';

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
});
