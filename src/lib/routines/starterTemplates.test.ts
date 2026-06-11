import { describe, it, expect } from 'vitest';

import {
  buildStarterBlocks,
  STARTER_DISCIPLINES,
  type StarterAnswers,
  type StarterDiscipline,
} from './starterTemplates';
import type { FitnessLevel, EquipmentTag } from '../../types/profile';

const DISCIPLINES = STARTER_DISCIPLINES.map((d) => d.id);
const LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];

function answers(partial: Partial<StarterAnswers> = {}): StarterAnswers {
  return { discipline: 'strength', level: 'beginner', frequency: 3, equipment: [], ...partial };
}

describe('buildStarterBlocks — full matrix', () => {
  for (const discipline of DISCIPLINES) {
    for (const level of LEVELS) {
      for (const frequency of [2, 3, 4, 5]) {
        it(`${discipline} · ${level} · ${frequency}x/week builds a valid space`, () => {
          const blocks = buildStarterBlocks(answers({ discipline, level, frequency }), 'u1');

          expect(blocks.length).toBeGreaterThanOrEqual(1);
          expect(blocks.length).toBeLessThanOrEqual(2);
          expect(blocks[0].is_favorite).toBe(true);

          for (const block of blocks) {
            expect(block.name.length).toBeGreaterThan(0);
            const exercises = block.content.filter((n) => n.type === 'exercise');
            expect(exercises.length).toBeGreaterThanOrEqual(3);

            for (const node of exercises) {
              if (node.type !== 'exercise') continue;
              const ex = node.data.exercise;
              expect(ex.name.length).toBeGreaterThan(0);
              expect(ex.sets.length).toBeGreaterThanOrEqual(1);
              expect(ex.rest_seconds).toBeGreaterThanOrEqual(0);
              expect(ex.workout_block_id).toBe(block.id);
              // Every set carries at least one numeric prefill so the first
              // session starts with targets, never an empty keypad.
              for (const s of ex.sets) {
                const numeric = Object.values(s.values).filter((v) => typeof v === 'number');
                expect(numeric.length).toBeGreaterThanOrEqual(1);
                for (const v of numeric) {
                  expect(Number.isFinite(v)).toBe(true);
                  expect(v as number).toBeGreaterThan(0);
                }
                expect(s.completed).toBe(false);
              }
            }
          }
        });
      }
    }
  }
});

describe('frequency split', () => {
  it('frequency ≤ 3 builds a single block', () => {
    expect(buildStarterBlocks(answers({ frequency: 2 }), 'u1')).toHaveLength(1);
    expect(buildStarterBlocks(answers({ frequency: 3 }), 'u1')).toHaveLength(1);
  });

  it('frequency ≥ 4 builds the A/B split where defined', () => {
    expect(
      buildStarterBlocks(answers({ discipline: 'strength', frequency: 4 }), 'u1'),
    ).toHaveLength(2);
    expect(buildStarterBlocks(answers({ discipline: 'running', frequency: 5 }), 'u1')).toHaveLength(
      2,
    );
  });

  it('single-session disciplines stay at one block even at high frequency', () => {
    expect(
      buildStarterBlocks(answers({ discipline: 'yoga_mobility', frequency: 5 }), 'u1'),
    ).toHaveLength(1);
    expect(
      buildStarterBlocks(answers({ discipline: 'team_sport', frequency: 5 }), 'u1'),
    ).toHaveLength(1);
  });
});

describe('equipment gating', () => {
  function firstExerciseNames(discipline: StarterDiscipline, equipment: EquipmentTag[]): string[] {
    const blocks = buildStarterBlocks(answers({ discipline, equipment, frequency: 4 }), 'u1');
    return blocks.flatMap((b) =>
      b.content.filter((n) => n.type === 'exercise').map((n) => (n as any).data.exercise.name),
    );
  }

  it('barbell user gets barbell lifts', () => {
    const names = firstExerciseNames('strength', ['barbell_plates']);
    expect(names).toContain('Sentadilla con barra');
    expect(names).toContain('Press banca');
    expect(names).toContain('Peso muerto');
  });

  it('no equipment falls back to bodyweight everywhere', () => {
    const names = firstExerciseNames('strength', []);
    expect(names).toContain('Sentadilla peso corporal');
    expect(names).toContain('Flexiones');
    expect(names).toContain('Puente de glúteo');
    expect(names).not.toContain('Sentadilla con barra');
  });

  it('pull-up bar unlocks dominadas on calisthenics day B', () => {
    expect(firstExerciseNames('calisthenics', ['pull_up_bar'])).toContain('Dominadas');
    expect(firstExerciseNames('calisthenics', [])).not.toContain('Dominadas');
  });

  it('kettlebell unlocks swings on hybrid day B', () => {
    expect(firstExerciseNames('hybrid', ['kettlebell'])).toContain('Swing con kettlebell');
  });
});

describe('level progression', () => {
  it('advanced gets at least as many sets as beginner', () => {
    const get = (level: FitnessLevel) => {
      const [block] = buildStarterBlocks(answers({ discipline: 'calisthenics', level }), 'u1');
      return block.content
        .filter((n) => n.type === 'exercise')
        .map((n) => (n as any).data.exercise.sets.length as number);
    };
    const beginner = get('beginner');
    const advanced = get('advanced');
    expect(advanced.length).toBe(beginner.length);
    for (let i = 0; i < beginner.length; i++) {
      expect(advanced[i]).toBeGreaterThanOrEqual(beginner[i]);
    }
  });

  it('running distance scales with level', () => {
    const dist = (level: FitnessLevel) => {
      const [block] = buildStarterBlocks(answers({ discipline: 'running', level }), 'u1');
      const run = block.content.find(
        (n) => n.type === 'exercise' && n.data.exercise.name === 'Rodaje continuo',
      );
      return (run as any).data.exercise.sets[0].values['distance'] as number;
    };
    expect(dist('beginner')).toBeLessThan(dist('intermediate'));
    expect(dist('intermediate')).toBeLessThan(dist('advanced'));
  });

  it('goalReps mirrors the rep prefill so future sessions preload targets', () => {
    const [block] = buildStarterBlocks(
      answers({ discipline: 'strength', level: 'intermediate' }),
      'u1',
    );
    const node = block.content.find((n) => n.type === 'exercise');
    const ex = (node as any).data.exercise;
    expect(ex.goalReps).toBe(ex.sets[0].values['reps']);
  });
});

describe('sort order and identity', () => {
  it('appends after baseSortOrder', () => {
    const blocks = buildStarterBlocks(answers({ discipline: 'strength', frequency: 5 }), 'u1', 7);
    expect(blocks[0].sort_order).toBe(7);
    expect(blocks[1].sort_order).toBe(8);
  });

  it('unique ids across blocks and exercises', () => {
    const blocks = buildStarterBlocks(answers({ discipline: 'hybrid', frequency: 5 }), 'u1');
    const ids = new Set<string>();
    for (const b of blocks) {
      expect(ids.has(b.id)).toBe(false);
      ids.add(b.id);
      for (const n of b.content) {
        expect(ids.has(n.id)).toBe(false);
        ids.add(n.id);
      }
    }
  });
});
