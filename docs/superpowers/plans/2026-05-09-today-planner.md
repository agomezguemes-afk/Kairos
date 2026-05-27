# Today Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `HomeTab` into a Today Planner with selectable calendar (week/month), schedule store supporting one-time + RRULE recurring assignments, 9 DayCard variants, deterministic Kai Signal, and assign/edit sheets — fully connected to existing workout flow.

**Architecture:** Custom calendar UI on top of `date-fns` + `rrule` (RFC 5545). Zustand `scheduleStore` with persist + LRU cache for recurring expansions. Component tree under `src/features/planner/` keeps the planner self-contained. `HomeTab` becomes a thin wrapper. `ActiveWorkoutScreen.endWorkout` calls into `scheduleStore.completeOccurrence` to keep state coherent.

**Tech Stack:** React Native 0.81 + Expo, TypeScript strict, Zustand (persist + AsyncStorage), Reanimated 4.1, Gesture Handler 2.28, `rrule` 2.x, `date-fns` 4.x, design tokens from `src/theme/tokens.ts`.

**Spec:** `docs/superpowers/specs/2026-05-09-today-planner-design.md` — read before starting.

---

## Conventions for this plan

- **No formal Jest setup.** The codebase has none and adding it is out of scope. Pure logic gets a `.dev.ts` smoke runner invoked via `npx tsx`. UI is verified manually on iOS simulator/device.
- **Commits:** atomic per task. Format: `feat(planner): <description>` or `chore(planner): <description>`. Never co-author lines (`MEMORY.md` has a feedback memo on this).
- **Branch:** stay on `feat/canvas`. The user has uncommitted prior work — work alongside it, do not stash.
- **Tokens-only.** No hardcoded colors. Always import from `src/theme/tokens.ts` (v3 keys: `Colors.bg.*`, `Colors.ink.*`, `Colors.gold.*`, `Colors.hair.*`, `Type.*`, `Spacing.*`, `Radius.*`, `Shadows.*`, `Animation.*`).
- **Type safety:** `npx tsc --noEmit` must pass at end of every task.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install rrule and date-fns**

```bash
npm install rrule date-fns --legacy-peer-deps
```

Expected: both packages added to `dependencies`, no peer-dep errors. The `--legacy-peer-deps` flag is required by this project (see CLAUDE.md §7).

- [ ] **Step 2: Verify versions**

```bash
node -e "console.log(require('rrule/package.json').version, require('date-fns/package.json').version)"
```

Expected: `rrule >= 2.7.0`, `date-fns >= 4.0.0`.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(planner): add rrule + date-fns dependencies"
```

---

## Task 2: Schedule types

**Files:**
- Create: `src/types/schedule.ts`

- [ ] **Step 1: Write the file**

```ts
// src/types/schedule.ts
// Schedule data model — discriminated union of one-time and recurring
// assignments, plus the resolved snapshot the DayCard renders.

export type ISODate = string;        // YYYY-MM-DD (no time, no tz)
export type ISOTimestamp = string;   // ISO 8601 with timezone

interface AssignmentBase {
  id: string;
  blockId: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  /** Dates the user marked completed (recurring → one entry per occurrence). */
  completed: ISODate[];
}

export interface OneTimeAssignment extends AssignmentBase {
  kind: 'one-time';
  date: ISODate;
  /** True if user explicitly skipped (vs. deleted). Affects streak/insights. */
  skipped: boolean;
}

export interface RecurringAssignment extends AssignmentBase {
  kind: 'recurring';
  /** RRULE RFC 5545. Example: "FREQ=WEEKLY;BYDAY=MO,WE,FR" */
  rrule: string;
  startDate: ISODate;
  endDate: ISODate | null;
  /** Occurrences the user explicitly skipped. */
  skipped: ISODate[];
  /** Occurrences moved: { ruleProducedDate → newDate }. */
  moved: Record<ISODate, ISODate>;
}

export type ScheduleAssignment = OneTimeAssignment | RecurringAssignment;

export type AssignmentStatus = 'planned' | 'completed' | 'skipped';

/** Resolved snapshot the DayCard consumes. RRULEs already expanded. */
export interface ResolvedAssignment {
  assignmentId: string;
  blockId: string;
  date: ISODate;
  status: AssignmentStatus;
  isRecurring: boolean;
  /** Set when this occurrence was moved here from another date. */
  movedFrom?: ISODate;
}

export type RecentlyDeleted = Array<{
  assignment: ScheduleAssignment;
  deletedAt: number;
}>;
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/types/schedule.ts
git commit -m "feat(planner): schedule types (one-time + recurring + resolved)"
```

---

## Task 3: Date helpers

**Files:**
- Create: `src/features/planner/lib/dates.ts`
- Create: `src/features/planner/lib/dates.dev.ts`

- [ ] **Step 1: Write the dates lib**

```ts
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
  isSameDay,
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
    end:   toISODate(endOfWeek(dt,   { weekStartsOn: 1 })),
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
  const monthEnd   = endOfMonth(dt);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,     { weekStartsOn: 1 });
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
```

- [ ] **Step 2: Write the smoke test**

```ts
// src/features/planner/lib/dates.dev.ts
// Run with: npx tsx src/features/planner/lib/dates.dev.ts
// Exits non-zero on any assertion failure.

import {
  toISODate, fromISODate, todayISO, weekDays, monthGridDays,
  addDaysISO, daysBetween, formatWeekdayNarrow, formatLongDate,
} from './dates';

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) { console.error('FAIL', name); failed++; }
  else console.log('OK', name);
}

const may12 = '2026-05-12';

check('toISODate roundtrip', toISODate(fromISODate(may12)) === may12);
check('addDaysISO +1', addDaysISO(may12, 1) === '2026-05-13');
check('addDaysISO -7', addDaysISO(may12, -7) === '2026-05-05');
check('daysBetween', daysBetween('2026-05-15', may12) === 3);

const wd = weekDays(may12);
check('weekDays length 7', wd.length === 7);
check('weekDays starts Mon', wd[0] === '2026-05-11');  // 12 may 2026 is a Tuesday
check('weekDays ends Sun', wd[6] === '2026-05-17');

const mg = monthGridDays(may12);
check('monthGrid 42 cells', mg.length === 42);
check('monthGrid contains may12', mg.includes(may12));

check('formatWeekdayNarrow', /^[LMXJVSD]$/.test(formatWeekdayNarrow(may12)));
check('formatLongDate spanish', formatLongDate(may12).includes('mayo'));
check('todayISO format', /^\d{4}-\d{2}-\d{2}$/.test(todayISO()));

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all dates checks pass');
```

- [ ] **Step 3: Run smoke test**

```bash
npx tsx src/features/planner/lib/dates.dev.ts
```

Expected: `all dates checks pass`, exit 0.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/lib/dates.ts src/features/planner/lib/dates.dev.ts
git commit -m "feat(planner): date helpers (ISO date strings + es locale)"
```

---

## Task 4: RRULE wrapper

**Files:**
- Create: `src/features/planner/lib/rrule.ts`
- Create: `src/features/planner/lib/rrule.dev.ts`

- [ ] **Step 1: Write the rrule wrapper**

```ts
// src/features/planner/lib/rrule.ts
// Thin wrapper over the `rrule` package. Translates between ISO date strings
// and rrule's Date objects, and supplies a small set of human-readable
// preset rules used by the AssignBlockSheet.

import { RRule, RRuleSet, rrulestr, Weekday } from 'rrule';
import type { ISODate } from '../../../types/schedule';
import { fromISODate, toISODate } from './dates';

const WEEKDAY_BY_INDEX: Weekday[] = [
  RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU,
];

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

  const dtstart = fromISODate(input.startDate);
  // rrulestr doesn't always include DTSTART. Force it so the rule is anchored.
  const opts = parsed.rule.origOptions;
  const rule = new RRule({ ...opts, dtstart });

  const lower = fromISODate(input.rangeStart);
  const upperBase = fromISODate(input.rangeEnd);
  // RRule.between is exclusive on the upper bound; bump by one day so the
  // last day of the range is included.
  const upper = new Date(upperBase.getTime() + 24 * 3600 * 1000);

  const occurrences = rule.between(lower, upper, true);

  // Apply hard endDate cap if set (UNTIL inside the rule already handles it,
  // but our model lets endDate live outside the rule for flexibility).
  const capped = input.endDate
    ? occurrences.filter((d) => toISODate(d) <= input.endDate!)
    : occurrences;

  return capped.map(toISODate);
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
      const d = fromISODate(anchor);
      const wd = WEEKDAY_BY_INDEX[(d.getDay() + 6) % 7]; // JS Sun=0 → Mon=0
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
    build: () =>
      new RRule({ freq: RRule.WEEKLY, byweekday: [RRule.SA, RRule.SU] }).toString(),
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
```

- [ ] **Step 2: Write the smoke test**

```ts
// src/features/planner/lib/rrule.dev.ts
// Run with: npx tsx src/features/planner/lib/rrule.dev.ts

import { expandRule, RRULE_PRESETS, buildWeeklyRule, summarizeRule, parseRRule } from './rrule';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

// MWF for May 2026 — Mon=4,11,18,25; Wed=6,13,20,27; Fri=1,8,15,22,29
const mwf = buildWeeklyRule([0, 2, 4]);  // Mon, Wed, Fri
const occ = expandRule({
  rrule: mwf,
  startDate: '2026-05-01',
  endDate: null,
  rangeStart: '2026-05-01',
  rangeEnd: '2026-05-31',
});
check('MWF May has 13 occurrences', occ.length === 13, occ);
check('MWF May 1 is included', occ.includes('2026-05-01'));
check('MWF May 4 is included', occ.includes('2026-05-04'));
check('MWF May 5 NOT included', !occ.includes('2026-05-05'));

// Endpoint cap
const occCapped = expandRule({
  rrule: mwf,
  startDate: '2026-05-01',
  endDate: '2026-05-15',
  rangeStart: '2026-05-01',
  rangeEnd: '2026-05-31',
});
check('endDate cap works', occCapped.every((d) => d <= '2026-05-15'), occCapped);

// First Monday of month
const firstMon = RRULE_PRESETS.find((p) => p.id === 'first-monday')!.build('2026-05-01');
const fm = expandRule({
  rrule: firstMon,
  startDate: '2026-05-01',
  endDate: null,
  rangeStart: '2026-05-01',
  rangeEnd: '2026-12-31',
});
check('first-monday returns 8 (May–Dec)', fm.length === 8, fm);
check('first-monday May = 04', fm[0] === '2026-05-04');

// Parse error path
const bad = parseRRule('FREQ=NOPE');
check('invalid rrule returns error', bad.ok === false);

// Summary smoke
const sum = summarizeRule(buildWeeklyRule([0, 2, 4]));
check('summary contains Lun', sum.toLowerCase().includes('lun'));

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all rrule checks pass');
```

- [ ] **Step 3: Run smoke test**

```bash
npx tsx src/features/planner/lib/rrule.dev.ts
```

Expected: `all rrule checks pass`, exit 0.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/lib/rrule.ts src/features/planner/lib/rrule.dev.ts
git commit -m "feat(planner): rrule wrapper with presets + Spanish summary"
```

---

## Task 5: Schedule store

**Files:**
- Create: `src/store/scheduleStore.ts`
- Create: `src/store/scheduleStore.dev.ts`

- [ ] **Step 1: Write the store**

```ts
// src/store/scheduleStore.ts
// Persistent schedule store. Keeps assignments (one-time + recurring) and
// resolves them per date / per range. RRULE expansions are memoized in an
// LRU cache that's purged on any mutation.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ScheduleAssignment,
  OneTimeAssignment,
  RecurringAssignment,
  ResolvedAssignment,
  ISODate,
  RecentlyDeleted,
} from '../types/schedule';
import { generateId } from '../types/core';
import { todayISO, daysBetween, addDaysISO } from '../features/planner/lib/dates';
import { expandRule } from '../features/planner/lib/rrule';

// ── LRU cache ───────────────────────────────────────────────────────────

const RANGE_CACHE_SIZE = 12;
type RangeKey = string; // `${start}..${end}`
const rangeCache = new Map<RangeKey, Map<ISODate, ResolvedAssignment[]>>();

function cacheGet(start: ISODate, end: ISODate) {
  const k = `${start}..${end}`;
  const v = rangeCache.get(k);
  if (v) {
    rangeCache.delete(k);
    rangeCache.set(k, v);
  }
  return v;
}

function cacheSet(start: ISODate, end: ISODate, value: Map<ISODate, ResolvedAssignment[]>) {
  const k = `${start}..${end}`;
  rangeCache.set(k, value);
  while (rangeCache.size > RANGE_CACHE_SIZE) {
    const oldest = rangeCache.keys().next().value;
    if (oldest !== undefined) rangeCache.delete(oldest);
  }
}

