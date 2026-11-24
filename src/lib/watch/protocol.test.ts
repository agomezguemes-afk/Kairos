import { describe, expect, it } from 'vitest';

import { draftPlan, parseGoal, type PlanDraft, type SessionLog } from '../adaptive';
import type { DayPlan } from '../engine';
import { mergeWatchWorkouts } from '../health/workoutImport';
import {
  WATCH_PROTOCOL_VERSION,
  parseWatchLive,
  parseWatchResult,
  planForWatch,
  planKey,
  sessionFromWatch,
  type WatchResult,
} from './protocol';

const NOW = new Date('2026-11-18T09:00:00Z');

function acceptedPlan(): PlanDraft {
  const p = draftPlan(parseGoal('quiero ganar fuerza 3 días por semana'));
  return { ...p, sessions: p.sessions.map((s) => ({ ...s, status: 'accepted' as const })) };
}

function strengthSession(plan: PlanDraft) {
  const s = plan.sessions.find((d) => d.movements.some((m) => m.target.sets));
  if (!s) throw new Error('fixture plan has no set-based session');
  return s;
}

describe('plan sent to the watch', () => {
  it("puts today's pre-planned session first, trimmed on a light day", () => {
    const plan = acceptedPlan();
    const today = strengthSession(plan);
    const day: DayPlan = {
      draftSessionId: today.id,
      forDate: NOW.toISOString(),
      band: 'easy',
      probability: 0.4,
      trimSets: true,
      note: 'Hoy una serie menos: dormiste poco.',
    };
    const p = planForWatch(plan, [], day, 188, NOW);
    expect(p.v).toBe(WATCH_PROTOCOL_VERSION);
    expect(p.nextId).toBe(today.id);
    expect(p.sessions[0].id).toBe(today.id);
    expect(p.sessions[0].light).toBe(true);
    expect(p.sessions[0].note).toContain('serie menos');
    const full = planForWatch(plan, [], null, 188, NOW).sessions.find((s) => s.id === today.id)!;
    const sets = (s: typeof full) => s.movements.reduce((a, m) => a + m.sets.length, 0);
    expect(sets(p.sessions[0])).toBeLessThan(sets(full));
  });

  it('prefills sets from the last time, like the phone does', () => {
    const plan = acceptedPlan();
    const s = strengthSession(plan);
    const pm = s.movements.find((m) => m.target.sets)!;
    const last: SessionLog = {
      id: 'log-1',
      draftSessionId: s.id,
      title: s.title,
      sport: s.sport,
      startedAt: '2026-11-15T09:00:00Z',
      endedAt: '2026-11-15T10:00:00Z',
      durationMin: 60,
      rpe: 7,
      movements: [
        {
          movementId: pm.movementId,
          target: { ...pm.target, loadKg: undefined },
          sets: [{ reps: 7, loadKg: 62.5, completed: true }],
        },
      ],
    };
    const sent = planForWatch(
      {
        ...plan,
        sessions: plan.sessions.map((d) => ({
          ...d,
          movements: d.movements.map((m) => ({ ...m, target: { ...m.target, loadKg: null } })),
        })),
      },
      [last],
      null,
      190,
      NOW,
    );
    const m = sent.sessions
      .find((x) => x.id === s.id)!
      .movements.find((x) => x.id === pm.movementId)!;
    expect(m.sets[0]).toMatchObject({ reps: 7, loadKg: 62.5 });
    expect(m.name.length).toBeGreaterThan(0);
  });

  it('leaves out sessions the user did not keep, and survives no plan', () => {
    const plan = acceptedPlan();
    const one = {
      ...plan,
      sessions: plan.sessions.map((s, i) => ({
        ...s,
        status: i === 0 ? ('accepted' as const) : ('rejected' as const),
      })),
    };
    expect(planForWatch(one, [], null, 190, NOW).sessions).toHaveLength(1);
    const none = planForWatch(null, [], null, 190, NOW);
    expect(none.sessions).toEqual([]);
    expect(none.nextId).toBeNull();
  });

  it('only changes key when the content changes', () => {
    const plan = acceptedPlan();
    const a = planForWatch(plan, [], null, 190, NOW);
    const b = planForWatch(plan, [], null, 190, new Date(NOW.getTime() + 60_000));
    expect(planKey(a)).toBe(planKey(b));
    expect(planKey(planForWatch(plan, [], null, 180, NOW))).not.toBe(planKey(a));
  });
});

