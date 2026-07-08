import { describe, expect, it } from 'vitest';
import { journalHeader } from './homeHeader';

// Build a local Date at a given hour so getHours() is deterministic regardless
// of the test machine's timezone.
const atHour = (h: number) => new Date(2026, 5, 13, h, 0, 0); // 2026-06-13, June = month 5

describe('journalHeader', () => {
  it('formats the dateline as DAY · D MON in Spanish', () => {
    expect(journalHeader(atHour(10)).eyebrow).toBe('SÁBADO · 13 JUN');
  });

  it('greets by time of day across the boundaries', () => {
    expect(journalHeader(atHour(3)).greeting).toBe('Buenas noches');
    expect(journalHeader(atHour(6)).greeting).toBe('Buenos días');
    expect(journalHeader(atHour(12)).greeting).toBe('Buenos días');
    expect(journalHeader(atHour(13)).greeting).toBe('Buenas tardes');
    expect(journalHeader(atHour(19)).greeting).toBe('Buenas tardes');
    expect(journalHeader(atHour(20)).greeting).toBe('Buenas noches');
    expect(journalHeader(atHour(23)).greeting).toBe('Buenas noches');
  });
});
