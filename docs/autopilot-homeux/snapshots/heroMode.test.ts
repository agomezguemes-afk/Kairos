// heroMode — exhaustive over DayCardVariant (STORY-02). The greeting shrinks
// only when today has something to START or CONTINUE; every other variant
// keeps the full-size greeting.

import { describe, it, expect } from 'vitest';
import { heroMode } from './heroMode';
import type { DayCardVariant } from '../hooks/useDayCardState';

describe('heroMode — exhaustive over DayCardVariant', () => {
  const cases: Array<[DayCardVariant, 'full' | 'compact']> = [
    ['assigned', 'compact'],
    ['in-progress', 'compact'],
    ['empty', 'full'],
    ['no-blocks', 'full'],
    ['completed', 'full'],
    ['future-assigned', 'full'],
    ['future-empty', 'full'],
    ['past-skipped', 'full'],
    ['past-empty', 'full'],
  ];

  it.each(cases)('%s → %s', (variant, expected) => {
    expect(heroMode(variant)).toBe(expected);
  });
});
