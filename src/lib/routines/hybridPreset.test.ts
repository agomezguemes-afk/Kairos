import { describe, expect, it } from 'vitest';

import type { ContentNode, ExerciseContentNode } from '../../types/content';
import type { ExerciseCard } from '../../types/core';
import {
  buildHybridRaceBlock,
  distributeAcrossWeek,
  generateHybridPreset,
  isHybridProfile,
  type StarterAnswers,
} from './hybridPreset';

function exercises(content: ContentNode[]): ExerciseCard[] {
  return content
    .filter((n): n is ExerciseContentNode => n.type === 'exercise')
    .map((n) => n.data.exercise);
}

describe('isHybridProfile', () => {
  it('is false for a single discipline', () => {
    expect(isHybridProfile({ disciplines: ['strength'] })).toBe(false);
    expect(isHybridProfile({ disciplines: [] })).toBe(false);
  });

  it('is true for a load + engine combo', () => {
    expect(isHybridProfile({ disciplines: ['strength', 'running'] })).toBe(true);
    expect(isHybridProfile({ disciplines: ['calisthenics', 'cycling'] })).toBe(true);
    expect(isHybridProfile({ disciplines: ['strength', 'swimming'] })).toBe(true);
  });

  it('is false for two disciplines within the same domain', () => {
    // Two engine disciplines, no load domain, only two total → not hybrid.
    expect(isHybridProfile({ disciplines: ['running', 'cycling'] })).toBe(false);
  });

  it('is true for three or more distinct disciplines (multi-discipline)', () => {
    expect(isHybridProfile({ disciplines: ['running', 'cycling', 'swimming'] })).toBe(true);
    expect(isHybridProfile({ disciplines: ['mobility', 'team_sport', 'general'] })).toBe(true);
  });

  it('ignores duplicate disciplines when counting', () => {
    expect(isHybridProfile({ disciplines: ['strength', 'strength'] })).toBe(false);
    expect(isHybridProfile({ disciplines: ['running', 'running', 'cycling'] })).toBe(false);
  });
});

describe('buildHybridRaceBlock', () => {
  const answers: StarterAnswers = { disciplines: ['strength', 'running'], weeklyFrequency: 3 };
  const block = buildHybridRaceBlock(answers);
  const cards = exercises(block.content);

  it('produces a single unbranded hybrid block (never says HYROX)', () => {
    expect(block.name).toBe('Carrera híbrida');
    const serialized = JSON.stringify(block).toLowerCase();
    expect(serialized).not.toContain('hyrox');
  });

  it('spans ≥4 distinct dynamic field ids across the session', () => {
    const fieldIds = new Set<string>();
    for (const c of cards) for (const f of c.fields) fieldIds.add(f.id);
    // erg (m/tiempo) + sled (kg/m) + carrera (pace) + estaciones (reps)
    expect(fieldIds.has('distance')).toBe(true);
    expect(fieldIds.has('duration')).toBe(true);
    expect(fieldIds.has('weight')).toBe(true);
    expect(fieldIds.has('pace')).toBe(true);
    expect(fieldIds.has('reps')).toBe(true);
    expect(fieldIds.size).toBeGreaterThanOrEqual(4);
  });

  it('authors no field by hand — every field is a base field', () => {
    for (const c of cards) {
      for (const f of c.fields) {
        expect(f.isBase).toBe(true);
      }
      // Exactly one primary field per card.
      expect(c.fields.filter((f) => f.isPrimary)).toHaveLength(1);
    }
  });

  it('models the four hybrid station kinds by their field signature', () => {
    const has = (name: string) => cards.find((c) => c.name.includes(name));
    const run = has('Carrera');
    const ski = has('SkiErg');
    const sledPush = has('empuje');
    const wallBalls = has('Wall balls');
    expect(run?.fields.map((f) => f.id)).toContain('pace'); // carrera → pace
    expect(ski?.fields.map((f) => f.id)).toEqual(expect.arrayContaining(['distance', 'duration'])); // erg → m/tiempo
    expect(sledPush?.fields.map((f) => f.id)).toEqual(
      expect.arrayContaining(['weight', 'distance']),
    ); // sled → kg/m
    expect(wallBalls?.fields.map((f) => f.id)).toContain('reps'); // estación → reps
  });

  it('has at least 8 working stations plus warm-up and cool-down', () => {
    // 8 race stations + warmup + cooldown = 10 exercise cards.
    expect(cards.length).toBeGreaterThanOrEqual(10);
  });

  it('gives each station a single for-time set (not 4×hypertrophy sets)', () => {
    const raceStations = cards.filter((c) => c.discipline !== 'mobility');
    for (const c of raceStations) {
      expect(c.sets).toHaveLength(1);
      expect(c.default_sets_count).toBe(1);
    }
  });

  it('wraps the complementary sled pair in a 2-column section', () => {
    const section = block.content.find((n) => n.type === 'columnSection');
    expect(section).toBeDefined();
    const children = block.content.filter((n) => n.section === section!.id);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.column).sort()).toEqual([0, 1]);
    const names = children
      .filter((n): n is ExerciseContentNode => n.type === 'exercise')
      .map((n) => n.data.exercise.name);
    expect(names.some((n) => n.includes('empuje'))).toBe(true);
    expect(names.some((n) => n.includes('arrastre'))).toBe(true);
  });

  it('keeps content node orders unique and monotonic', () => {
    const orders = block.content.map((n) => n.order);
    expect(new Set(orders).size).toBe(orders.length);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it('personalizes the intro with the display name when provided', () => {
    const named = buildHybridRaceBlock({
      disciplines: ['strength', 'running'],
      displayName: 'Álvaro',
    });
    const intro = named.content.find((n) => n.type === 'text' && n.data.content.includes('Álvaro'));
    expect(intro).toBeDefined();
  });
});

describe('distributeAcrossWeek', () => {
  it('spreads N sessions across the week, strictly increasing and distinct', () => {
    for (let freq = 1; freq <= 7; freq++) {
      const days = distributeAcrossWeek(freq);
      expect(days).toHaveLength(freq);
      expect(new Set(days).size).toBe(freq);
      expect(days.every((d, i) => i === 0 || d > days[i - 1])).toBe(true);
      expect(days.every((d) => d >= 0 && d <= 6)).toBe(true);
    }
  });

  it('places 3 sessions on Mon/Wed/Fri', () => {
    expect(distributeAcrossWeek(3)).toEqual([0, 2, 4]);
  });

  it('defaults to 3 and clamps out-of-range input', () => {
    expect(distributeAcrossWeek(null)).toHaveLength(3);
    expect(distributeAcrossWeek(undefined)).toHaveLength(3);
    expect(distributeAcrossWeek(0)).toHaveLength(3);
    expect(distributeAcrossWeek(99)).toHaveLength(7);
  });
});

describe('generateHybridPreset', () => {
  it('returns the block plus a seeded week keyed to that block', () => {
    const result = generateHybridPreset({
      disciplines: ['strength', 'running'],
      weeklyFrequency: 4,
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.weekAssignments).toHaveLength(4);
    for (const wa of result.weekAssignments) {
      expect(wa.blockId).toBe(result.blocks[0].id);
      expect(wa.label).toBeTruthy();
    }
  });
});
