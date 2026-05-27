// src/features/planner/lib/rrule.ts
// Thin wrapper over the `rrule` package. Translates between ISO date strings
// and rrule's Date objects, and supplies a small set of human-readable
// preset rules used by the AssignBlockSheet.

import { RRule, rrulestr, Weekday } from 'rrule';
import type { ISODate } from '../../../types/schedule';

const WEEKDAY_BY_INDEX: Weekday[] = [
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
  RRule.SU,
];

// rrule stores and emits Date objects whose UTC components are the wall-clock
// date. Using local-midnight Dates produces off-by-one bugs for any timezone
// other than UTC. We always convert ISODate ↔ UTC-midnight Date inside this
// module, independent of the project's local-time `dates.ts` helpers.
function isoToUtc(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToIso(d: Date): ISODate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RRuleParseResult {
  ok: true;
  rule: RRule;
}
export interface RRuleParseError {
  ok: false;
  error: string;
}

export function parseRRule(rrule: string): RRuleParseResult | RRuleParseError {
  try {
    const rule = rrulestr(rrule);
    if (!(rule instanceof RRule)) {
      return { ok: false, error: 'RRuleSet not supported in v1' };
    }
    return { ok: true, rule };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Expand a recurring rule into ISO dates within [rangeStart, rangeEnd] inclusive.
 * Pure — no side effects, safe to memoize.
 */
export function expandRule(input: {
  rrule: string;
  startDate: ISODate;
  endDate: ISODate | null;
  rangeStart: ISODate;
  rangeEnd: ISODate;
}): ISODate[] {
  const parsed = parseRRule(input.rrule);
  if (!parsed.ok) return [];

  const dtstart = isoToUtc(input.startDate);
  // rrulestr doesn't always include DTSTART. Force it so the rule is anchored.
  const opts = parsed.rule.origOptions;
  const rule = new RRule({ ...opts, dtstart });

  const lower = isoToUtc(input.rangeStart);
  const upper = isoToUtc(input.rangeEnd);
  // `inc=true` makes both endpoints inclusive when they're exact occurrences.
  const occurrences = rule.between(lower, upper, true);

  // Apply hard endDate cap if set (UNTIL inside the rule already handles it,
  // but our model lets endDate live outside the rule for flexibility).
  const capped = input.endDate
    ? occurrences.filter((d) => utcToIso(d) <= input.endDate!)
    : occurrences;

  return capped.map(utcToIso);
}

// ── Presets ─────────────────────────────────────────────────────────────

export interface RRulePreset {
  id: string;
  label: string;
  build: (anchor: ISODate) => string;
}

export const RRULE_PRESETS: RRulePreset[] = [
  {
    id: 'weekly-anchor',
    label: 'Cada semana, mismo día',
    build: (anchor) => {
      const d = isoToUtc(anchor);
      const wd = WEEKDAY_BY_INDEX[(d.getUTCDay() + 6) % 7]; // JS Sun=0 → Mon=0
      return new RRule({ freq: RRule.WEEKLY, byweekday: [wd] }).toString();
    },
  },
  {
    id: 'weekdays',
    label: 'Lun a Vie',
    build: () =>
      new RRule({
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
      }).toString(),
  },
  {
    id: 'weekends',
    label: 'Fines de semana',
    build: () => new RRule({ freq: RRule.WEEKLY, byweekday: [RRule.SA, RRule.SU] }).toString(),
  },
  {
    id: 'biweekly-mwf',
    label: 'Cada 2 semanas (L/X/V)',
    build: () =>
      new RRule({
        freq: RRule.WEEKLY,
        interval: 2,
        byweekday: [RRule.MO, RRule.WE, RRule.FR],
      }).toString(),
  },
  {
    id: 'first-monday',
    label: '1er lunes del mes',
    build: () =>
      new RRule({
        freq: RRule.MONTHLY,
        byweekday: [RRule.MO.nth(1)],
      }).toString(),
  },
];

/** Build a weekly rule from a set of weekday indices (0 = Mon … 6 = Sun). */
export function buildWeeklyRule(weekdayIndices: number[], interval = 1): string {
  if (weekdayIndices.length === 0) {
    throw new Error('At least one weekday is required');
  }
  const days = weekdayIndices.map((i) => WEEKDAY_BY_INDEX[i]);
  return new RRule({ freq: RRule.WEEKLY, interval, byweekday: days }).toString();
}

/** Human-readable summary of a rule for the recurrence chip. */
export function summarizeRule(rrule: string): string {
  const parsed = parseRRule(rrule);
  if (!parsed.ok) return 'Recurrente';
  try {
    const text = parsed.rule.toText();
    // rrule library outputs English; we use lightweight find-replace for
    // Spanish summarization. Anything we don't translate falls back to the
    // English form, which still reads OK to a Spanish speaker for technical
    // patterns ("every 2 weeks on Monday, Wednesday").
    return capitalize(
      text
        .replace(/^every\s+/i, 'cada ')
        .replace(/\bweek\b/gi, 'semana')
        .replace(/\bweeks\b/gi, 'semanas')
        .replace(/\bmonth\b/gi, 'mes')
        .replace(/\bmonths\b/gi, 'meses')
        .replace(/\bon\s+/gi, '· ')
        .replace(/Monday/gi, 'Lun')
        .replace(/Tuesday/gi, 'Mar')
        .replace(/Wednesday/gi, 'Mié')
        .replace(/Thursday/gi, 'Jue')
        .replace(/Friday/gi, 'Vie')
        .replace(/Saturday/gi, 'Sáb')
        .replace(/Sunday/gi, 'Dom'),
    );
  } catch {
    return 'Recurrente';
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