describe('sessions coming back from the watch', () => {
  const plan = acceptedPlan();
  const s = strengthSession(plan);
  const pm = s.movements[0];
  const result: WatchResult = {
    v: 1,
    id: 'E1C3',
    draftSessionId: s.id,
    title: s.title,
    sport: s.sport,
    startedAt: '2026-11-18T07:00:00.000Z',
    endedAt: '2026-11-18T07:48:00.000Z',
    rpe: 7.3,
    workoutUuid: 'HK-UUID-1',
    hrAvg: 131.6,
    hrMax: 171,
    zoneSeconds: [600, 900, 900, 400, 80],
    energyKcal: 380,
    movements: [
      { id: pm.movementId, sets: [{ reps: 8, loadKg: 60, completed: true }] },
      { id: 'skipped', sets: [] },
    ],
  };

  it('validates at the boundary', () => {
    expect(parseWatchResult(JSON.stringify(result)).ok).toBe(true);
    expect(parseWatchResult('{nope').ok).toBe(false);
    expect(parseWatchResult(JSON.stringify({ ...result, rpe: 14 })).ok).toBe(false);
    expect(parseWatchResult(JSON.stringify({ ...result, sport: 'chess' })).ok).toBe(false);
    const future = parseWatchResult(JSON.stringify({ ...result, v: WATCH_PROTOCOL_VERSION + 1 }));
    expect(future.ok).toBe(false);
    expect(parseWatchLive(JSON.stringify({ v: 1, hr: 142, at: 1 })).ok).toBe(true);
    expect(parseWatchLive(JSON.stringify({ v: 1, hr: 0, at: 1 })).ok).toBe(false);
  });

  it('becomes a normal Kairos session with targets from the plan', () => {
    const log = sessionFromWatch(result, plan)!;
    expect(log.id).toBe('watch-E1C3');
    expect(log.draftSessionId).toBe(s.id);
    expect(log.recordedOn).toBe('watch');
    expect(log.source).toBe('kairos');
    expect(log.durationMin).toBe(48);
    expect(log.rpe).toBe(7.5);
    expect(log.movements).toHaveLength(1);
    expect(log.movements[0].target).toEqual(pm.target);
    expect(log.sensors).toMatchObject({ hrAvg: 132, hrMax: 171, sources: ['Apple Watch'] });
  });

  it('a free workout or a plan that changed still lands', () => {
    const free = sessionFromWatch({ ...result, draftSessionId: undefined, title: '' }, null)!;
    expect(free.draftSessionId).toBeUndefined();
    expect(free.title).toBe('Entreno en el reloj');
    expect(free.movements[0].target).toEqual({});
    expect(sessionFromWatch({ ...result, endedAt: result.startedAt }, plan)).toBeNull();
  });

  it('its Health copy is not imported a second time', () => {
    const log = sessionFromWatch(result, plan)!;
    const copy = {
      uuid: 'HK-UUID-1',
      activityType: 50,
      start: result.startedAt,
      end: result.endedAt,
      hrAvg: 131,
      sourceName: 'Kairos',
      sourceBundle: 'com.alvaro.kairos.dev.watch',
    };
    const byUuid = mergeWatchWorkouts([log], [copy], { hrMax: 190 });
    expect(byUuid.sessions).toHaveLength(1);
    // Even before the session arrives over WatchConnectivity.
    const byBundle = mergeWatchWorkouts([], [copy], {
      hrMax: 190,
      ownBundle: 'com.alvaro.kairos.dev',
    });
    expect(byBundle.sessions).toHaveLength(0);
  });
});

describe('the same workout from two apps', () => {
  const run = (uuid: string, source: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    activityType: 37, // running
    start: '2026-11-17T07:00:00Z',
    end: '2026-11-17T07:50:00Z',
    distanceKm: 10,
    sourceName: source,
    sourceBundle: `com.${source.toLowerCase()}`,
    ...extra,
  });

  it('counts once and fills in what the first copy lacked', () => {
    const r = mergeWatchWorkouts(
      [],
      [
        run('A', 'Strava'),
        run('B', 'Watch', { start: '2026-11-17T07:01:00Z', hrAvg: 150, hrMax: 172 }),
      ],
      { hrMax: 190 },
    );
    expect(r.added).toBe(1);
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].distanceKm).toBe(10);
    expect(r.sessions[0].sensors?.hrAvg).toBe(150);
  });

  it('a different workout later the same morning still lands', () => {
    const r = mergeWatchWorkouts(
      [],
      [
        run('A', 'Strava'),
        run('C', 'Watch', { start: '2026-11-17T08:30:00Z', end: '2026-11-17T09:00:00Z' }),
      ],
      { hrMax: 190 },
    );
    expect(r.sessions).toHaveLength(2);
  });
});