function purgeCache() {
  rangeCache.clear();
}

// ── Resolver ────────────────────────────────────────────────────────────

function resolveOne(
  a: ScheduleAssignment,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): ResolvedAssignment[] {
  if (a.kind === 'one-time') {
    if (a.date < rangeStart || a.date > rangeEnd) return [];
    const status: ResolvedAssignment['status'] =
      a.completed.includes(a.date) ? 'completed' :
      a.skipped                    ? 'skipped'   : 'planned';
    return [{
      assignmentId: a.id,
      blockId:      a.blockId,
      date:         a.date,
      status,
      isRecurring:  false,
    }];
  }

  // recurring
  const occurrences = expandRule({
    rrule:       a.rrule,
    startDate:   a.startDate,
    endDate:     a.endDate,
    rangeStart,
    rangeEnd,
  });

  const out: ResolvedAssignment[] = [];

  for (const original of occurrences) {
    if (a.skipped.includes(original)) continue;
    const movedTo = a.moved[original];
    const date = movedTo ?? original;
    if (date < rangeStart || date > rangeEnd) continue;

    const status: ResolvedAssignment['status'] = a.completed.includes(date)
      ? 'completed'
      : 'planned';

    out.push({
      assignmentId: a.id,
      blockId:      a.blockId,
      date,
      status,
      isRecurring:  true,
      movedFrom:    movedTo ? original : undefined,
    });
  }

  // Pull moved targets from outside the rule range that landed inside this view.
  for (const [original, movedTo] of Object.entries(a.moved)) {
    if (occurrences.includes(original)) continue; // already handled
    if (movedTo < rangeStart || movedTo > rangeEnd) continue;
    if (a.skipped.includes(original)) continue;

    const status: ResolvedAssignment['status'] = a.completed.includes(movedTo)
      ? 'completed'
      : 'planned';

    out.push({
      assignmentId: a.id,
      blockId:      a.blockId,
      date:         movedTo,
      status,
      isRecurring:  true,
      movedFrom:    original,
    });
  }

  return out;
}

function resolveRangeImpl(
  assignments: ScheduleAssignment[],
  start: ISODate,
  end: ISODate,
): Map<ISODate, ResolvedAssignment[]> {
  const cached = cacheGet(start, end);
  if (cached) return cached;

  const map = new Map<ISODate, ResolvedAssignment[]>();
  for (const a of assignments) {
    for (const r of resolveOne(a, start, end)) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
  }
  cacheSet(start, end, map);
  return map;
}

// ── Store ───────────────────────────────────────────────────────────────

const UNDO_WINDOW_MS = 5_000;

interface ScheduleState {
  assignments: ScheduleAssignment[];
  recentlyDeleted: RecentlyDeleted;

  // Mutations
  assignOnce: (date: ISODate, blockId: string) => string;
  assignRecurring: (input: {
    blockId: string;
    rrule: string;
    startDate: ISODate;
    endDate?: ISODate | null;
  }) => string;
  moveOccurrence: (assignmentId: string, fromDate: ISODate, toDate: ISODate) => void;
  skipOccurrence: (assignmentId: string, date: ISODate) => void;
  unskipOccurrence: (assignmentId: string, date: ISODate) => void;
  changeOccurrenceBlock: (assignmentId: string, date: ISODate, newBlockId: string) => void;
  completeOccurrence: (assignmentId: string, date: ISODate) => void;
  uncompleteOccurrence: (assignmentId: string, date: ISODate) => void;
  truncateSeries: (assignmentId: string, lastValidDate: ISODate) => void;
  removeAssignment: (assignmentId: string) => void;
  undoLastDelete: () => void;
  pruneExpiredDeletions: () => void;

  // Selectors
  resolveDate: (date: ISODate) => ResolvedAssignment[];
  resolveRange: (start: ISODate, end: ISODate) => Map<ISODate, ResolvedAssignment[]>;
  hasAssignment: (date: ISODate) => boolean;
}

function nowISO(): string {
  return new Date().toISOString();
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      assignments: [],
      recentlyDeleted: [],

      assignOnce: (date, blockId) => {
        const id = generateId('assign');
        const a: OneTimeAssignment = {
          id, kind: 'one-time', blockId, date,
          completed: [], skipped: false,
          createdAt: nowISO(), updatedAt: nowISO(),
        };
        set((s) => ({ assignments: [...s.assignments, a] }));
        purgeCache();
        return id;
      },

      assignRecurring: ({ blockId, rrule, startDate, endDate = null }) => {
        const id = generateId('assign');
        const a: RecurringAssignment = {
          id, kind: 'recurring', blockId, rrule, startDate, endDate,
          completed: [], skipped: [], moved: {},
          createdAt: nowISO(), updatedAt: nowISO(),
        };
        set((s) => ({ assignments: [...s.assignments, a] }));
        purgeCache();
        return id;
      },

      moveOccurrence: (assignmentId, fromDate, toDate) => {
        set((s) => ({
          assignments: s.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            if (a.kind === 'one-time') {
              return { ...a, date: toDate, updatedAt: nowISO() };
            }
            return {
              ...a,
              moved: { ...a.moved, [fromDate]: toDate },
              updatedAt: nowISO(),
            };
          }),
        }));
        purgeCache();
      },

      skipOccurrence: (assignmentId, date) => {
        set((s) => ({
          assignments: s.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            if (a.kind === 'one-time') {
              return { ...a, skipped: true, updatedAt: nowISO() };
            }
            if (a.skipped.includes(date)) return a;
            return { ...a, skipped: [...a.skipped, date], updatedAt: nowISO() };
          }),
        }));
        purgeCache();
      },

      unskipOccurrence: (assignmentId, date) => {
        set((s) => ({
          assignments: s.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            if (a.kind === 'one-time') {
              return { ...a, skipped: false, updatedAt: nowISO() };
            }
            return { ...a, skipped: a.skipped.filter((d) => d !== date), updatedAt: nowISO() };
          }),
        }));
        purgeCache();
      },

      changeOccurrenceBlock: (assignmentId, date, newBlockId) => {
        const target = get().assignments.find((a) => a.id === assignmentId);
        if (!target) return;
        if (target.kind === 'one-time') {
          set((s) => ({
            assignments: s.assignments.map((a) =>
              a.id === assignmentId ? { ...a, blockId: newBlockId, updatedAt: nowISO() } : a,
            ),
          }));
          purgeCache();
          return;
        }
        // recurring → mint a one-time replacement + skip the original date
        const oneTime: OneTimeAssignment = {
          id: generateId('assign'),
          kind: 'one-time',
          blockId: newBlockId,
          date,
          completed: [],
          skipped: false,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        set((s) => ({
          assignments: [
            ...s.assignments.map((a) => {
              if (a.id !== assignmentId) return a;
              if (a.kind !== 'recurring') return a;
              if (a.skipped.includes(date)) return a;
              return { ...a, skipped: [...a.skipped, date], updatedAt: nowISO() };
            }),
            oneTime,
          ],
        }));
        purgeCache();
      },

      completeOccurrence: (assignmentId, date) => {
        set((s) => ({
          assignments: s.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            if (a.completed.includes(date)) return a;
            return { ...a, completed: [...a.completed, date], updatedAt: nowISO() };
          }),
        }));
        purgeCache();
      },

      uncompleteOccurrence: (assignmentId, date) => {
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.id !== assignmentId ? a : { ...a, completed: a.completed.filter((d) => d !== date), updatedAt: nowISO() }
          ),
        }));
        purgeCache();
      },

      truncateSeries: (assignmentId, lastValidDate) => {
        set((s) => ({
          assignments: s.assignments.map((a) => {
            if (a.id !== assignmentId) return a;
            if (a.kind !== 'recurring') return a;
            return { ...a, endDate: lastValidDate, updatedAt: nowISO() };
          }),
        }));
        purgeCache();
      },

      removeAssignment: (assignmentId) => {
        const target = get().assignments.find((a) => a.id === assignmentId);
        if (!target) return;
        set((s) => ({
          assignments: s.assignments.filter((a) => a.id !== assignmentId),
          recentlyDeleted: [
            { assignment: target, deletedAt: Date.now() },
            ...s.recentlyDeleted,
          ].slice(0, 10),
        }));
        purgeCache();
      },

      undoLastDelete: () => {
        const [last, ...rest] = get().recentlyDeleted;
        if (!last) return;
        if (Date.now() - last.deletedAt > UNDO_WINDOW_MS) return;
        set((s) => ({
          assignments: [...s.assignments, last.assignment],
          recentlyDeleted: rest,
        }));
        purgeCache();
      },

      pruneExpiredDeletions: () => {
        const now = Date.now();
        set((s) => ({
          recentlyDeleted: s.recentlyDeleted.filter((d) => now - d.deletedAt <= UNDO_WINDOW_MS),
        }));
      },

      resolveDate: (date) => {
        const map = resolveRangeImpl(get().assignments, date, date);
        return map.get(date) ?? [];
      },

      resolveRange: (start, end) => {
        if (daysBetween(end, start) < 0) {
          // swap if caller passed reversed range
          return resolveRangeImpl(get().assignments, end, start);
        }
        return resolveRangeImpl(get().assignments, start, end);
      },

      hasAssignment: (date) => {
        return get().resolveDate(date).length > 0;
      },
    }),
    {
      name: 'kairos-schedule',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ assignments: s.assignments }),
      onRehydrateStorage: () => () => purgeCache(),
    },
  ),
);

/** Helper for components/hooks that derive state in non-React contexts. */
export function getScheduleSnapshot() {
  return useScheduleStore.getState();
}
```

- [ ] **Step 2: Write the smoke test**

```ts
// src/store/scheduleStore.dev.ts
// Run with: npx tsx src/store/scheduleStore.dev.ts

import { useScheduleStore } from './scheduleStore';
import { buildWeeklyRule } from '../features/planner/lib/rrule';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

const s = useScheduleStore.getState();

// Reset state for the test (the dev runner doesn't have AsyncStorage)
useScheduleStore.setState({ assignments: [], recentlyDeleted: [] });

// 1. one-time
const id1 = s.assignOnce('2026-05-12', 'block-a');
check('one-time stored', useScheduleStore.getState().assignments.length === 1);
check('hasAssignment true', useScheduleStore.getState().hasAssignment('2026-05-12'));
check('hasAssignment false', !useScheduleStore.getState().hasAssignment('2026-05-13'));

// 2. recurring MWF
const mwf = buildWeeklyRule([0, 2, 4]);
const id2 = s.assignRecurring({
  blockId: 'block-b',
  rrule: mwf,
  startDate: '2026-05-01',
  endDate: '2026-05-31',
});
const may = useScheduleStore.getState().resolveRange('2026-05-01', '2026-05-31');
check('MWF + one-time produce dates', may.size >= 13);
check('block-a present on may 12', (may.get('2026-05-12') ?? []).some((r) => r.blockId === 'block-a'));

// 3. skip
useScheduleStore.getState().skipOccurrence(id2, '2026-05-04');
const may4 = useScheduleStore.getState().resolveDate('2026-05-04');
check('skip removes occurrence', may4.every((r) => r.assignmentId !== id2));

// 4. move
useScheduleStore.getState().moveOccurrence(id2, '2026-05-06', '2026-05-07');
const may6 = useScheduleStore.getState().resolveDate('2026-05-06');
const may7 = useScheduleStore.getState().resolveDate('2026-05-07');
check('move clears origin', may6.every((r) => r.assignmentId !== id2));
check('move populates target', may7.some((r) => r.assignmentId === id2 && r.movedFrom === '2026-05-06'));

// 5. complete
useScheduleStore.getState().completeOccurrence(id1, '2026-05-12');
const completed = useScheduleStore.getState().resolveDate('2026-05-12');
check('completed status', completed.some((r) => r.assignmentId === id1 && r.status === 'completed'));

// 6. truncate series
useScheduleStore.getState().truncateSeries(id2, '2026-05-15');
const lateMay = useScheduleStore.getState().resolveRange('2026-05-16', '2026-05-31');
const stillRecurring = Array.from(lateMay.values()).flat().filter((r) => r.assignmentId === id2);
check('truncate stops series', stillRecurring.length === 0);

// 7. delete + undo
useScheduleStore.getState().removeAssignment(id1);
check('removed', !useScheduleStore.getState().hasAssignment('2026-05-12'));
useScheduleStore.getState().undoLastDelete();
check('undo restores', useScheduleStore.getState().hasAssignment('2026-05-12'));

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all schedule store checks pass');
```

- [ ] **Step 3: Run smoke test**

```bash
npx tsx src/store/scheduleStore.dev.ts
```

Expected: `all schedule store checks pass`, exit 0.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/store/scheduleStore.ts src/store/scheduleStore.dev.ts
git commit -m "feat(planner): scheduleStore with persist + LRU cache + undo"
```

