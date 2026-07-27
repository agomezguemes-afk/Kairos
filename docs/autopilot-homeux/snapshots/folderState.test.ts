// folderState — smart default + remembered-wins precedence (STORY-03).
// The pure core of the Home folder's memory: folderDefaultOpen is exhaustive
// over every DayCardVariant, resolveFolderOpen pins the "user choice always
// wins" contract from §7.1.

import { describe, it, expect } from 'vitest';
import { folderDefaultOpen, resolveFolderOpen } from './folderState';
import type { DayCardVariant } from '../hooks/useDayCardState';

describe('folderDefaultOpen — exhaustive over DayCardVariant', () => {
  const cases: Array<[DayCardVariant, boolean]> = [
    ['empty', true],
    ['no-blocks', true],
    ['assigned', false],
    ['in-progress', false],
    ['completed', false],
    ['future-assigned', false],
    ['future-empty', false],
    ['past-skipped', false],
    ['past-empty', false],
  ];

  it.each(cases)('%s → %s', (variant, expected) => {
    expect(folderDefaultOpen(variant)).toBe(expected);
  });

  it('opens only when there is nothing to start today', () => {
    // The two "open" variants are exactly the days where the folder's content
    // (calendar to assign, status to consult) is the primary action.
    const opens = cases.filter(([, v]) => v).map(([variant]) => variant);
    expect(opens).toEqual(['empty', 'no-blocks']);
  });
});

describe('resolveFolderOpen — remembered choice always wins', () => {
  it('(true, "assigned") → true (remembered open beats smart-closed)', () => {
    expect(resolveFolderOpen(true, 'assigned')).toBe(true);
  });

  it('(false, "empty") → false (remembered closed beats smart-open)', () => {
    expect(resolveFolderOpen(false, 'empty')).toBe(false);
  });

  it('(null, "empty") → true (falls to smart default on first contact)', () => {
    expect(resolveFolderOpen(null, 'empty')).toBe(true);
  });

  it('(null, "assigned") → false (falls to smart default on first contact)', () => {
    expect(resolveFolderOpen(null, 'assigned')).toBe(false);
  });

  it('null defers to folderDefaultOpen across every variant', () => {
    const variants: DayCardVariant[] = [
      'empty',
      'no-blocks',
      'assigned',
      'in-progress',
      'completed',
      'future-assigned',
      'future-empty',
      'past-skipped',
      'past-empty',
    ];
    for (const v of variants) {
      expect(resolveFolderOpen(null, v)).toBe(folderDefaultOpen(v));
    }
  });

  it('a remembered choice ignores the variant entirely', () => {
    const variants: DayCardVariant[] = ['empty', 'no-blocks', 'assigned', 'completed'];
    for (const v of variants) {
      expect(resolveFolderOpen(true, v)).toBe(true);
      expect(resolveFolderOpen(false, v)).toBe(false);
    }
  });
});
