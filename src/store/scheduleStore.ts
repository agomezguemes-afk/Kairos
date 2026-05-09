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
import { daysBetween } from '../features/planner/lib/dates';
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
        const id = generateId();
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
        const id = generateId();
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
          id: generateId(),
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