---

## Task 6: Kai Signal engine

**Files:**
- Create: `src/features/planner/lib/kaiSignal.ts`
- Create: `src/features/planner/lib/kaiSignal.dev.ts`

- [ ] **Step 1: Write the engine**

```ts
// src/features/planner/lib/kaiSignal.ts
// Deterministic insight generator. No network, no IO. Pure function of state.
// The first matching rule wins; if no rule matches, returns null
// (silence > noise).

import type { ResolvedAssignment } from '../../../types/schedule';

export type KaiTone = 'focus' | 'progress' | 'momentum' | 'celebrate';
export type KaiActionKind = 'assign' | 'resume' | 'plan-week' | 'create-block';

export interface KaiSignal {
  /** Stable id per rule so the card doesn't flicker on re-render. */
  id: string;
  tone: KaiTone;
  message: string;
  action?: { label: string; kind: KaiActionKind };
}

export interface KaiInputs {
  selectedDate: string;
  isToday: boolean;
  isPast: boolean;
  resolved: ResolvedAssignment | null;
  streak: number;
  blocksCount: number;
  hasActiveWorkout: boolean;
  /** Last matching session for the resolved block, if any. */
  lastSession: { setCount: number; targetSetCount: number } | null;
}

export function kaiSignal(i: KaiInputs): KaiSignal | null {
  if (i.blocksCount === 0) {
    return {
      id: 'no-blocks',
      tone: 'momentum',
      message: 'Crea tu primer bloque para empezar a planificar.',
      action: { label: 'Crear bloque', kind: 'create-block' },
    };
  }

  if (i.hasActiveWorkout) {
    return {
      id: 'resume',
      tone: 'progress',
      message: 'Tienes una sesión a medias. Reanuda donde la dejaste.',
      action: { label: 'Reanudar', kind: 'resume' },
    };
  }

  if (i.isToday && i.resolved?.status === 'completed') {
    return {
      id: 'done',
      tone: 'celebrate',
      message: 'Sesión completada. Buen ritmo, descansa o estira.',
    };
  }

  if (i.isToday && !i.resolved && i.streak >= 3) {
    return {
      id: 'streak',
      tone: 'momentum',
      message: `Llevas ${i.streak} días. Una sesión corta mantiene la racha.`,
      action: { label: 'Asignar bloque', kind: 'assign' },
    };
  }

  if (i.isToday && !i.resolved) {
    return {
      id: 'no-plan',
      tone: 'momentum',
      message: 'Día sin plan. Programa una sesión para mantener momentum.',
      action: { label: 'Kai planifica', kind: 'plan-week' },
    };
  }

  if (i.isToday && i.resolved && !i.lastSession) {
    return {
      id: 'first-time',
      tone: 'focus',
      message: 'Foco de hoy: completa el bloque sin cambiar accesorios.',
    };
  }

  if (
    i.isToday && i.resolved && i.lastSession &&
    i.lastSession.targetSetCount > 0 &&
    i.lastSession.setCount >= i.lastSession.targetSetCount
  ) {
    return {
      id: 'progress-up',
      tone: 'progress',
      message: 'La última vez cerraste todas las series. Puedes subir ligeramente.',
    };
  }

  if (
    i.isToday && i.resolved && i.lastSession &&
    i.lastSession.targetSetCount > 0 &&
    i.lastSession.setCount < i.lastSession.targetSetCount
  ) {
    const remaining = i.lastSession.targetSetCount - i.lastSession.setCount;
    return {
      id: 'close-block',
      tone: 'focus',
      message: `La última vez quedaste a ${remaining} ${remaining === 1 ? 'serie' : 'series'}. Hoy intenta cerrar el bloque.`,
    };
  }

  return null;
}
```

- [ ] **Step 2: Write the smoke test**

```ts
// src/features/planner/lib/kaiSignal.dev.ts
// Run with: npx tsx src/features/planner/lib/kaiSignal.dev.ts

import { kaiSignal, type KaiInputs } from './kaiSignal';

let failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) { console.error('FAIL', name, extra ?? ''); failed++; }
  else console.log('OK', name);
}

const base: KaiInputs = {
  selectedDate: '2026-05-12',
  isToday: true,
  isPast: false,
  resolved: null,
  streak: 0,
  blocksCount: 5,
  hasActiveWorkout: false,
  lastSession: null,
};

check('no-blocks wins', kaiSignal({ ...base, blocksCount: 0 })?.id === 'no-blocks');
check('resume wins over no-plan', kaiSignal({ ...base, hasActiveWorkout: true })?.id === 'resume');
check('streak prompt', kaiSignal({ ...base, streak: 5 })?.id === 'streak');
check('no-plan default', kaiSignal({ ...base })?.id === 'no-plan');

const planned = { assignmentId: 'a1', blockId: 'b1', date: '2026-05-12', status: 'planned' as const, isRecurring: false };
const completed = { ...planned, status: 'completed' as const };

check('completed today', kaiSignal({ ...base, resolved: completed })?.id === 'done');
check('first-time', kaiSignal({ ...base, resolved: planned, lastSession: null })?.id === 'first-time');
check('progress up', kaiSignal({ ...base, resolved: planned, lastSession: { setCount: 9, targetSetCount: 9 } })?.id === 'progress-up');

const close = kaiSignal({ ...base, resolved: planned, lastSession: { setCount: 7, targetSetCount: 9 } });
check('close-block', close?.id === 'close-block');
check('close-block message includes 2 series', close?.message.includes('2 series') === true);

check('past completed silent', kaiSignal({ ...base, isToday: false, isPast: true, resolved: completed }) === null);
check('future no plan silent', kaiSignal({ ...base, isToday: false }) === null);

if (failed > 0) { console.error(`${failed} failures`); process.exit(1); }
console.log('all kaiSignal checks pass');
```

- [ ] **Step 3: Run smoke test**

```bash
npx tsx src/features/planner/lib/kaiSignal.dev.ts
```

Expected: `all kaiSignal checks pass`, exit 0.

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/lib/kaiSignal.ts src/features/planner/lib/kaiSignal.dev.ts
git commit -m "feat(planner): deterministic Kai Signal engine"
```

---

## Task 7: Momentum & greeting

**Files:**
- Create: `src/features/planner/lib/momentum.ts`

- [ ] **Step 1: Write the file**

```ts
// src/features/planner/lib/momentum.ts
// Greeting and one-line momentum phrase shown in the planner header.
// Pure function of state — no network, no time-of-day chat fluff.

import type { WorkoutHistoryEntry } from '../../../store/workoutStore';
import { todayISO, daysBetween, weekRange } from './dates';

export function getGreeting(name?: string | null): string {
  const h = new Date().getHours();
  const base =
    h < 6  ? 'Buenas noches' :
    h < 13 ? 'Buenos días'   :
    h < 20 ? 'Buenas tardes' :
             'Buenas noches';
  return name && name.trim() ? `${base}, ${name.trim()}` : base;
}

export interface MomentumInputs {
  history: WorkoutHistoryEntry[];
  streak: number;
  blocksCount: number;
}

export function getMomentumPhrase(i: MomentumInputs): string {
  if (i.blocksCount === 0) return 'Empieza creando tu primer bloque.';

  const today = todayISO();
  const { start } = weekRange(today);
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const sessionsThisWeek = i.history.filter((h) => h.startedAt >= startMs).length;

  if (sessionsThisWeek === 0 && i.streak === 0) return 'Empieza la semana con una sesión clara.';
  if (sessionsThisWeek === 0 && i.streak > 0) return `Racha de ${i.streak} días. No la rompas.`;
  if (sessionsThisWeek === 1) return 'Una sesión esta semana. Buen arranque.';
  if (sessionsThisWeek <= 3) return `${sessionsThisWeek} sesiones esta semana.`;
  return `${sessionsThisWeek} sesiones esta semana. Ritmo sólido.`;
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/lib/momentum.ts
git commit -m "feat(planner): greeting + momentum phrase generators"
```

---

## Task 8: Hooks

**Files:**
- Create: `src/features/planner/hooks/useScheduleForDate.ts`
- Create: `src/features/planner/hooks/useScheduleForRange.ts`
- Create: `src/features/planner/hooks/useDayCardState.ts`
- Create: `src/features/planner/hooks/useMomentumPhrase.ts`

- [ ] **Step 1: Write `useScheduleForDate`**

```ts
// src/features/planner/hooks/useScheduleForDate.ts

import { useMemo } from 'react';
import { useScheduleStore } from '../../../store/scheduleStore';
import type { ResolvedAssignment, ISODate } from '../../../types/schedule';

export function useScheduleForDate(date: ISODate): ResolvedAssignment[] {
  // We subscribe to assignments so the memo invalidates when the store changes.
  const assignments = useScheduleStore((s) => s.assignments);
  return useMemo(() => useScheduleStore.getState().resolveDate(date), [assignments, date]);
}
```

- [ ] **Step 2: Write `useScheduleForRange`**

```ts
// src/features/planner/hooks/useScheduleForRange.ts

import { useMemo } from 'react';
import { useScheduleStore } from '../../../store/scheduleStore';
import type { ResolvedAssignment, ISODate } from '../../../types/schedule';

export function useScheduleForRange(start: ISODate, end: ISODate): Map<ISODate, ResolvedAssignment[]> {
  const assignments = useScheduleStore((s) => s.assignments);
  return useMemo(() => useScheduleStore.getState().resolveRange(start, end), [assignments, start, end]);
}
```

- [ ] **Step 3: Write `useDayCardState`**

```ts
// src/features/planner/hooks/useDayCardState.ts
// Computes the DayCard variant for a given date. The single source of truth
// for what the day card should show.

import { useMemo } from 'react';
import { useWorkoutStore } from '../../../store/workoutStore';
import type { WorkoutBlock } from '../../../types/core';
import type { ResolvedAssignment, ISODate } from '../../../types/schedule';
import { todayISO, isPast, isFuture } from '../lib/dates';
import { useScheduleForDate } from './useScheduleForDate';

export type DayCardVariant =
  | 'assigned' | 'in-progress' | 'completed'
  | 'empty'
  | 'future-assigned' | 'future-empty'
  | 'past-skipped' | 'past-empty'
  | 'no-blocks';

export interface DayCardState {
  variant: DayCardVariant;
  date: ISODate;
  resolved: ResolvedAssignment | null;
  block: WorkoutBlock | null;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export function useDayCardState(date: ISODate): DayCardState {
  const blocks        = useWorkoutStore((s) => s.blocks);
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const resolvedAll   = useScheduleForDate(date);

  return useMemo(() => {
    const today = todayISO();
    const _isPast   = isPast(date);
    const _isFuture = isFuture(date);
    const _isToday  = date === today;

    const r = resolvedAll[0] ?? null;
    const block = r ? blocks.find((b) => b.id === r.blockId) ?? null : null;

    const baseInfo = { date, resolved: r, block, isToday: _isToday, isPast: _isPast, isFuture: _isFuture };

    if (blocks.length === 0) return { ...baseInfo, variant: 'no-blocks' };

    if (_isPast) {
      if (!r)                       return { ...baseInfo, variant: 'past-empty' };
      if (r.status === 'completed') return { ...baseInfo, variant: 'completed' };
      return { ...baseInfo, variant: 'past-skipped' };
    }

    if (_isFuture) {
      if (!r) return { ...baseInfo, variant: 'future-empty' };
      return { ...baseInfo, variant: 'future-assigned' };
    }

    // today
    if (!r)                                       return { ...baseInfo, variant: 'empty' };
    if (r.status === 'completed')                 return { ...baseInfo, variant: 'completed' };
    if (activeWorkout && activeWorkout.blockId === r.blockId) {
      return { ...baseInfo, variant: 'in-progress' };
    }
    return { ...baseInfo, variant: 'assigned' };
  }, [date, blocks, activeWorkout, resolvedAll]);
}
```

- [ ] **Step 4: Write `useMomentumPhrase`**

```ts
// src/features/planner/hooks/useMomentumPhrase.ts

import { useMemo } from 'react';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useGamification } from '../../../context/GamificationContext';
import { getMomentumPhrase } from '../lib/momentum';

export function useMomentumPhrase(): string {
  const history = useWorkoutStore((s) => s.workoutHistory);
  const blocks  = useWorkoutStore((s) => s.blocks);
  const { streak } = useGamification();
  return useMemo(
    () => getMomentumPhrase({ history, streak: streak.current, blocksCount: blocks.length }),
    [history, streak.current, blocks.length],
  );
}
```

- [ ] **Step 5: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/hooks
git commit -m "feat(planner): hooks (schedule selectors, day-card state, momentum)"
```

---

## Task 9: PlannerHeader

**Files:**
- Create: `src/features/planner/components/PlannerHeader.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/planner/components/PlannerHeader.tsx
// "Hoy" + fecha + frase de momentum + streak pill (gold).

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import KIcon from '../../../components/icons/KIcon';
import { todayISO, formatLongDate } from '../lib/dates';
import { useMomentumPhrase } from '../hooks/useMomentumPhrase';
import { useGamification } from '../../../context/GamificationContext';

interface Props {
  onStreakPress?: () => void;
}

export default function PlannerHeader({ onStreakPress }: Props) {
  const today = todayISO();
  const phrase = useMomentumPhrase();
  const { streak } = useGamification();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Hoy</Text>
          <Text style={styles.date}>{formatLongDate(today)}</Text>
        </View>
        <Pressable
          onPress={onStreakPress}
          accessibilityRole="button"
          accessibilityLabel={`Racha ${streak.current} días`}
          style={({ pressed }) => [styles.streakPill, pressed && styles.streakPillPressed]}
        >
          <KIcon name="flame" size={12} color={Colors.gold.deep} />
          <Text style={styles.streakText}>{streak.current}</Text>
        </Pressable>
      </View>
      <Text style={styles.phrase}>{phrase}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen.horizontal,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: { flex: 1 },
  title: {
    ...Type.title,
    color: Colors.ink.primary,
  },
  date: {
    ...Type.caption,
    color: Colors.ink.tertiary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  phrase: {
    ...Type.body,
    color: Colors.ink.secondary,
    marginTop: Spacing.md,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.gold.glow,
    borderRadius: Radius.full,
  },
  streakPillPressed: { opacity: 0.7 },
  streakText: {
    ...Type.label,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
});
```

> **Note:** if `KIcon` doesn't expose `flame`, fall back to a Unicode bullet (`•`) inside the pill — verify by running TypeScript first.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

If `KIcon name="flame"` errors, replace `<KIcon name="flame" .../>` with `<Text style={{ fontSize: 11, color: Colors.gold.deep }}>·</Text>` and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/components/PlannerHeader.tsx
git commit -m "feat(planner): PlannerHeader with greeting, date, momentum, streak"
```

---

## Task 10: DayCell + WeekStrip

**Files:**
- Create: `src/features/planner/components/DayCell.tsx`
- Create: `src/features/planner/components/WeekStrip.tsx`

- [ ] **Step 1: Write `DayCell`**

```tsx
// src/features/planner/components/DayCell.tsx
// Single day cell — used inside both WeekStrip and MonthGrid.
// Visual states: today, selected, hasAssignment, isOtherMonth.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Radius } from '../../../theme/tokens';
import { formatDayNumber, formatWeekdayNarrow } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';

interface Props {
  date: ISODate;
  selected: boolean;
  isToday: boolean;
  hasAssignment: boolean;
  isOtherMonth?: boolean;
  showWeekdayLabel?: boolean;
  size?: 'week' | 'month';
  onPress: (date: ISODate) => void;
}

function DayCellInner({
  date, selected, isToday, hasAssignment, isOtherMonth, showWeekdayLabel, size = 'week', onPress,
}: Props) {
  const handle = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress(date);
  };

  const numberColor =
    isOtherMonth   ? Colors.ink.muted    :
    selected       ? Colors.ink.inverse  :
    isToday        ? Colors.gold.base    :
                     Colors.ink.primary;

  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={date}
      style={({ pressed }) => [
        styles.cell,
        size === 'week' ? styles.weekSize : styles.monthSize,
        pressed && styles.pressed,
      ]}
    >
      {showWeekdayLabel && (
        <Text style={[styles.weekday, isOtherMonth && { color: Colors.ink.muted }]}>
          {formatWeekdayNarrow(date)}
        </Text>
      )}
      <View style={[
        styles.numberWrap,
        selected && styles.numberWrapSelected,
        !selected && isToday && styles.numberWrapToday,
      ]}>
        <Text style={[styles.number, { color: numberColor }]}>
          {formatDayNumber(date)}
        </Text>
      </View>
      <View style={styles.dotRow}>
        {hasAssignment && <View style={[
          styles.dot,
          selected && { backgroundColor: Colors.ink.inverse },
        ]} />}
      </View>
    </Pressable>
  );
}

