import { describe, it, expect } from 'vitest';

import { readExerciseHistory } from './readExerciseHistory';
import { entry, exSummary, pset, legacyPset } from './_fixtures';

describe('readExerciseHistory — digest raw sessions per exercise', () => {
  it('empty history → empty sessions', () => {
    const h = readExerciseHistory([], { name: 'Sentadilla' });
    expect(h.sessions).toHaveLength(0);
    expect(h.key).toBe('sentadilla');
  });

  it('matches by normalized name across blocks', () => {
    const history = [entry([exSummary('Press Banca', [pset({ weight: 60, reps: 8 })])])];
    const h = readExerciseHistory(history, { name: '  press   banca ' });
    expect(h.sessions).toHaveLength(1);
    expect(h.sessions[0].sets[0].values).toEqual({ weight: 60, reps: 8 });
  });

  it('libraryId wins over name (renamed card still correlates)', () => {
    const history = [
      entry([
        exSummary('Sentadilla renombrada', [pset({ weight: 100, reps: 5 })], {
          libraryId: 'lib_squat',
        }),
      ]),
    ];
    const h = readExerciseHistory(history, { name: 'algo distinto', libraryId: 'lib_squat' });
    expect(h.sessions).toHaveLength(1);
    expect(h.sessions[0].sets[0].values['weight']).toBe(100);
  });

  it('drops non-completed sets', () => {
    const history = [
      entry([
        exSummary('Remo', [
          pset({ weight: 40, reps: 10 }, { completed: true }),
          pset({ weight: 50, reps: 10 }, { completed: false }),
        ]),
      ]),
    ];
    const h = readExerciseHistory(history, { name: 'Remo' });
    expect(h.sessions[0].sets).toHaveLength(1);
    expect(h.sessions[0].sets[0].values['weight']).toBe(40);
  });

  it('drops a session with zero completed numeric sets', () => {
    const history = [entry([exSummary('Remo', [pset({ weight: 40 }, { completed: false })])])];
    expect(readExerciseHistory(history, { name: 'Remo' }).sessions).toHaveLength(0);
  });

  it('preserves most-recent-first order from the store', () => {
    const history = [
      entry([exSummary('Sentadilla', [pset({ weight: 105, reps: 5 })])], { endedAt: 2000 }),
      entry([exSummary('Sentadilla', [pset({ weight: 100, reps: 5 })])], { endedAt: 1000 }),
    ];
    const h = readExerciseHistory(history, { name: 'Sentadilla' });
    expect(h.sessions.map((s) => s.sets[0].values['weight'])).toEqual([105, 100]);
    expect(h.sessions[0].performedAt).toBe(2000);
  });

  it('reconstructs weight/reps from LEGACY entries without a values map', () => {
    const history = [entry([exSummary('Peso muerto', [legacyPset(120, 3)])])];
    const h = readExerciseHistory(history, { name: 'Peso muerto' });
    expect(h.sessions[0].sets[0].values).toEqual({ weight: 120, reps: 3 });
  });

  it('legacy entry with null weight/reps yields no usable set', () => {
    const history = [entry([exSummary('Movilidad', [legacyPset(null, null)])])];
    expect(readExerciseHistory(history, { name: 'Movilidad' }).sessions).toHaveLength(0);
  });

  it('carries RPE and endurance fields from the values map', () => {
    const history = [
      entry([
        exSummary('Row erg', [pset({ distance: 500, calories: 30, pace: 1.55 }, { rpe: 6 })]),
      ]),
    ];
    const set = readExerciseHistory(history, { name: 'Row erg' }).sessions[0].sets[0];
    expect(set.values).toEqual({ distance: 500, calories: 30, pace: 1.55 });
    expect(set.rpe).toBe(6);
  });

  it('ignores non-numeric field values', () => {
    const history = [entry([exSummary('Nota', [pset({ weight: 60, tag: 'pesado', done: true })])])];
    const h = readExerciseHistory(history, { name: 'Nota' });
    expect(h.sessions[0].sets[0].values).toEqual({ weight: 60 });
  });
});
