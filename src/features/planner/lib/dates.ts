// src/features/planner/lib/dates.ts
// Thin wrapper around date-fns that locks the project on YYYY-MM-DD ISO date
// strings (no time, no tz). All other date math goes through here so timezone
// behavior stays consistent across the planner.

import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';

import type { ISODate } from '../../../types/schedule';

const ISO = 'yyyy-MM-dd';

export function toISODate(d: Date): ISODate {
  return format(d, ISO);
}

export function fromISODate(s: ISODate): Date {
  // parseISO("2026-05-12") returns a Date at local midnight — exactly what we want.
  return parseISO(s);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function isPast(d: ISODate): boolean {
  return d < todayISO();
}

export function isFuture(d: ISODate): boolean {
  return d > todayISO();
}

export function isToday(d: ISODate): boolean {
  return d === todayISO();
}

/** weekStartsOn: 1 = Monday. Spanish convention. */
export function weekRange(d: ISODate): { start: ISODate; end: ISODate } {
  const dt = fromISODate(d);
  return {
    start: toISODate(startOfWeek(dt, { weekStartsOn: 1 })),
    end: toISODate(endOfWeek(dt, { weekStartsOn: 1 })),
  };
}

/** Returns 7 ISO dates Mon-Sun for the week containing d. */
export function weekDays(d: ISODate): ISODate[] {
  const { start, end } = weekRange(d);
  return eachDayOfInterval({ start: fromISODate(start), end: fromISODate(end) }).map(toISODate);
}

/**
 * Returns 42 ISO dates (6 rows × 7 cols) for the month grid containing d.
 * Includes leading/trailing days from adjacent months so the grid is always
 * rectangular and never jumps height.
 */
export function monthGridDays(d: ISODate): ISODate[] {
  const dt = fromISODate(d);
  const monthStart = startOfMonth(dt);
  const monthEnd = endOfMonth(dt);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd }).map(toISODate);
  // Pad to 42 in case the month fits in 5 rows (rare but possible).
  while (days.length < 42) {
    days.push(toISODate(addDays(fromISODate(days[days.length - 1]), 1)));
  }
  return days.slice(0, 42);
}

export function addDaysISO(d: ISODate, n: number): ISODate {
  return toISODate(addDays(fromISODate(d), n));
}

export function addMonthsISO(d: ISODate, n: number): ISODate {
  return toISODate(addMonths(fromISODate(d), n));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISODate(a), fromISODate(b));
}

export function sameDay(a: ISODate, b: ISODate): boolean {
  return a === b;
}

// ── Display helpers ─────────────────────────────────────────────────────

/** "martes, 12 de mayo" */
export function formatLongDate(d: ISODate): string {
  return format(fromISODate(d), "EEEE, d 'de' MMMM", { locale: es });
}

/** "12 may" */
export function formatShortDate(d: ISODate): string {
  return format(fromISODate(d), 'd MMM', { locale: es });
}

/** "Lun" / "Mar" / ... */
export function formatWeekdayShort(d: ISODate): string {
  return format(fromISODate(d), 'EEE', { locale: es });
}

/** "L" / "M" / ... */
export function formatWeekdayNarrow(d: ISODate): string {
  return format(fromISODate(d), 'EEEEE', { locale: es }).toUpperCase();
}

/** "12" — day of month */
export function formatDayNumber(d: ISODate): string {
  return format(fromISODate(d), 'd');
}

/** "mayo 2026" — month label for grid header */
export function formatMonthYear(d: ISODate): string {
  return format(fromISODate(d), 'MMMM yyyy', { locale: es });
}