export default React.memo(DayCellInner);

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  weekSize:  { minHeight: 56, paddingHorizontal: 4 },
  monthSize: { minHeight: 44, paddingHorizontal: 2 },
  pressed: { opacity: 0.7 },
  weekday: {
    ...Type.label,
    color: Colors.ink.tertiary,
    marginBottom: 4,
  },
  numberWrap: {
    width: 32, height: 32,
    borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  numberWrapSelected: {
    backgroundColor: Colors.gold.base,
  },
  numberWrapToday: {
    borderWidth: 1.5,
    borderColor: Colors.gold.base,
  },
  number: {
    ...Type.body,
    fontWeight: '500',
  },
  dotRow: {
    height: 6, marginTop: 3,
    flexDirection: 'row', justifyContent: 'center',
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.gold.base,
  },
});
```

- [ ] **Step 2: Write `WeekStrip`**

```tsx
// src/features/planner/components/WeekStrip.tsx
// Horizontal 7-day strip. Used as the compact calendar view.

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '../../../theme/tokens';
import DayCell from './DayCell';
import { weekDays, todayISO } from '../lib/dates';
import { useScheduleForRange } from '../hooks/useScheduleForRange';
import type { ISODate } from '../../../types/schedule';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function WeekStrip({ selectedDate, onSelect }: Props) {
  const days = useMemo(() => weekDays(selectedDate), [selectedDate]);
  const today = todayISO();
  const range = useScheduleForRange(days[0], days[6]);

  return (
    <View style={styles.row}>
      {days.map((d) => (
        <View key={d} style={styles.cell}>
          <DayCell
            date={d}
            selected={d === selectedDate}
            isToday={d === today}
            hasAssignment={(range.get(d) ?? []).length > 0}
            showWeekdayLabel
            size="week"
            onPress={onSelect}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen.horizontal,
  },
  cell: { flex: 1 },
});
```

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/DayCell.tsx src/features/planner/components/WeekStrip.tsx
git commit -m "feat(planner): DayCell + WeekStrip"
```

---

## Task 11: MonthGrid

**Files:**
- Create: `src/features/planner/components/MonthGrid.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/planner/components/MonthGrid.tsx
// 6×7 month grid. Header shows month label + arrow nav.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import DayCell from './DayCell';
import {
  monthGridDays, formatMonthYear, addMonthsISO, todayISO, fromISODate,
} from '../lib/dates';
import { useScheduleForRange } from '../hooks/useScheduleForRange';
import type { ISODate } from '../../../types/schedule';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function MonthGrid({ selectedDate, onSelect }: Props) {
  const [anchor, setAnchor] = useState<ISODate>(selectedDate);
  const today = todayISO();

  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const range = useScheduleForRange(days[0], days[days.length - 1]);
  const focusedMonth = fromISODate(anchor).getMonth();

  const goPrev = () => { Haptics.selectionAsync().catch(() => {}); setAnchor(addMonthsISO(anchor, -1)); };
  const goNext = () => { Haptics.selectionAsync().catch(() => {}); setAnchor(addMonthsISO(anchor, 1));  };

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={goPrev} accessibilityLabel="Mes anterior" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthYear(anchor)}</Text>
        <Pressable onPress={goNext} accessibilityLabel="Mes siguiente" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayHeader}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((w) => (
          <Text key={w} style={styles.weekdayHeaderText}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((d) => (
          <View key={d} style={styles.cell}>
            <DayCell
              date={d}
              selected={d === selectedDate}
              isToday={d === today}
              hasAssignment={(range.get(d) ?? []).length > 0}
              isOtherMonth={fromISODate(d).getMonth() !== focusedMonth}
              size="month"
              onPress={onSelect}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.sm,
  },
  arrow: {
    fontSize: 24,
    color: Colors.ink.secondary,
    paddingHorizontal: Spacing.sm,
  },
  monthLabel: {
    ...Type.bodyEmphasis,
    color: Colors.ink.primary,
    textTransform: 'capitalize',
  },
  weekdayHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen.horizontal,
    paddingBottom: Spacing.xs,
  },
  weekdayHeaderText: {
    flex: 1,
    textAlign: 'center',
    ...Type.label,
    color: Colors.ink.tertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.screen.horizontal,
  },
  cell: {
    width: `${100 / 7}%`,
    paddingVertical: 2,
  },
});
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/MonthGrid.tsx
git commit -m "feat(planner): MonthGrid (6×7 with arrow nav)"
```

> If `Type.bodyEmphasis` doesn't exist in tokens, fall back to `Type.body` and add `fontWeight: '600'` inline. Verify the keys via `grep "export const Type" -A 80 src/theme/tokens.ts`.

---

## Task 12: CalendarView (toggle)

**Files:**
- Create: `src/features/planner/components/CalendarView.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/planner/components/CalendarView.tsx
// View toggle [Semana | Mes] with animated layout transition.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import WeekStrip from './WeekStrip';
import MonthGrid from './MonthGrid';
import type { ISODate } from '../../../types/schedule';

type Mode = 'week' | 'month';

interface Props {
  selectedDate: ISODate;
  onSelect: (d: ISODate) => void;
}

export default function CalendarView({ selectedDate, onSelect }: Props) {
  const [mode, setMode] = useState<Mode>('week');

  const switchTo = (m: Mode) => {
    if (m === mode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode(m);
  };

  return (
    <Animated.View layout={LinearTransition.duration(280)}>
      <View style={styles.toggle}>
        <Pressable
          onPress={() => switchTo('week')}
          accessibilityRole="button"
          style={[styles.tab, mode === 'week' && styles.tabActive]}
        >
          <Text style={[styles.tabText, mode === 'week' && styles.tabTextActive]}>Semana</Text>
        </Pressable>
        <Pressable
          onPress={() => switchTo('month')}
          accessibilityRole="button"
          style={[styles.tab, mode === 'month' && styles.tabActive]}
        >
          <Text style={[styles.tabText, mode === 'month' && styles.tabTextActive]}>Mes</Text>
        </Pressable>
      </View>

      {mode === 'week' ? (
        <WeekStrip selectedDate={selectedDate} onSelect={onSelect} />
      ) : (
        <MonthGrid selectedDate={selectedDate} onSelect={onSelect} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: Colors.bg.elevated,
    borderRadius: Radius.full,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  tabActive: {
    backgroundColor: Colors.bg.surface,
  },
  tabText: {
    ...Type.label,
    color: Colors.ink.tertiary,
  },
  tabTextActive: {
    color: Colors.ink.primary,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/CalendarView.tsx
git commit -m "feat(planner): CalendarView with animated week/month toggle"
```

---

## Task 13: BlockPreview, RecurrenceChip, KaiSignal component

**Files:**
- Create: `src/features/planner/components/BlockPreview.tsx`
- Create: `src/features/planner/components/RecurrenceChip.tsx`
- Create: `src/features/planner/components/KaiSignal.tsx`

- [ ] **Step 1: Write `BlockPreview`**

```tsx
// src/features/planner/components/BlockPreview.tsx
// Compact list of up to 4 exercises + "+N más" overflow line.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Type, Spacing } from '../../../theme/tokens';
import KIcon from '../../../components/icons/KIcon';
import type { WorkoutBlock } from '../../../types/core';
import { getBlockExercises } from '../../../types/core';

interface Props {
  block: WorkoutBlock;
  onSeeFull?: () => void;
  maxItems?: number;
}

export default function BlockPreview({ block, onSeeFull, maxItems = 4 }: Props) {
  const exercises = getBlockExercises(block);
  const visible = exercises.slice(0, maxItems);
  const overflow = exercises.length - visible.length;

  return (
    <View style={styles.container}>
      {visible.map((ex) => (
        <View key={ex.id} style={styles.row}>
          <KIcon name="dumbbell" size={14} color={Colors.ink.tertiary} />
          <Text style={styles.name} numberOfLines={1}>{ex.name}</Text>
        </View>
      ))}
      {overflow > 0 && (
        <Text style={styles.overflow}>+ {overflow} {overflow === 1 ? 'más' : 'más'}</Text>
      )}
      {onSeeFull && (
        <Pressable onPress={onSeeFull} style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={styles.fullLink}>Ver bloque completo →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, marginTop: Spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  name: {
    ...Type.bodySm,
    color: Colors.ink.secondary,
    flex: 1,
  },
  overflow: {
    ...Type.label,
    color: Colors.gold.deep,
    marginTop: 2,
  },
  fullLink: {
    ...Type.label,
    color: Colors.gold.deep,
    marginTop: Spacing.sm,
  },
});
```

> If `KIcon` lacks `dumbbell`, drop the icon column and just show the name. If `Type.bodySm` doesn't exist, use `{ fontSize: 13, lineHeight: 18 }`.

- [ ] **Step 2: Write `RecurrenceChip`**

```tsx
// src/features/planner/components/RecurrenceChip.tsx

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import { summarizeRule } from '../lib/rrule';

interface Props {
  rrule: string;
  onPress: () => void;
}

export default function RecurrenceChip({ rrule, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Editar serie"
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.text}>↻  {summarizeRule(rrule)}  ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  text: {
    ...Type.label,
    color: Colors.gold.deep,
    fontWeight: '500',
  },
});
```

- [ ] **Step 3: Write `KaiSignal` component**

```tsx
// src/features/planner/components/KaiSignal.tsx

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius } from '../../../theme/tokens';
import type { KaiSignal as KaiSignalType, KaiTone } from '../lib/kaiSignal';

interface Props {
  signal: KaiSignalType | null;
  onAction?: (kind: KaiSignalType['action']) => void;
}

const TONE_COLOR: Record<KaiTone, string> = {
  focus:     Colors.gold.deep,
  progress:  Colors.semantic.success,
  momentum:  Colors.gold.base,
  celebrate: Colors.gold.base,
};

export default function KaiSignal({ signal, onAction }: Props) {
  if (!signal) return null;

  const handleAction = () => {
    if (!signal.action) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAction?.(signal.action);
  };

  return (
    <Animated.View
      key={signal.id}
      entering={FadeIn.duration(220)}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: TONE_COLOR[signal.tone] }]} />
        <View style={styles.body}>
          <Text style={styles.label}>KAI</Text>
          <Text style={styles.message}>{signal.message}</Text>
        </View>
        {signal.action && (
          <Pressable onPress={handleAction} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
            <Text style={styles.actionText}>{signal.action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.warm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  body: { flex: 1 },
  label: {
    ...Type.label,
    color: Colors.gold.deep,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  message: {
    ...Type.bodySm,
    color: Colors.ink.secondary,
    marginTop: 2,
  },
  action: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  actionText: {
    ...Type.label,
    color: Colors.gold.deep,
    fontWeight: '600',
  },
});
```

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/BlockPreview.tsx src/features/planner/components/RecurrenceChip.tsx src/features/planner/components/KaiSignal.tsx
git commit -m "feat(planner): BlockPreview + RecurrenceChip + KaiSignal cards"
```

---

## Task 14: DayCard dispatcher + variants

**Files:**
- Create: `src/features/planner/components/DayCard.tsx`
- Create: `src/features/planner/components/DayCardShared.tsx`

- [ ] **Step 1: Write the shared shell**

```tsx
// src/features/planner/components/DayCardShared.tsx
// Common card chrome used by every variant. Variants only fill the inside.

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius, Shadows } from '../../../theme/tokens';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

export function CardShell({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.screen.horizontal,
    marginTop: Spacing.lg,
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadows.card,
  },
});
```

- [ ] **Step 2: Write the dispatcher with all 9 variants inline**

> Variants are small and share styles, so colocate them in `DayCard.tsx` rather than creating 9 files.

```tsx
// src/features/planner/components/DayCard.tsx
// Variant dispatcher + inline implementations. Each variant is a small
// pure component sharing the CardShell.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { CardShell } from './DayCardShared';
import BlockPreview from './BlockPreview';
import RecurrenceChip from './RecurrenceChip';
import { useDayCardState, type DayCardState } from '../hooks/useDayCardState';
import { useScheduleStore } from '../../../store/scheduleStore';
import { useWorkoutStore } from '../../../store/workoutStore';
import {
  calculateBlockStats, DISCIPLINE_CONFIGS, type WorkoutBlock,
} from '../../../types/core';
import { daysBetween, todayISO, formatLongDate } from '../lib/dates';
import type { ISODate } from '../../../types/schedule';

