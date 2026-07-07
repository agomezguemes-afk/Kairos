import { describe, it, expect, beforeEach } from 'vitest';

import { useWorkoutStore, migratePersistedWorkoutState } from './workoutStore';
import { useScheduleStore } from './scheduleStore';
import { buildStarterBlocks, type StarterDiscipline } from '../lib/routines/starterTemplates';
import { computeWeekAssignments, weekdaysForFrequency } from '../lib/routines/weekAssignments';
import { ANALYTICS_EVENTS, getAnalyticsEvents } from '../lib/analytics';
import { todayISO, addDaysISO, fromISODate } from '../features/planner/lib/dates';
import type { OnboardingSpaceResult } from '../lib/ai/onboardingSpace';

// AsyncStorage's web fallback assumes `window` (same stub as the .dev.ts
// suites) — zustand persist flushes writes asynchronously after mutations.
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

function fixture(
  frequency: number,
  discipline: StarterDiscipline = 'strength',
): OnboardingSpaceResult {
  const blocks = buildStarterBlocks(
    { discipline, level: 'beginner', frequency, equipment: [] },
    'u1',
  );
  const blockIds = blocks.map((b) => b.id);
  return {
    blocks,
    blockIds,
    firstBlockId: blockIds[0],
    weekAssignments: computeWeekAssignments(blockIds, frequency),
    source: 'template',
    durationMs: 1234,
  };
}

/** Total resolved sessions in [start, end], via the real schedule resolver. */
function sessionsInRange(start: string, end: string) {
  const map = useScheduleStore.getState().resolveRange(start, end);
  const out: { date: string; blockId: string }[] = [];
  for (const [date, list] of map) {
    for (const r of list) out.push({ date, blockId: r.blockId });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

beforeEach(() => {
  useWorkoutStore.setState({ onboardingCompletedAt: null, blocks: [] });
  useScheduleStore.setState({ assignments: [], recentlyDeleted: [] });
});

describe('completeOnboarding — semana sembrada', () => {
  for (const frequency of [2, 3, 4, 5]) {
    it(`frequency ${frequency} → exactamente ${frequency} sesiones en los próximos 7 días`, () => {
      const result = fixture(frequency);
      useWorkoutStore.getState().completeOnboarding(result);

      const today = todayISO();
      const sessions = sessionsInRange(today, addDaysISO(today, 6));
      expect(sessions).toHaveLength(frequency);

      // Every session lands on a canonical training weekday (0=dom … 6=sáb).
      const expectedWeekdays = new Set(weekdaysForFrequency(frequency));
      for (const s of sessions) {
        expect(expectedWeekdays.has(fromISODate(s.date).getDay())).toBe(true);
      }

      // "Hoy" always resolves today's or the next session — never empty.
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].date >= today).toBe(true);
    });
  }

  it('split A/B (frequency 4) crea una serie recurrente por bloque y alterna', () => {
    const result = fixture(4, 'strength'); // strength ≥4 builds day A + day B
    expect(result.blocks).toHaveLength(2);

    useWorkoutStore.getState().completeOnboarding(result);

    const assignments = useScheduleStore.getState().assignments;
    expect(assignments).toHaveLength(2);
    expect(new Set(assignments.map((a) => a.blockId))).toEqual(new Set(result.blockIds));

    const today = todayISO();
    const sessions = sessionsInRange(today, addDaysISO(today, 6));
    expect(sessions).toHaveLength(4);
    // Both blocks train twice a week.
    const byBlock = new Map<string, number>();
    for (const s of sessions) byBlock.set(s.blockId, (byBlock.get(s.blockId) ?? 0) + 1);
    expect([...byBlock.values()]).toEqual([2, 2]);
  });

  it('marca onboardingCompletedAt con un timestamp ISO válido', () => {
    useWorkoutStore.getState().completeOnboarding(fixture(3));
    const flag = useWorkoutStore.getState().onboardingCompletedAt;
    expect(flag).not.toBeNull();
    expect(Number.isNaN(Date.parse(flag!))).toBe(false);
  });

  it('es idempotente: la segunda llamada no duplica la semana ni cambia el flag', () => {
    const store = useWorkoutStore.getState();
    store.completeOnboarding(fixture(3));

    const flagAfterFirst = useWorkoutStore.getState().onboardingCompletedAt;
    const assignmentsAfterFirst = useScheduleStore.getState().assignments.length;

    useWorkoutStore.getState().completeOnboarding(fixture(5));

    expect(useWorkoutStore.getState().onboardingCompletedAt).toBe(flagAfterFirst);
    expect(useScheduleStore.getState().assignments).toHaveLength(assignmentsAfterFirst);
  });

  it('sin weekAssignments: no siembra nada pero completa el onboarding', () => {
    const result = { ...fixture(3), weekAssignments: [] };
    useWorkoutStore.getState().completeOnboarding(result);

    expect(useScheduleStore.getState().assignments).toHaveLength(0);
    expect(useWorkoutStore.getState().onboardingCompletedAt).not.toBeNull();
  });

  it('emite onboarding_completed con las props del funnel', async () => {
    useWorkoutStore.getState().completeOnboarding(fixture(3));

    const events = await getAnalyticsEvents();
    const completed = events.filter((e) => e.event === ANALYTICS_EVENTS.onboardingCompleted);
    expect(completed.length).toBeGreaterThan(0);
    const last = completed[completed.length - 1];
    expect(last.props).toMatchObject({
      source: 'template',
      duration_ms: 1234,
      blocks: 1,
      sessions_per_week: 3,
    });
  });
});

describe('migratePersistedWorkoutState — v4 backfill', () => {
  it('usuario existente (userName presente, sin flag) queda marcado como onboarded', () => {
    const state = migratePersistedWorkoutState({ userName: 'Álvaro', blocks: [] }, 3) as {
      onboardingCompletedAt?: string | null;
    };
    expect(typeof state.onboardingCompletedAt).toBe('string');
    expect(Number.isNaN(Date.parse(state.onboardingCompletedAt!))).toBe(false);
  });

  it('instalación sin nombre no se marca como onboarded', () => {
    const state = migratePersistedWorkoutState({ userName: '', blocks: [] }, 3) as {
      onboardingCompletedAt?: string | null;
    };
    expect(state.onboardingCompletedAt ?? null).toBeNull();

    const spaced = migratePersistedWorkoutState({ userName: '   ', blocks: [] }, 3) as {
      onboardingCompletedAt?: string | null;
    };
    expect(spaced.onboardingCompletedAt ?? null).toBeNull();
  });

  it('un flag existente se respeta (no se sobrescribe)', () => {
    const original = '2026-01-01T00:00:00.000Z';
    const state = migratePersistedWorkoutState(
      { userName: 'Álvaro', blocks: [], onboardingCompletedAt: original },
      3,
    ) as { onboardingCompletedAt?: string | null };
    expect(state.onboardingCompletedAt).toBe(original);
  });

  it('las migraciones previas (canvasPosition v3) siguen funcionando', () => {
    const state = migratePersistedWorkoutState(
      { userName: 'Álvaro', blocks: [{ id: 'b1', content: [] }] },
      2,
    ) as { blocks: { id: string; canvasPosition: unknown }[] };
    expect(state.blocks[0].canvasPosition).toBeNull();
  });
});
