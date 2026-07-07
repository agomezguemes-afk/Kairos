import { describe, it, expect } from 'vitest';

import {
  computeWeekAssignments,
  groupAssignmentsByBlock,
  toRRuleWeekday,
  weekdaysForFrequency,
} from './weekAssignments';

describe('weekdaysForFrequency', () => {
  it('frequency 2 → lunes y jueves', () => {
    expect(weekdaysForFrequency(2)).toEqual([1, 4]);
  });

  it('frequency 3 → lunes, miércoles, viernes', () => {
    expect(weekdaysForFrequency(3)).toEqual([1, 3, 5]);
  });

  it('frequency 4 → lunes, martes, jueves, viernes', () => {
    expect(weekdaysForFrequency(4)).toEqual([1, 2, 4, 5]);
  });

  it('frequency 5 → lunes a viernes', () => {
    expect(weekdaysForFrequency(5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('covers the full 1–7 range with exactly `frequency` valid days', () => {
    for (let f = 1; f <= 7; f++) {
      const days = weekdaysForFrequency(f);
      expect(days).toHaveLength(f);
      expect(new Set(days).size).toBe(f);
      for (const d of days) {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });

  it('clamps out-of-range and non-finite input', () => {
    expect(weekdaysForFrequency(0)).toEqual([1]);
    expect(weekdaysForFrequency(-3)).toEqual([1]);
    expect(weekdaysForFrequency(12)).toHaveLength(7);
    expect(weekdaysForFrequency(NaN)).toEqual([1, 3, 5]); // defaults to 3
    expect(weekdaysForFrequency(2.6)).toEqual([1, 3, 5]); // rounds to 3
  });
});

describe('computeWeekAssignments', () => {
  it('single block owns every training day (frequency 2)', () => {
    expect(computeWeekAssignments(['A'], 2)).toEqual([
      { blockId: 'A', weekday: 1 },
      { blockId: 'A', weekday: 4 },
    ]);
  });

  it('single block, frequency 3', () => {
    expect(computeWeekAssignments(['A'], 3)).toEqual([
      { blockId: 'A', weekday: 1 },
      { blockId: 'A', weekday: 3 },
      { blockId: 'A', weekday: 5 },
    ]);
  });

  it('A/B split alternates round-robin (frequency 4)', () => {
    expect(computeWeekAssignments(['A', 'B'], 4)).toEqual([
      { blockId: 'A', weekday: 1 },
      { blockId: 'B', weekday: 2 },
      { blockId: 'A', weekday: 4 },
      { blockId: 'B', weekday: 5 },
    ]);
  });

  it('A/B split at frequency 5 gives the extra session to block A', () => {
    const result = computeWeekAssignments(['A', 'B'], 5);
    expect(result.map((r) => r.blockId)).toEqual(['A', 'B', 'A', 'B', 'A']);
    expect(result.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5]);
  });

  it('produces exactly `frequency` assignments for every frequency 2–5', () => {
    for (const f of [2, 3, 4, 5]) {
      for (const blocks of [['A'], ['A', 'B']]) {
        const result = computeWeekAssignments(blocks, f);
        expect(result).toHaveLength(f);
        // Every generated block appears at least once when frequency allows.
        if (f >= blocks.length) {
          expect(new Set(result.map((r) => r.blockId))).toEqual(new Set(blocks));
        }
      }
    }
  });

  it('no blocks → no assignments', () => {
    expect(computeWeekAssignments([], 3)).toEqual([]);
  });
});

describe('toRRuleWeekday', () => {
  it('maps contract weekdays (0=dom) onto rrule indices (0=lun)', () => {
    expect(toRRuleWeekday(1)).toBe(0); // lunes
    expect(toRRuleWeekday(3)).toBe(2); // miércoles
    expect(toRRuleWeekday(5)).toBe(4); // viernes
    expect(toRRuleWeekday(6)).toBe(5); // sábado
    expect(toRRuleWeekday(0)).toBe(6); // domingo
  });
});

describe('groupAssignmentsByBlock', () => {
  it('groups weekdays per block preserving order', () => {
    const grouped = groupAssignmentsByBlock(computeWeekAssignments(['A', 'B'], 4));
    expect(grouped.get('A')).toEqual([1, 4]);
    expect(grouped.get('B')).toEqual([2, 5]);
  });

  it('dedupes repeated weekdays and drops invalid ones', () => {
    const grouped = groupAssignmentsByBlock([
      { blockId: 'A', weekday: 1 },
      { blockId: 'A', weekday: 1 },
      { blockId: 'A', weekday: 9 },
      { blockId: 'A', weekday: -1 },
      { blockId: 'A', weekday: 2.5 },
    ]);
    expect(grouped.get('A')).toEqual([1]);
  });

  it('empty input → empty map', () => {
    expect(groupAssignmentsByBlock([]).size).toBe(0);
  });
});