interface Props {
  date: ISODate;
  onAssign:        (date: ISODate) => void;
  onStart:         (block: WorkoutBlock) => void;
  onResume:        (block: WorkoutBlock) => void;
  onChangeBlock:   (assignmentId: string, date: ISODate) => void;
  onMove:          (assignmentId: string, fromDate: ISODate) => void;
  onEditSeries:    (assignmentId: string) => void;
  onCreateBlock:   () => void;
  onSeeBlockFull:  (block: WorkoutBlock) => void;
  onPlanWeek:      () => void;
  onSeeSummary?:   (date: ISODate) => void;
}

export default function DayCard(props: Props) {
  const state = useDayCardState(props.date);

  return (
    <Animated.View layout={Layout.springify().damping(18)}>
      <Variant {...props} state={state} />
    </Animated.View>
  );
}

function Variant(props: Props & { state: DayCardState }) {
  const { state, ...handlers } = props;
  switch (state.variant) {
    case 'no-blocks':       return <VariantNoBlocks   onCreateBlock={handlers.onCreateBlock} />;
    case 'empty':           return <VariantEmptyToday {...handlers} />;
    case 'assigned':        return <VariantAssigned   state={state} {...handlers} />;
    case 'in-progress':     return <VariantInProgress state={state} {...handlers} />;
    case 'completed':       return <VariantCompleted  state={state} {...handlers} />;
    case 'future-assigned': return <VariantFuture     state={state} {...handlers} />;
    case 'future-empty':    return <VariantFutureEmpty {...handlers} state={state} />;
    case 'past-skipped':    return <VariantPastSkipped state={state} {...handlers} />;
    case 'past-empty':      return <VariantPastEmpty   state={state} />;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function metaLine(block: WorkoutBlock): string {
  const stats = calculateBlockStats(block);
  const disc = DISCIPLINE_CONFIGS[block.discipline]?.label ?? block.discipline;
  const dur = block.estimated_duration_min ? `${block.estimated_duration_min}m · ` : '';
  return `${disc} · ${dur}${stats.exerciseCount} ej · ${stats.setCount} sets`;
}

function HeroSerif({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.hero, color && { color }]} numberOfLines={2}>{children}</Text>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <Text style={styles.meta} numberOfLines={1}>{children}</Text>;
}

function PrimaryCTA({ label, onPress, ghost = false, accessibilityLabel }: {
  label: string; onPress: () => void; ghost?: boolean; accessibilityLabel?: string;
}) {
  const handle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };
  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        ghost ? styles.ctaGhost : styles.cta,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={ghost ? styles.ctaGhostText : styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

function GhostLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Text style={styles.ghostLink}>{label}</Text>
    </Pressable>
  );
}

