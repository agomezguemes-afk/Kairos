import { describe, it, expect } from 'vitest';

import { classifyModality, prFieldDirection, normalizeExerciseName } from './modality';
import { field } from './_fixtures';

describe('classifyModality — field-driven, hybrid is first-class', () => {
  it('weight + reps → strength', () => {
    expect(classifyModality([field('weight'), field('reps'), field('rir')])).toBe('strength');
  });

  it('reps only (bodyweight) → strength', () => {
    expect(classifyModality([field('reps'), field('duration')])).toBe('strength');
  });

  it('pace + distance → endurance', () => {
    expect(classifyModality([field('distance'), field('duration'), field('pace')])).toBe(
      'endurance',
    );
  });

  it('distance + calories (erg) → endurance', () => {
    expect(classifyModality([field('distance'), field('calories')])).toBe('endurance');
  });

  it('weight + distance (sled push) → hybrid', () => {
    expect(classifyModality([field('weight'), field('distance')])).toBe('hybrid');
  });

  it('reps + calories (cal row for reps) → hybrid', () => {
    expect(classifyModality([field('reps'), field('calories')])).toBe('hybrid');
  });

  it('duration + feeling (pure mobility) → unknown', () => {
    expect(classifyModality([field('duration'), field('perceivedEffort')])).toBe('unknown');
  });

  it('empty fields → unknown', () => {
    expect(classifyModality([])).toBe('unknown');
  });

  it('custom-only fields → unknown', () => {
    expect(classifyModality([field('custom_mood'), field('custom_focus')])).toBe('unknown');
  });
});

describe('prFieldDirection — conservative v1 map', () => {
  it('weight/reps/distance/calories/progression are higher-is-better', () => {
    for (const f of ['weight', 'reps', 'distance', 'calories', 'progression']) {
      expect(prFieldDirection(f)).toBe('higher');
    }
  });

  it('pace is lower-is-better', () => {
    expect(prFieldDirection('pace')).toBe('lower');
  });

  it('subjective/ambiguous fields do not track PRs', () => {
    for (const f of ['heartRate', 'rir', 'perceivedEffort', 'duration', 'rpe', 'custom']) {
      expect(prFieldDirection(f)).toBeNull();
    }
  });
});

describe('normalizeExerciseName — stable match key', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeExerciseName('  Press   Banca ')).toBe('press banca');
  });

  it('strips superset cycle suffix', () => {
    expect(normalizeExerciseName('Press banca · 2/3')).toBe('press banca');
  });

  it('two spellings of the same lift collide', () => {
    expect(normalizeExerciseName('Sentadilla')).toBe(normalizeExerciseName('sentadilla'));
  });
});
