import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import type { ExerciseContentNode } from '../../types/content';
import type { ExerciseCard } from '../../types/core';
import { ANALYTICS_EVENTS, getTrackedEventsByName, resetAnalytics } from '../analytics';
import {
  detectFormat,
  importWorkoutCSV,
  parseHevyCSV,
  parseStrongCSV,
  type ImportResult,
} from './importWorkouts';

function fixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');
}

function cards(result: ImportResult): ExerciseCard[] {
  return result.blocks.flatMap((b) =>
    b.content
      .filter((n): n is ExerciseContentNode => n.type === 'exercise')
      .map((n) => n.data.exercise),
  );
}

function cardNamed(result: ImportResult, name: string): ExerciseCard | undefined {
  return cards(result).find((c) => c.name === name);
}

describe('detectFormat', () => {
  it('recognises Strong and Hevy headers', () => {
    expect(detectFormat(['Date', 'Workout Name', 'Exercise Name', 'Set Order'])).toBe('strong');
    expect(detectFormat(['title', 'exercise_title', 'weight_kg'])).toBe('hevy');
    expect(detectFormat(['foo', 'bar'])).toBe('unknown');
  });
});

describe('Strong dirty import — the hybrid tolerance test', () => {
  beforeEach(() => resetAnalytics());

  // Prepend a BOM to prove tolerance to the messiest real export.
  const result = parseStrongCSV('﻿' + fixture('strong-dirty.csv'));

  it('detects the format and produces one session block', () => {
    expect(result.format).toBe('strong');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].name).toBe('Push, Pull & Legs');
  });

  it('keeps the strength exercise as weight + reps', () => {
    const bench = cardNamed(result, 'Bench Press');
    expect(bench).toBeDefined();
    expect(bench!.fields.map((f) => f.id)).toEqual(['weight', 'reps']);
    expect(bench!.sets).toHaveLength(2);
    expect(bench!.sets[0].values.weight).toBe(60);
    expect(bench!.sets[0].values.reps).toBe(8);
    expect(bench!.sets[0].rpe).toBe(7);
    expect(bench!.sets[0].notes).toBe('sólida, sin fallo');
  });

  it('PRESERVES the cardio exercise fields (distance + time) instead of discarding them', () => {
    const run = cardNamed(result, 'Treadmill Run');
    expect(run).toBeDefined();
    // This is the crux: distance + duration survive, they are NOT dropped.
    expect(run!.fields.map((f) => f.id)).toEqual(['distance', 'duration']);
    expect(run!.sets[0].values.distance).toBe(5.0);
    expect(run!.sets[0].values.duration).toBe(1500);
    expect(run!.sets[0].notes).toBe('ritmo "suave"');
  });

  it('reports every dynamic field preserved across the import', () => {
    expect(result.stats.fieldsPreserved).toEqual(
      expect.arrayContaining(['weight', 'reps', 'distance', 'duration']),
    );
  });

  it('warns about the orphan row with no exercise name (nothing silently lost)', () => {
    expect(result.warnings.some((w) => w.includes('sin nombre de ejercicio'))).toBe(true);
    expect(cards(result)).toHaveLength(2); // orphan skipped, not merged
  });

  it('marks imported sets as completed history', () => {
    const bench = cardNamed(result, 'Bench Press')!;
    expect(bench.sets.every((s) => s.completed)).toBe(true);
    expect(result.blocks[0].status).toBe('completed');
  });

  it('emits data_imported with counts', () => {
    parseStrongCSV('﻿' + fixture('strong-dirty.csv'));
    const ev = getTrackedEventsByName(ANALYTICS_EVENTS.data_imported).at(-1);
    expect(ev?.props).toMatchObject({ format: 'strong', blocks: 1, exercises: 2, sets: 4 });
  });
});

describe('Hevy import', () => {
  const result = parseHevyCSV(fixture('hevy-sample.csv'));

  it('imports both a strength and an erg exercise, keeping all fields', () => {
    expect(result.format).toBe('hevy');
    const squat = cardNamed(result, 'Squat');
    const erg = cardNamed(result, 'Row Erg');
    expect(squat!.fields.map((f) => f.id)).toEqual(['weight', 'reps']);
    expect(erg!.fields.map((f) => f.id)).toEqual(['distance', 'duration']);
    expect(erg!.sets[0].values.distance).toBe(1.0);
    expect(erg!.sets[0].values.duration).toBe(240);
  });

  it('maps set_type warmup to the warmup set kind', () => {
    const erg = cardNamed(result, 'Row Erg')!;
    expect(erg.sets[1].kind).toBe('warmup');
  });
});

describe('column tolerance', () => {
  it('maps a pace column when present', () => {
    const csv =
      'Date,Workout Name,Exercise Name,Set Order,Distance,Seconds,Pace\n' +
      '2026-07-08,Run,Easy Run,1,5.0,1500,5.2';
    const result = parseStrongCSV(csv);
    const run = cardNamed(result, 'Easy Run')!;
    expect(run.fields.map((f) => f.id)).toEqual(
      expect.arrayContaining(['distance', 'duration', 'pace']),
    );
    expect(run.sets[0].values.pace).toBe(5.2);
  });

  it('parses decimal-comma numbers from a semicolon export', () => {
    const csv =
      'Date;Workout Name;Exercise Name;Set Order;Distance;Seconds\n2026-07-08;Run;Easy;1;2,5;1500';
    const result = parseStrongCSV(csv);
    expect(cardNamed(result, 'Easy')!.sets[0].values.distance).toBe(2.5);
  });
});

describe('importWorkoutCSV auto-detect', () => {
  beforeEach(() => resetAnalytics());

  it('routes Strong and Hevy automatically', () => {
    expect(importWorkoutCSV('﻿' + fixture('strong-dirty.csv')).format).toBe('strong');
    expect(importWorkoutCSV(fixture('hevy-sample.csv')).format).toBe('hevy');
  });

  it('fails loudly (with a warning, no blocks) on an unknown format', () => {
    const result = importWorkoutCSV('foo,bar\n1,2');
    expect(result.format).toBe('unknown');
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings[0]).toContain('Formato no reconocido');
  });

  it('handles an empty CSV without throwing', () => {
    const result = importWorkoutCSV('');
    expect(result.blocks).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