function SecondaryRow({ items }: { items: Array<{ label: string; onPress: () => void }> }) {
  return (
    <View style={styles.secondaryRow}>
      {items.map((it, idx) => (
        <React.Fragment key={it.label}>
          <Pressable onPress={it.onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={styles.secondaryText}>{it.label}</Text>
          </Pressable>
          {idx < items.length - 1 && <Text style={styles.secondaryDot}> · </Text>}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Variants ────────────────────────────────────────────────────────────

function VariantNoBlocks({ onCreateBlock }: { onCreateBlock: () => void }) {
  return (
    <CardShell>
      <HeroSerif>Tu primer bloque</HeroSerif>
      <Meta>Define una rutina y empieza a planificar.</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Crear bloque" onPress={onCreateBlock} />
      </View>
    </CardShell>
  );
}

function VariantEmptyToday(props: Props) {
  const blocksCount = useWorkoutStore((s) => s.blocks.length);
  return (
    <CardShell>
      <HeroSerif>Día sin plan</HeroSerif>
      <Meta>{`Tienes ${blocksCount} ${blocksCount === 1 ? 'bloque listo' : 'bloques listos'}.`}</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Asignar bloque" onPress={() => props.onAssign(props.date)} />
      </View>
      <View style={styles.linkRow}>
        <GhostLink label="Kai, planifica mi semana" onPress={props.onPlanWeek} />
      </View>
    </CardShell>
  );
}

function VariantAssigned({ state, ...h }: Props & { state: DayCardState }) {
  const skip = useScheduleStore((s) => s.skipOccurrence);
  if (!state.block || !state.resolved) return null;
  return (
    <CardShell>
      <HeroSerif>{state.block.name}</HeroSerif>
      <Meta>{metaLine(state.block)}</Meta>
      {state.resolved.isRecurring && state.block && (
        <RecurrenceChipForAssignment assignmentId={state.resolved.assignmentId} onPress={() => h.onEditSeries(state.resolved!.assignmentId)} />
      )}
      <BlockPreview block={state.block} onSeeFull={() => h.onSeeBlockFull(state.block!)} />
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Empezar" onPress={() => h.onStart(state.block!)} />
      </View>
      <SecondaryRow items={[
        { label: 'Mover',   onPress: () => h.onMove(state.resolved!.assignmentId, state.date) },
        { label: 'Saltar',  onPress: () => skip(state.resolved!.assignmentId, state.date) },
        { label: 'Cambiar', onPress: () => h.onChangeBlock(state.resolved!.assignmentId, state.date) },
      ]}/>
    </CardShell>
  );
}

function VariantInProgress({ state, ...h }: Props & { state: DayCardState }) {
  const active = useWorkoutStore((s) => s.activeWorkout);
  if (!state.block || !state.resolved || !active) return null;
  const totalSets = state.block.exercises?.reduce((acc, e) => acc + (e.sets?.length ?? 0), 0) ?? 0;
  const doneSets = active.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length, 0,
  );
  return (
    <CardShell>
      <HeroSerif>{state.block.name}</HeroSerif>
      <Meta>{`${doneSets}/${totalSets} sets hechos`}</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Reanudar" onPress={() => h.onResume(state.block!)} />
      </View>
    </CardShell>
  );
}

function VariantCompleted({ state, ...h }: Props & { state: DayCardState }) {
  if (!state.block || !state.resolved) return null;
  return (
    <CardShell>
      <Text style={styles.heroSecondary}>✓  {state.block.name}</Text>
      <Meta>Sesión completada</Meta>
      {h.onSeeSummary && (
        <View style={styles.linkRow}>
          <GhostLink label="Ver resumen" onPress={() => h.onSeeSummary?.(state.date)} />
        </View>
      )}
    </CardShell>
  );
}

function VariantFuture({ state, ...h }: Props & { state: DayCardState }) {
  const skip = useScheduleStore((s) => s.skipOccurrence);
  if (!state.block || !state.resolved) return null;
  const inDays = daysBetween(state.date, todayISO());
  const disc = DISCIPLINE_CONFIGS[state.block.discipline]?.label ?? state.block.discipline;
  return (
    <CardShell>
      <HeroSerif>{state.block.name}</HeroSerif>
      <Meta>{`En ${inDays} ${inDays === 1 ? 'día' : 'días'} · ${disc}`}</Meta>
      {state.resolved.isRecurring && (
        <RecurrenceChipForAssignment assignmentId={state.resolved.assignmentId} onPress={() => h.onEditSeries(state.resolved!.assignmentId)} />
      )}
      <BlockPreview block={state.block} onSeeFull={() => h.onSeeBlockFull(state.block!)} />
      <View style={styles.ctaWrap}>
        <Text style={styles.programmedLabel}>Programado</Text>
      </View>
      <SecondaryRow items={[
        { label: 'Mover',   onPress: () => h.onMove(state.resolved!.assignmentId, state.date) },
        { label: 'Saltar',  onPress: () => skip(state.resolved!.assignmentId, state.date) },
        { label: 'Cambiar', onPress: () => h.onChangeBlock(state.resolved!.assignmentId, state.date) },
      ]}/>
    </CardShell>
  );
}

function VariantFutureEmpty({ state, onAssign }: Props & { state: DayCardState }) {
  return (
    <CardShell>
      <Text style={styles.heroSmall}>Sin plan</Text>
      <Meta>{formatLongDate(state.date)}</Meta>
      <View style={styles.ctaWrap}>
        <PrimaryCTA label="Asignar bloque" onPress={() => onAssign(state.date)} ghost />
      </View>
    </CardShell>
  );
}

function VariantPastSkipped({ state, ...h }: Props & { state: DayCardState }) {
  if (!state.block) return null;
  return (
    <CardShell>
      <Text style={styles.heroMuted}>{state.block.name}</Text>
      <Meta>{`Saltado · ${formatLongDate(state.date)}`}</Meta>
      <View style={styles.linkRow}>
        <GhostLink label="Reasignar a hoy" onPress={() => h.onAssign(todayISO())} />
      </View>
    </CardShell>
  );
}

function VariantPastEmpty({ state }: { state: DayCardState }) {
  return (
    <CardShell>
      <Text style={styles.heroMutedSmall}>Sin plan</Text>
      <Text style={styles.metaMuted}>{formatLongDate(state.date)}</Text>
    </CardShell>
  );
}

// Local helper that pulls rrule from the store for the chip.
function RecurrenceChipForAssignment({ assignmentId, onPress }: { assignmentId: string; onPress: () => void }) {
  const assignment = useScheduleStore((s) => s.assignments.find((a) => a.id === assignmentId));
  if (!assignment || assignment.kind !== 'recurring') return null;
  return <RecurrenceChip rrule={assignment.rrule} onPress={onPress} />;
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hero: {
    ...Type.title,
    fontSize: 22,
    color: Colors.ink.primary,
  },
  heroSecondary: {
    ...Type.title,
    fontSize: 20,
    color: Colors.ink.tertiary,
  },
  heroSmall: {
    ...Type.bodyEmphasis,
    fontSize: 18,
    color: Colors.ink.tertiary,
  },
  heroMuted: {
    ...Type.bodyEmphasis,
    fontSize: 18,
    color: Colors.ink.muted,
  },
  heroMutedSmall: {
    ...Type.body,
    fontSize: 16,
    color: Colors.ink.muted,
  },
  meta: {
    ...Type.bodySm,
    color: Colors.ink.tertiary,
    marginTop: 4,
  },
  metaMuted: {
    ...Type.bodySm,
    color: Colors.ink.muted,
    marginTop: 4,
  },
  ctaWrap: {
    marginTop: Spacing.lg,
  },
  cta: {
    backgroundColor: Colors.gold.base,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  ctaText: {
    ...Type.bodyEmphasis,
    color: Colors.ink.inverse,
  },
  ctaGhost: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaGhostText: {
    ...Type.bodyEmphasis,
    color: Colors.gold.deep,
  },
  ghostLink: {
    ...Type.label,
    color: Colors.gold.deep,
    paddingVertical: 6,
  },
  programmedLabel: {
    ...Type.bodyEmphasis,
    color: Colors.gold.deep,
    textAlign: 'center',
    paddingVertical: 12,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  secondaryText: {
    ...Type.label,
    color: Colors.ink.tertiary,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  secondaryDot: {
    ...Type.label,
    color: Colors.ink.muted,
  },
  linkRow: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
});
```

> **Type fallbacks:** if `Type.bodyEmphasis` or `Type.bodySm` don't exist, replace with inline style: `{ fontSize: 14, fontWeight: '600' }` for emphasis, `{ fontSize: 13, lineHeight: 18 }` for sm. Run `grep -A 80 "export const Type" src/theme/tokens.ts` to verify before substituting.
> **DISCIPLINE_CONFIGS / calculateBlockStats / WorkoutBlock.exercises:** verify exact API in `src/types/core.ts` — adjust property access if needed. The plan assumes `calculateBlockStats(block) → { exerciseCount, setCount, totalVolume }` and `block.exercises` returns the array via `getBlockExercises`.

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/DayCard.tsx src/features/planner/components/DayCardShared.tsx
git commit -m "feat(planner): DayCard dispatcher + 9 variants"
```

---

## Task 15: AssignBlockSheet

**Files:**
- Create: `src/features/planner/components/AssignBlockSheet.tsx`

This is the bottom sheet for picking a block + frequency + pattern + range. Reuses Reanimated for the slide-in.

- [ ] **Step 1: Write the sheet**

```tsx
// src/features/planner/components/AssignBlockSheet.tsx
// Bottom sheet with 4 linear steps: pick block → frequency → pattern → range.

import React, { useMemo, useState, useCallback } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, ScrollView, FlatList, TextInput,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useScheduleStore } from '../../../store/scheduleStore';
import {
  RRULE_PRESETS, buildWeeklyRule, parseRRule, summarizeRule,
} from '../lib/rrule';
import { todayISO, addMonthsISO, monthGridDays, formatLongDate, formatMonthYear, addDaysISO, fromISODate } from '../lib/dates';
import DayCell from './DayCell';
import type { ISODate } from '../../../types/schedule';
import type { WorkoutBlock } from '../../../types/core';
import { DISCIPLINE_CONFIGS } from '../../../types/core';

type Frequency = 'once' | 'weekly' | 'advanced';

interface Props {
  visible: boolean;
  initialDate?: ISODate;
  onClose: () => void;
}

export default function AssignBlockSheet({ visible, initialDate, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const blocks = useWorkoutStore((s) => s.blocks.filter((b) => !b.is_archived && !b.parentBlockId));
  const assignOnce = useScheduleStore((s) => s.assignOnce);
  const assignRecurring = useScheduleStore((s) => s.assignRecurring);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [pickedBlockId, setPickedBlockId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [pickedDate, setPickedDate] = useState<ISODate>(initialDate ?? todayISO());
  const [pickedWeekdays, setPickedWeekdays] = useState<number[]>(() => {
    const idx = (fromISODate(initialDate ?? todayISO()).getDay() + 6) % 7;
    return [idx];
  });
  const [advancedRRule, setAdvancedRRule] = useState<string>('');
  const [endMode, setEndMode] = useState<'never' | 'until' | 'count'>('never');
  const [endDate, setEndDate] = useState<ISODate>(addDaysISO(initialDate ?? todayISO(), 90));
  const [count, setCount] = useState<string>('10');

  const reset = useCallback(() => {
    setStep(1); setPickedBlockId(null); setFrequency('once');
    setPickedDate(initialDate ?? todayISO()); setAdvancedRRule(''); setEndMode('never');
  }, [initialDate]);

  const close = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const next = (s: typeof step) => { Haptics.selectionAsync().catch(() => {}); setStep(s); };

  const finalRRule = useMemo<string | null>(() => {
    if (frequency === 'once') return null;
    if (frequency === 'weekly' && pickedWeekdays.length > 0) {
      try { return buildWeeklyRule(pickedWeekdays); } catch { return null; }
    }
    if (frequency === 'advanced') {
      const parsed = parseRRule(advancedRRule);
      return parsed.ok ? advancedRRule : null;
    }
    return null;
  }, [frequency, pickedWeekdays, advancedRRule]);

  const confirm = () => {
    if (!pickedBlockId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (frequency === 'once') {
      assignOnce(pickedDate, pickedBlockId);
    } else if (finalRRule) {
      const rule = endMode === 'count' && Number(count) > 0
        ? `${finalRRule};COUNT=${Math.max(1, Math.floor(Number(count)))}`
        : finalRRule;
      assignRecurring({
        blockId: pickedBlockId,
        rrule: rule,
        startDate: pickedDate,
        endDate: endMode === 'until' ? endDate : null,
      });
    }
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            {step > 1 && (
              <Pressable onPress={() => setStep((s) => (s > 1 ? ((s - 1) as typeof step) : s))} hitSlop={12}>
                <Text style={styles.backArrow}>‹</Text>
              </Pressable>
            )}
            <Text style={styles.stepTitle}>
              {step === 1 && 'Elige un bloque'}
              {step === 2 && '¿Cuándo?'}
              {step === 3 && (frequency === 'once' ? 'Elige la fecha' : frequency === 'weekly' ? 'Días de la semana' : 'Regla avanzada')}
              {step === 4 && 'Hasta cuándo'}
              {step === 5 && 'Confirmar'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.content}>
            {step === 1 && (
              <FlatList
                data={blocks}
                keyExtractor={(b) => b.id}
                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                ListEmptyComponent={() => (
                  <Text style={styles.emptyHint}>Crea un bloque primero desde la pestaña Bloques.</Text>
                )}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { setPickedBlockId(item.id); next(2); }}
                    style={({ pressed }) => [styles.blockRow, pressed && { opacity: 0.7 }]}
                  >
                    <View style={[styles.blockSwatch, { backgroundColor: item.color ?? Colors.gold.glow }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockName}>{item.name}</Text>
                      <Text style={styles.blockMeta}>{DISCIPLINE_CONFIGS[item.discipline]?.label ?? item.discipline}</Text>
                    </View>
                  </Pressable>
                )}
              />
            )}

            {step === 2 && (
              <View style={{ gap: Spacing.md }}>
                <FrequencyPill label="Una vez"        active={frequency === 'once'}     onPress={() => { setFrequency('once');     next(3); }}/>
                <FrequencyPill label="Cada semana"    active={frequency === 'weekly'}   onPress={() => { setFrequency('weekly');   next(3); }}/>
                <FrequencyPill label="Avanzado"       active={frequency === 'advanced'} onPress={() => { setFrequency('advanced'); next(3); }}/>
              </View>
            )}

            {step === 3 && frequency === 'once' && (
              <InlineMonthPicker value={pickedDate} onChange={setPickedDate} />
            )}

            {step === 3 && frequency === 'weekly' && (
              <WeekdayPicker value={pickedWeekdays} onChange={setPickedWeekdays} />
            )}

            {step === 3 && frequency === 'advanced' && (
              <View style={{ gap: Spacing.md }}>
                <Text style={styles.help}>RRULE (RFC 5545). Empieza con un preset y edítalo.</Text>
                {RRULE_PRESETS.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setAdvancedRRule(p.build(pickedDate))}
                    style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.presetLabel}>{p.label}</Text>
                  </Pressable>
                ))}
                <TextInput
                  multiline
                  value={advancedRRule}
                  onChangeText={setAdvancedRRule}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                  style={styles.rruleInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {advancedRRule.length > 0 && (
                  parseRRule(advancedRRule).ok
                    ? <Text style={styles.rruleSummary}>{summarizeRule(advancedRRule)}</Text>
                    : <Text style={styles.rruleError}>Regla no válida</Text>
                )}
              </View>
            )}

            {step === 4 && (
              <View style={{ gap: Spacing.md }}>
                <FrequencyPill label="Sin fin"            active={endMode === 'never'} onPress={() => setEndMode('never')} />
                <FrequencyPill label="Hasta una fecha"    active={endMode === 'until'} onPress={() => setEndMode('until')} />
                <FrequencyPill label="Un nº de veces"     active={endMode === 'count'} onPress={() => setEndMode('count')} />
                {endMode === 'until' && (
                  <InlineMonthPicker value={endDate} onChange={setEndDate} minDate={pickedDate} />
                )}
                {endMode === 'count' && (
                  <TextInput
                    keyboardType="number-pad"
                    value={count}
                    onChangeText={setCount}
                    style={styles.countInput}
                    accessibilityLabel="Número de veces"
                  />
                )}
              </View>
            )}

            {step === 5 && pickedBlockId && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Bloque: </Text>
                  {blocks.find((b) => b.id === pickedBlockId)?.name ?? '—'}
                </Text>
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cuándo: </Text>
                  {frequency === 'once' ? formatLongDate(pickedDate) : finalRRule ? summarizeRule(finalRRule) : '—'}
                </Text>
                {frequency !== 'once' && (
                  <Text style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Inicia: </Text>
                    {formatLongDate(pickedDate)}
                  </Text>
                )}
                {endMode === 'until' && (
                  <Text style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Hasta: </Text>
                    {formatLongDate(endDate)}
                  </Text>
                )}
                {endMode === 'count' && (
                  <Text style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Repeticiones: </Text>
                    {count}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {step < 5 ? (
              <Pressable
                onPress={() => {
                  if (step === 3 && frequency === 'once')      next(5);  // skip range step for one-time
                  else if (step === 3 && frequency === 'weekly' && pickedWeekdays.length === 0) return;
                  else if (step === 3 && frequency === 'advanced' && !parseRRule(advancedRRule).ok) return;
                  else next((step + 1) as typeof step);
                }}
                style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.primaryText}>Siguiente</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={confirm}
                style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.primaryText}>Asignar</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function FrequencyPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.freqPill, active && styles.freqPillActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.freqPillText, active && styles.freqPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const toggle = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort());
  };
  return (
    <View style={styles.weekdayRow}>
      {labels.map((l, i) => (
        <Pressable
          key={l}
          onPress={() => toggle(i)}
          style={({ pressed }) => [
            styles.weekdayBtn,
            value.includes(i) && styles.weekdayBtnActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.weekdayBtnText, value.includes(i) && styles.weekdayBtnTextActive]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function InlineMonthPicker({ value, onChange, minDate }: { value: ISODate; onChange: (d: ISODate) => void; minDate?: ISODate }) {
  const [anchor, setAnchor] = useState(value);
  const days = useMemo(() => monthGridDays(anchor), [anchor]);
  const focusedMonth = fromISODate(anchor).getMonth();

  return (
    <View>
      <View style={styles.pickerHeader}>
        <Pressable onPress={() => setAnchor(addMonthsISO(anchor, -1))} hitSlop={12}>
          <Text style={styles.pickerArrow}>‹</Text>
        </Pressable>
        <Text style={styles.pickerMonth}>{formatMonthYear(anchor)}</Text>
        <Pressable onPress={() => setAnchor(addMonthsISO(anchor, 1))} hitSlop={12}>
          <Text style={styles.pickerArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.pickerGrid}>
        {days.map((d) => {
          const disabled = !!minDate && d < minDate;
          return (
            <View key={d} style={styles.pickerCell}>
              <DayCell
                date={d}
                selected={d === value}
                isToday={d === todayISO()}
                hasAssignment={false}
                isOtherMonth={fromISODate(d).getMonth() !== focusedMonth}
                size="month"
                onPress={(picked) => { if (!disabled) onChange(picked); }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    maxHeight: '88%',
    ...Shadows.elevated,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.hair.strong, marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: Spacing.md,
  },
  backArrow: { fontSize: 24, color: Colors.ink.secondary, width: 24 },
  stepTitle: { ...Type.bodyEmphasis, color: Colors.ink.primary, flex: 1, textAlign: 'center' },
  content: { paddingVertical: Spacing.md, minHeight: 240 },
  footer: { paddingTop: Spacing.md },
  primary: {
    backgroundColor: Colors.gold.base, paddingVertical: 14, alignItems: 'center', borderRadius: Radius.md,
  },
  primaryText: { ...Type.bodyEmphasis, color: Colors.ink.inverse },

  blockRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
  },
  blockSwatch: { width: 36, height: 36, borderRadius: Radius.md },
  blockName: { ...Type.bodyEmphasis, color: Colors.ink.primary },
  blockMeta: { ...Type.label, color: Colors.ink.tertiary, marginTop: 2 },
  emptyHint: { ...Type.body, color: Colors.ink.tertiary, textAlign: 'center', padding: Spacing.lg },

  freqPill: {
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  freqPillActive: {
    borderColor: Colors.gold.base, backgroundColor: Colors.gold.glow,
  },
  freqPillText: { ...Type.body, color: Colors.ink.secondary, textAlign: 'center' },
  freqPillTextActive: { color: Colors.gold.deep, fontWeight: '600' },

  weekdayRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'space-between' },
  weekdayBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg.elevated,
  },
  weekdayBtnActive: { backgroundColor: Colors.gold.base },
  weekdayBtnText: { ...Type.bodyEmphasis, color: Colors.ink.secondary },
  weekdayBtnTextActive: { color: Colors.ink.inverse },

  preset: {
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
  },
  presetLabel: { ...Type.body, color: Colors.ink.secondary },
  rruleInput: {
    minHeight: 60, padding: Spacing.md,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
    ...Type.body, color: Colors.ink.primary,
  },
  rruleSummary: { ...Type.label, color: Colors.gold.deep },
  rruleError: { ...Type.label, color: Colors.semantic.error },

  countInput: {
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
    ...Type.body, color: Colors.ink.primary, textAlign: 'center',
  },

  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  pickerArrow: { fontSize: 24, color: Colors.ink.secondary, paddingHorizontal: Spacing.sm },
  pickerMonth: { ...Type.bodyEmphasis, color: Colors.ink.primary, textTransform: 'capitalize' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  pickerCell: { width: `${100 / 7}%` },

  help: { ...Type.label, color: Colors.ink.tertiary },

  summaryRow: { ...Type.body, color: Colors.ink.primary },
  summaryLabel: { color: Colors.ink.tertiary },
});
```

> **Token fallbacks (verify against `src/theme/tokens.ts` first):**
> - `Radius.xl` not present → use `Radius.lg + 4` numeric value or define inline `28`.
> - `Shadows.elevated` not present → use `Shadows.card` or define `{ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } }`.

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/AssignBlockSheet.tsx
git commit -m "feat(planner): AssignBlockSheet with one-time + weekly + RRULE flow"
```

---

## Task 16: RecurrenceEditorSheet

**Files:**
- Create: `src/features/planner/components/RecurrenceEditorSheet.tsx`

- [ ] **Step 1: Write the sheet**

```tsx
// src/features/planner/components/RecurrenceEditorSheet.tsx
// Edit recurrence pattern of an existing series. Applies "this and future"
// by truncating the current rule and creating a new one starting today.

import React, { useMemo, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useScheduleStore } from '../../../store/scheduleStore';
import {
  buildWeeklyRule, parseRRule, summarizeRule, RRULE_PRESETS,
} from '../lib/rrule';
import { todayISO, addDaysISO } from '../lib/dates';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  selectedDate: string;
  onClose: () => void;
}

export default function RecurrenceEditorSheet({ visible, assignmentId, selectedDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const assignment = useScheduleStore((s) =>
    assignmentId ? s.assignments.find((a) => a.id === assignmentId) : null,
  );
  const truncateSeries = useScheduleStore((s) => s.truncateSeries);
  const assignRecurring = useScheduleStore((s) => s.assignRecurring);

  const initialRRule = assignment?.kind === 'recurring' ? assignment.rrule : '';
  const [rrule, setRRule] = useState(initialRRule);

  // Reset state when the sheet opens for a different assignment.
  React.useEffect(() => {
    if (visible) setRRule(initialRRule);
  }, [visible, initialRRule]);

  const valid = useMemo(() => parseRRule(rrule).ok, [rrule]);

  const applyChange = useCallback(() => {
    if (!assignment || assignment.kind !== 'recurring' || !valid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    truncateSeries(assignment.id, addDaysISO(selectedDate, -1));
    assignRecurring({
      blockId: assignment.blockId,
      rrule,
      startDate: selectedDate,
      endDate: assignment.endDate,
    });
    onClose();
  }, [assignment, valid, rrule, selectedDate, truncateSeries, assignRecurring, onClose]);

  const endSeries = useCallback(() => {
    if (!assignment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    truncateSeries(assignment.id, addDaysISO(todayISO(), -1));
    onClose();
  }, [assignment, truncateSeries, onClose]);

  if (!assignment || assignment.kind !== 'recurring') return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Editar serie</Text>
          <Text style={styles.subtitle}>Aplica desde {selectedDate} hacia adelante. Las ocurrencias pasadas quedan intactas.</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Patrón actual</Text>
            <Text style={styles.summary}>{summarizeRule(initialRRule)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Presets</Text>
            <View style={{ gap: Spacing.sm }}>
              {RRULE_PRESETS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setRRule(p.build(selectedDate))}
                  style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.presetLabel}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>RRULE</Text>
            <TextInput
              multiline
              value={rrule}
              onChangeText={setRRule}
              style={styles.rruleInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {rrule.length > 0 && (
              valid
                ? <Text style={styles.summaryNew}>{summarizeRule(rrule)}</Text>
                : <Text style={styles.error}>Regla no válida</Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={applyChange}
              disabled={!valid}
              style={({ pressed }) => [styles.primary, !valid && styles.primaryDisabled, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.primaryText}>Aplicar a esta y futuras</Text>
            </Pressable>
            <Pressable onPress={endSeries} style={({ pressed }) => [styles.danger, pressed && { opacity: 0.6 }]}>
              <Text style={styles.dangerText}>Terminar serie</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screen.horizontal,
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.hair.strong, marginBottom: Spacing.md,
  },
  title: { ...Type.title, color: Colors.ink.primary, fontSize: 20 },
  subtitle: { ...Type.bodySm, color: Colors.ink.tertiary, marginTop: 4, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  label: { ...Type.label, color: Colors.ink.tertiary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6 },
  summary: { ...Type.body, color: Colors.ink.primary },
  summaryNew: { ...Type.label, color: Colors.gold.deep, marginTop: Spacing.sm },
  error: { ...Type.label, color: Colors.semantic.error, marginTop: Spacing.sm },
  preset: {
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
  },
  presetLabel: { ...Type.body, color: Colors.ink.secondary },
  rruleInput: {
    minHeight: 60, padding: Spacing.md,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
    ...Type.body, color: Colors.ink.primary,
  },
  actions: { gap: Spacing.sm, paddingTop: Spacing.md },
  primary: {
    backgroundColor: Colors.gold.base, paddingVertical: 14, alignItems: 'center', borderRadius: Radius.md,
  },
  primaryDisabled: { backgroundColor: Colors.hair.strong },
  primaryText: { ...Type.bodyEmphasis, color: Colors.ink.inverse },
  danger: { paddingVertical: 12, alignItems: 'center' },
  dangerText: { ...Type.bodyEmphasis, color: Colors.ink.muted },
});
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/RecurrenceEditorSheet.tsx
git commit -m "feat(planner): RecurrenceEditorSheet (apply this+future, end series)"
```

---

## Task 17: TodayPlanner orchestrator

**Files:**
- Create: `src/features/planner/TodayPlanner.tsx`

- [ ] **Step 1: Write the orchestrator**

```tsx
// src/features/planner/TodayPlanner.tsx
// Top-level planner — header + calendar + day card + Kai signal + sheets.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Spacing } from '../../theme/tokens';
import PlannerHeader from './components/PlannerHeader';
import CalendarView from './components/CalendarView';
import DayCard from './components/DayCard';
import KaiSignalCard from './components/KaiSignal';
import AssignBlockSheet from './components/AssignBlockSheet';
import RecurrenceEditorSheet from './components/RecurrenceEditorSheet';

import { todayISO } from './lib/dates';
import { kaiSignal, type KaiSignal } from './lib/kaiSignal';
import { useDayCardState } from './hooks/useDayCardState';
import { useWorkoutStore } from '../../store/workoutStore';
import { useScheduleStore } from '../../store/scheduleStore';
import { useGamification } from '../../context/GamificationContext';
import type { ISODate } from '../../types/schedule';
import type { WorkoutBlock } from '../../types/core';
import type { RootStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TodayPlanner() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();

  const [selectedDate, setSelectedDate] = useState<ISODate>(todayISO());
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [editSeriesSheet, setEditSeriesSheet] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ assignmentId: string; fromDate: ISODate } | null>(null);
  const [changeBlockTarget, setChangeBlockTarget] = useState<{ assignmentId: string; date: ISODate } | null>(null);

  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const blocks = useWorkoutStore((s) => s.blocks);
  const history = useWorkoutStore((s) => s.workoutHistory);
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const { streak } = useGamification();

  // Prune expired undo entries every 5s while screen is mounted.
  const pruneExpired = useScheduleStore((s) => s.pruneExpiredDeletions);
  useEffect(() => {
    const interval = setInterval(pruneExpired, 5_000);
    return () => clearInterval(interval);
  }, [pruneExpired]);

  const dayState = useDayCardState(selectedDate);

  const lastSession = useMemo(() => {
    if (!dayState.resolved) return null;
    const blockId = dayState.resolved.blockId;
    const last = history.find((h) => h.blockId === blockId);
    if (!last) return null;
    const target = blocks.find((b) => b.id === blockId);
    const targetSets = target ? (target.exercises ?? []).reduce((acc, e) => acc + (e.sets?.length ?? 0), 0) : 0;
    return { setCount: last.setCount, targetSetCount: targetSets };
  }, [dayState.resolved, history, blocks]);

  const signal: KaiSignal | null = useMemo(
    () =>
      kaiSignal({
        selectedDate,
        isToday: dayState.isToday,
        isPast:  dayState.isPast,
        resolved: dayState.resolved,
        streak: streak.current,
        blocksCount: blocks.length,
        hasActiveWorkout: !!activeWorkout,
        lastSession,
      }),
    [selectedDate, dayState, streak.current, blocks.length, activeWorkout, lastSession],
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleStart = useCallback((block: WorkoutBlock) => {
    startWorkout(block.id);
    nav.navigate('ActiveWorkout', { blockId: block.id });
  }, [startWorkout, nav]);

  const handleResume = useCallback((block: WorkoutBlock) => {
    nav.navigate('ActiveWorkout', { blockId: block.id });
  }, [nav]);

  const handleCreateBlock = useCallback(() => {
    nav.navigate('WorkoutTab' as never);
  }, [nav]);

  const handleSeeBlockFull = useCallback((block: WorkoutBlock) => {
    nav.navigate('WorkoutTab' as never, { highlightBlockId: block.id } as never);
  }, [nav]);

  const handlePlanWeek = useCallback(() => {
    nav.navigate('AILabTab' as never);
  }, [nav]);

  const handleSignalAction = useCallback((action: KaiSignal['action']) => {
    if (!action) return;
    switch (action.kind) {
      case 'create-block': handleCreateBlock(); break;
      case 'plan-week':    handlePlanWeek(); break;
      case 'assign':       setAssignSheetOpen(true); break;
      case 'resume':       if (activeWorkout) nav.navigate('ActiveWorkout', { blockId: activeWorkout.blockId }); break;
    }
  }, [handleCreateBlock, handlePlanWeek, activeWorkout, nav]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <PlannerHeader />
        <CalendarView selectedDate={selectedDate} onSelect={setSelectedDate} />
        <DayCard
          date={selectedDate}
          onAssign={(d) => { setSelectedDate(d); setAssignSheetOpen(true); }}
          onStart={handleStart}
          onResume={handleResume}
          onChangeBlock={(assignmentId, date) => setChangeBlockTarget({ assignmentId, date })}
          onMove={(assignmentId, fromDate) => setMoveTarget({ assignmentId, fromDate })}
          onEditSeries={(assignmentId) => setEditSeriesSheet(assignmentId)}
          onCreateBlock={handleCreateBlock}
          onSeeBlockFull={handleSeeBlockFull}
          onPlanWeek={handlePlanWeek}
        />
        <KaiSignalCard signal={signal} onAction={handleSignalAction} />
      </ScrollView>

      <AssignBlockSheet
        visible={assignSheetOpen}
        initialDate={selectedDate}
        onClose={() => setAssignSheetOpen(false)}
      />
      <RecurrenceEditorSheet
        visible={!!editSeriesSheet}
        assignmentId={editSeriesSheet}
        selectedDate={selectedDate}
        onClose={() => setEditSeriesSheet(null)}
      />
      {/* MoveTarget and changeBlockTarget reuse AssignBlockSheet semantics in v2.
          For v1 they're a no-op trigger that opens a date prompt or a block list.
          See Task 18 for wiring. */}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.void },
  content: {},
});
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

> If `RootStackParamList['ActiveWorkout']` doesn't include `blockId`, check `src/types/navigation.ts` and adjust the call. The existing `HomeScreen.tsx` already navigates with `{ blockId }`, so the param exists.

- [ ] **Step 3: Commit**

```bash
git add src/features/planner/TodayPlanner.tsx
git commit -m "feat(planner): TodayPlanner orchestrator wiring header + calendar + day card + signal"
```

---

## Task 18: Move and Change Block sheets

**Files:**
- Modify: `src/features/planner/TodayPlanner.tsx`
- Create: `src/features/planner/components/MovePicker.tsx`
- Create: `src/features/planner/components/ChangeBlockPicker.tsx`

For v1 keep these tight: each is a small modal with one purpose.

- [ ] **Step 1: Write `MovePicker`**

```tsx
// src/features/planner/components/MovePicker.tsx
// Modal: pick a destination date for a single occurrence.

import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { addMonthsISO, monthGridDays, formatMonthYear, fromISODate, todayISO } from '../lib/dates';
import DayCell from './DayCell';
import { useScheduleStore } from '../../../store/scheduleStore';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  fromDate: ISODate | null;
  onClose: () => void;
}

export default function MovePicker({ visible, assignmentId, fromDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const move = useScheduleStore((s) => s.moveOccurrence);
  const [anchor, setAnchor] = useState<ISODate>(fromDate ?? todayISO());

  React.useEffect(() => { if (fromDate) setAnchor(fromDate); }, [fromDate]);

  if (!assignmentId || !fromDate) return null;

  const days = monthGridDays(anchor);
  const focusedMonth = fromISODate(anchor).getMonth();

  const pick = (d: ISODate) => {
    move(assignmentId, fromDate, d);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Mover sesión</Text>
          <View style={styles.headerRow}>
            <Pressable onPress={() => setAnchor(addMonthsISO(anchor, -1))}><Text style={styles.arrow}>‹</Text></Pressable>
            <Text style={styles.month}>{formatMonthYear(anchor)}</Text>
            <Pressable onPress={() => setAnchor(addMonthsISO(anchor, 1))}><Text style={styles.arrow}>›</Text></Pressable>
          </View>
          <View style={styles.grid}>
            {days.map((d) => (
              <View key={d} style={styles.cell}>
                <DayCell
                  date={d}
                  selected={d === fromDate}
                  isToday={d === todayISO()}
                  hasAssignment={false}
                  isOtherMonth={fromISODate(d).getMonth() !== focusedMonth}
                  size="month"
                  onPress={pick}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: Spacing.md, paddingHorizontal: Spacing.screen.horizontal, ...Shadows.card,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.hair.strong, marginBottom: Spacing.md },
  title: { ...Type.title, fontSize: 20, color: Colors.ink.primary, marginBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  arrow: { fontSize: 24, color: Colors.ink.secondary, paddingHorizontal: Spacing.sm },
  month: { ...Type.bodyEmphasis, color: Colors.ink.primary, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: Spacing.lg },
  cell: { width: `${100 / 7}%`, paddingVertical: 2 },
});
```

- [ ] **Step 2: Write `ChangeBlockPicker`**

```tsx
// src/features/planner/components/ChangeBlockPicker.tsx
// Modal: pick a different block for a single occurrence.

import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Type, Spacing, Radius, Shadows } from '../../../theme/tokens';
import { useWorkoutStore } from '../../../store/workoutStore';
import { useScheduleStore } from '../../../store/scheduleStore';
import { DISCIPLINE_CONFIGS } from '../../../types/core';
import type { ISODate } from '../../../types/schedule';

interface Props {
  visible: boolean;
  assignmentId: string | null;
  date: ISODate | null;
  onClose: () => void;
}

export default function ChangeBlockPicker({ visible, assignmentId, date, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const blocks = useWorkoutStore((s) => s.blocks.filter((b) => !b.is_archived && !b.parentBlockId));
  const change = useScheduleStore((s) => s.changeOccurrenceBlock);

  if (!assignmentId || !date) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
          style={[styles.sheet, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Cambiar bloque</Text>
          <FlatList
            data={blocks}
            keyExtractor={(b) => b.id}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { change(assignmentId, date, item.id); onClose(); }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.swatch, { backgroundColor: item.color ?? Colors.gold.glow }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{DISCIPLINE_CONFIGS[item.discipline]?.label ?? item.discipline}</Text>
                </View>
              </Pressable>
            )}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: Spacing.md, paddingHorizontal: Spacing.screen.horizontal, ...Shadows.card,
    maxHeight: '70%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.hair.strong, marginBottom: Spacing.md },
  title: { ...Type.title, fontSize: 20, color: Colors.ink.primary, marginBottom: Spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg.elevated, borderRadius: Radius.md,
  },
  swatch: { width: 36, height: 36, borderRadius: Radius.md },
  name: { ...Type.bodyEmphasis, color: Colors.ink.primary },
  meta: { ...Type.label, color: Colors.ink.tertiary, marginTop: 2 },
});
```

- [ ] **Step 3: Wire them in `TodayPlanner.tsx`**

Replace the comment "MoveTarget and changeBlockTarget reuse..." with actual sheet renders:

```tsx
// Add imports at top of TodayPlanner.tsx:
import MovePicker from './components/MovePicker';
import ChangeBlockPicker from './components/ChangeBlockPicker';

// Then below the RecurrenceEditorSheet render, add:
<MovePicker
  visible={!!moveTarget}
  assignmentId={moveTarget?.assignmentId ?? null}
  fromDate={moveTarget?.fromDate ?? null}
  onClose={() => setMoveTarget(null)}
/>
<ChangeBlockPicker
  visible={!!changeBlockTarget}
  assignmentId={changeBlockTarget?.assignmentId ?? null}
  date={changeBlockTarget?.date ?? null}
  onClose={() => setChangeBlockTarget(null)}
/>
```

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
git add src/features/planner/components/MovePicker.tsx src/features/planner/components/ChangeBlockPicker.tsx src/features/planner/TodayPlanner.tsx
git commit -m "feat(planner): Move + Change Block pickers wired into TodayPlanner"
```

---

## Task 19: Wire HomeTab

**Files:**
- Modify: `src/screens/tabs/HomeTab.tsx`

- [ ] **Step 1: Replace HomeTab body**

Read the current file first (`cat src/screens/tabs/HomeTab.tsx`) and confirm its export shape, then replace its content with:

```tsx
// src/screens/tabs/HomeTab.tsx
// HomeTab is now a thin wrapper around TodayPlanner. The previous "command
// centre" content is fully superseded by the planner.

import React from 'react';
import TodayPlanner from '../../features/planner/TodayPlanner';

export default function HomeTab() {
  return <TodayPlanner />;
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/tabs/HomeTab.tsx
git commit -m "feat(planner): HomeTab → TodayPlanner"
```

---

## Task 20: Wire active workout completion

**Files:**
- Modify: `src/screens/ActiveWorkoutScreen.tsx`

The active workout screen already has an `endWorkout` flow. We need it to also tell the schedule store that today's matching assignment is complete.

- [ ] **Step 1: Find the endWorkout handler**

```bash
grep -n "endWorkout\|finalizar\|finishWorkout" src/screens/ActiveWorkoutScreen.tsx | head -20
```

- [ ] **Step 2: Patch the handler**

Add this import near the other store imports:

```ts
import { useScheduleStore } from '../store/scheduleStore';
import { todayISO } from '../features/planner/lib/dates';
```

Find the function that finalizes the workout (searches for `endWorkout`, `addToHistory`, or `setActiveWorkout(null)` typically inside the "Finalizar" / "Completar" handler). Right before the workout state is cleared, insert:

```ts
// Mark today's matching schedule assignment as completed.
{
  const today = todayISO();
  const blockId = activeWorkout?.blockId;  // or however the local var is named
  if (blockId) {
    const resolved = useScheduleStore.getState().resolveDate(today);
    const match = resolved.find((r) => r.blockId === blockId);
    if (match) {
      useScheduleStore.getState().completeOccurrence(match.assignmentId, today);
    }
  }
}
```

> If the active workout's blockId lives under a different name in this file, adapt accordingly. The patch must run BEFORE `setActiveWorkout(null)` (or equivalent) so we still have the reference.

- [ ] **Step 3: Type check + verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/ActiveWorkoutScreen.tsx
git commit -m "feat(planner): mark scheduled session complete on workout end"
```

---

## Task 21: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run all dev tests**

```bash
npx tsx src/features/planner/lib/dates.dev.ts \
  && npx tsx src/features/planner/lib/rrule.dev.ts \
  && npx tsx src/features/planner/lib/kaiSignal.dev.ts \
  && npx tsx src/store/scheduleStore.dev.ts
```

Expected: every script prints its "all checks pass" line and exits 0.

- [ ] **Step 2: Type-check the whole project**

```bash
npx tsc --noEmit
```

Expected: exit 0, no warnings.

- [ ] **Step 3: Boot Expo**

```bash
npm start
```

Expected: Metro bundles without errors. Open iOS simulator (`i`).

- [ ] **Step 4: Manual checklist on simulator**

Run through every acceptance criterion from spec §17. Mark each as you verify:

- [ ] HomeTab shows "Hoy" + date + momentum + streak pill, week view default, day card, KaiSignal.
- [ ] Toggle Semana ↔ Mes animates without layout jumps.
- [ ] Assign one-time block via sheet → dot in calendar, DayCard becomes Assigned, persists across reload.
- [ ] Assign recurring weekly L/X/V → dots on every L/X/V in current month, navigation between months preserves them.
- [ ] Tap Empezar → ActiveWorkoutScreen opens with the right block.
- [ ] Finalize workout → return to HomeTab → DayCard now Completed.
- [ ] Move a recurring occurrence: only that date moves, the rest stay.
- [ ] Skip a recurring occurrence: tomorrow shows PastSkipped (after a date change), the rest of the series intact.
- [ ] Edit series via chip: truncates old rule, new rule applies from today onward, history visible in past.
- [ ] No blocks at all: variant NoBlocks shows; tap Crear bloque → goes to WorkoutTab.
- [ ] No TS warnings or runtime errors in the Metro log.

- [ ] **Step 5: Commit acceptance log**

If you took notes, write them to a brief log file:

```bash
cat > docs/superpowers/specs/2026-05-09-today-planner-acceptance.md <<'EOF'
# Today Planner — Acceptance Run 2026-05-09

## Tested
- [list checks that passed]

## Issues
- [list anything that needs follow-up]
EOF
git add docs/superpowers/specs/2026-05-09-today-planner-acceptance.md
git commit -m "docs(planner): acceptance run log"
```

---

## Self-review

- **Spec coverage:** every section of the spec maps to one or more tasks. §3 architecture decisions → tasks 1–6. §4 data model → tasks 2 + 5. §5 components → tasks 9–18. §6 calendar UX → tasks 10–12. §7 day card → task 14. §8 AssignBlockSheet → task 15. §9 RecurrenceEditorSheet → task 16. §10 Kai Signal → tasks 6 + 13. §11 integration → tasks 17, 19, 20. §12 visual & motion → embedded throughout. §13 accessibility → embedded (accessibilityRole/Label everywhere). §14 persistence → task 5. §15 testing → `.dev.ts` smoke tests + manual checklist task 21. §16 file deltas → matches §5 directory plan. §17 acceptance → task 21 step 4.
- **No placeholders:** every step has actual code, exact paths, exact commands.
- **Type consistency:** `OneTimeAssignment.skipped: boolean` (singular, in types/store/dev test). `RecurringAssignment.skipped: ISODate[]` (array). Both consistent across all tasks. `assignmentId`, `blockId`, `date` shape matches everywhere.
