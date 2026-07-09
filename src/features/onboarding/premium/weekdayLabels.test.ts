import { describe, expect, it } from 'vitest';
import { weekdayLabelES } from './weekdayLabels';
import { weekdaysForFrequency } from '../../../lib/routines/weekAssignments';

describe('weekdayLabelES', () => {
  it('labels the week 0=domingo … 6=sábado', () => {
    expect(weekdayLabelES(0)).toBe('Dom');
    expect(weekdayLabelES(1)).toBe('Lun');
    expect(weekdayLabelES(3)).toBe('Mié');
    expect(weekdayLabelES(5)).toBe('Vie');
    expect(weekdayLabelES(6)).toBe('Sáb');
  });

  it('wraps out-of-range indices safely', () => {
    expect(weekdayLabelES(7)).toBe('Dom');
    expect(weekdayLabelES(-1)).toBe('Sáb');
    expect(weekdayLabelES(1.4)).toBe('Lun');
  });
});

describe('seeded week ↔ declared days (U-B invariant)', () => {
  it('produces exactly N labelled days for a declared frequency', () => {
    for (let freq = 1; freq <= 7; freq++) {
      const labels = weekdaysForFrequency(freq).map(weekdayLabelES);
      expect(labels).toHaveLength(freq);
      for (const l of labels) expect(l.length).toBeGreaterThan(0);
    }
  });

  it('spreads 3 days as lun/mié/vie', () => {
    expect(weekdaysForFrequency(3).map(weekdayLabelES)).toEqual(['Lun', 'Mié', 'Vie']);
  });
});
