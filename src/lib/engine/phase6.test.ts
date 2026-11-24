import { describe, expect, it } from 'vitest';

import type { CheckIn, SessionLog } from '../adaptive';
import {
  autonomicEvidence,
  buildBioDays,
  hrvSignal,
  mergeBioDays,
  nightOf,
  rhrSignal,
  sleepByNight,
  type BioDay,
  type Biometrics,
} from './biometrics';
import { dayIndex } from './fitnessFatigue';
import { readinessV2 } from './readiness';
import { scaleFromHours, sleepDebt } from './sleep';
import {
  estimateHrMax,
  mergeWatchWorkouts,
  rpeFromHeartRate,
  sportFromActivity,
  workoutToSession,
  type WatchWorkout,
} from '../health/workoutImport';

const NOW = new Date('2026-11-18T09:00:00Z');
const TODAY = dayIndex(NOW);
const H = 3_600_000;
const D = 24 * H;
const at = (ms: number) => new Date(ms).toISOString();

function stableDays(n: number, hrv: number, rhr: number): BioDay[] {
  // Small day-to-day noise so the baseline has a real SD.
  return Array.from({ length: n }, (_, i) => ({
    day: TODAY - n + i,
    hrv: hrv * (1 + 0.08 * Math.sin(i * 1.7)),
    rhr: rhr + 2 * Math.sin(i * 2.3),
    sleepHours: 7.8,
  }));
}

describe('sleep from HealthKit', () => {
  it('a night belongs to the day you wake up', () => {
    expect(nightOf('2026-11-18T06:30:00Z')).toBe(TODAY);
    expect(nightOf('2026-11-17T23:30:00Z')).toBe(TODAY);
    expect(nightOf('2026-11-17T13:00:00Z')).toBe(TODAY - 1);
  });

  it('overlapping sources and stages are not counted twice', () => {
    const night = sleepByNight([
      // Watch stages 23:00–07:00 with an awake gap 03:00–03:30.
      { start: '2026-11-17T23:00:00Z', end: '2026-11-18T03:00:00Z', value: 3 },
      { start: '2026-11-18T03:00:00Z', end: '2026-11-18T03:30:00Z', value: 2 },
      { start: '2026-11-18T03:30:00Z', end: '2026-11-18T07:00:00Z', value: 5 },
      // iPhone's own "asleep" covering the same span.
      { start: '2026-11-17T23:10:00Z', end: '2026-11-18T06:50:00Z', value: 1 },
      // In bed is not sleep.
      { start: '2026-11-17T22:30:00Z', end: '2026-11-18T07:15:00Z', value: 0 },
    ]);
    expect(night.get(TODAY)).toBeCloseTo(8, 5);
  });

  it('a short fragment is not a night', () => {
    const night = sleepByNight([
      { start: '2026-11-18T05:00:00Z', end: '2026-11-18T06:00:00Z', value: 3 },
    ]);
    expect(night.has(TODAY)).toBe(false);
  });

  it('watch nights replace typed answers in the debt model', () => {
    const typed: CheckIn[] = [{ id: 'c', at: '2026-11-18T08:00:00Z', kind: 'pre', sleep: 5 }];
    const typedOnly = sleepDebt(typed, TODAY);
    const measured = sleepDebt(typed, TODAY, [{ day: TODAY, hours: 5, sd: 0.3 }]);
    expect(typedOnly.hours).toBe(0);
    expect(measured.hours).toBeCloseTo(3, 5);
  });

  it('maps hours to the nearest 1–5 level', () => {
    expect(scaleFromHours(4)).toBe(1);
    expect(scaleFromHours(6.8)).toBe(3);
    expect(scaleFromHours(9)).toBe(5);
  });
});

describe('HRV and resting HR against your own baseline', () => {
  it('no baseline, no signal', () => {
    const days = [...stableDays(5, 60, 52), { day: TODAY, hrv: 30, rhr: 70 }];
    expect(hrvSignal(days, TODAY)).toBeNull();
    expect(rhrSignal(days, TODAY)).toBeNull();
  });

  it('a normal morning says nothing; a crashed HRV says slow down', () => {
    const base = stableDays(28, 60, 52);
    expect(hrvSignal([...base, { day: TODAY, hrv: 60 }], TODAY)).toBeNull();
    const low = hrvSignal([...base, { day: TODAY, hrv: 40 }], TODAY);
    expect(low).not.toBeNull();
    expect(low!.delta).toBeLessThan(0);
    expect(low!.delta).toBeGreaterThanOrEqual(-3);
  });

  it('a high HRV is never a reason to push', () => {
    const base = stableDays(28, 60, 52);
    expect(hrvSignal([...base, { day: TODAY, hrv: 95 }], TODAY)).toBeNull();
  });

  it('resting HR needs a real jump, not noise', () => {
    const base = stableDays(28, 60, 52);
    expect(rhrSignal([...base, { day: TODAY, rhr: 54 }], TODAY)).toBeNull();
    const up = rhrSignal([...base, { day: TODAY, rhr: 62 }], TODAY);
    expect(up?.delta).toBeLessThan(0);
    expect(up?.label).toContain('10 lpm');
  });

  it('both signals together count less than their sum', () => {
    const base = stableDays(28, 60, 52);
    const bio: Biometrics = {
      days: [...base, { day: TODAY, hrv: 40, rhr: 62 }],
      updatedAt: NOW.toISOString(),
    };
    const ev = autonomicEvidence(bio, TODAY);
    expect(ev).toHaveLength(2);
    const hrv = hrvSignal(bio.days, TODAY)!;
    const rhr = rhrSignal(bio.days, TODAY)!;
    const total = ev.reduce((a, e) => a + e.delta, 0);
    expect(total).toBeGreaterThan(hrv.delta + rhr.delta);
    expect(total).toBeLessThan(Math.min(hrv.delta, rhr.delta));
  });

  it('builds and merges day rows without losing fields', () => {
    const rows = buildBioDays(
      [{ start: '2026-11-17T23:00:00Z', end: '2026-11-18T07:00:00Z', value: 3 }],
      [
        { at: '2026-11-18T04:00:00Z', value: 50 },
        { at: '2026-11-18T05:00:00Z', value: 70 },
      ],
      [],
    );
    expect(rows).toEqual([{ day: TODAY, sleepHours: 8, hrv: 60, rhr: undefined }]);
    const merged = mergeBioDays(
      [
        { day: TODAY, rhr: 51 },
        { day: TODAY - 120, rhr: 50 },
      ],
      rows,
      TODAY,
    );
    expect(merged).toEqual([{ day: TODAY, rhr: 51, sleepHours: 8, hrv: 60 }]);
  });
});

describe('readiness with the watch', () => {
  const sessions: SessionLog[] = [];

  it('a bad measured night lowers readiness without any check-in', () => {
    const base = readinessV2(sessions, [], NOW);
    const bio: Biometrics = {
      days: [{ day: TODAY, sleepHours: 4.2 }],
      updatedAt: NOW.toISOString(),
    };
    const watched = readinessV2(sessions, [], NOW, { biometrics: bio });
    expect(watched.expected.mean).toBeLessThan(base.expected.mean);
    expect(watched.evidence.some((e) => e.label.includes('4,2 h'))).toBe(true);
  });

  it('a crashed HRV shows up as evidence and lowers the forecast', () => {
    const bio: Biometrics = {
      days: [...stableDays(28, 60, 52), { day: TODAY, hrv: 38, sleepHours: 7.8 }],
      updatedAt: NOW.toISOString(),
    };
    const ok: Biometrics = {
      ...bio,
      days: [...stableDays(28, 60, 52), { day: TODAY, hrv: 60, sleepHours: 7.8 }],
    };
    const low = readinessV2(sessions, [], NOW, { biometrics: bio });
    const normal = readinessV2(sessions, [], NOW, { biometrics: ok });
    expect(low.evidence.some((e) => e.label.includes('VFC'))).toBe(true);
    expect(low.expected.mean).toBeLessThan(normal.expected.mean);
  });
});

describe('Apple Watch workouts', () => {
  const w = (over: Partial<WatchWorkout> = {}): WatchWorkout => ({
    uuid: 'A',
    activityType: 37,
    start: at(NOW.getTime() - 2 * H),
    end: at(NOW.getTime() - 1.5 * H),
    hrAvg: 150,
    hrMax: 176,
    distanceKm: 6.1,
    sourceName: 'Apple Watch de Álvaro',
    sourceBundle: 'com.apple.health.123',
    ...over,
  });

  it('maps activity types and leaves walks out', () => {
    expect(sportFromActivity(37)).toBe('running');
    expect(sportFromActivity(50)).toBe('strength');
    expect(sportFromActivity(52)).toBeNull();
  });

  it('heart rate gives a sensible session RPE', () => {
    expect(rpeFromHeartRate(114, 190)).toBeCloseTo(2, 5);
    expect(rpeFromHeartRate(152, 190)).toBeCloseTo(5.5, 5);
    expect(rpeFromHeartRate(171, 190)).toBeCloseTo(8, 5);
    expect(rpeFromHeartRate(200, 190)).toBe(10);
  });

  it('hrMax falls back to Tanaka and trusts a real observed max', () => {
    expect(estimateHrMax(undefined, 30)).toBeCloseTo(187, 5);
    expect(estimateHrMax(150)).toBe(190);
    expect(estimateHrMax(195)).toBe(195);
  });

  it('a watch run becomes a session with its pulse', () => {
    const s = workoutToSession(w(), 190)!;
    expect(s.id).toBe('hk-A');
    expect(s.sport).toBe('running');
    expect(s.durationMin).toBe(30);
    expect(s.sensors?.hrAvg).toBe(150);
    expect(s.source).toBe('watch');
    expect(s.rpe).toBeGreaterThan(4);
  });

  it('lifting keeps a realistic effort even with a low pulse', () => {
    const s = workoutToSession(w({ activityType: 50, hrAvg: 105 }), 190)!;
    expect(s.rpe).toBeGreaterThanOrEqual(6);
  });

  it('skips very short and unknown workouts', () => {
    expect(workoutToSession(w({ end: at(NOW.getTime() - 2 * H + 3 * 60_000) }), 190)).toBeNull();
    expect(workoutToSession(w({ activityType: 52 }), 190)).toBeNull();
  });

  it('never imports twice, nor what Kairos itself wrote', () => {
    const first = mergeWatchWorkouts([], [w()], { hrMax: 190 });
    expect(first.added).toBe(1);
    const again = mergeWatchWorkouts(first.sessions, [w()], { hrMax: 190 });
    expect(again.added).toBe(0);
    expect(again.sessions).toHaveLength(1);
    const own = mergeWatchWorkouts([], [w({ sourceBundle: 'com.alvaro.kairos.dev' })], {
      hrMax: 190,
      ownBundle: 'com.alvaro.kairos.dev',
    });
    expect(own.sessions).toHaveLength(0);
  });

  it('a watch workout during a Kairos session adds its pulse instead', () => {
    const kairos: SessionLog = {
      id: 'log-1',
      title: 'Fuerza A',
      sport: 'strength',
      startedAt: at(NOW.getTime() - 2.1 * H),
      endedAt: at(NOW.getTime() - 1.4 * H),
      durationMin: 42,
      rpe: 7,
      movements: [],
      source: 'kairos',
    };
    const r = mergeWatchWorkouts([kairos], [w({ activityType: 50 })], { hrMax: 190 });
    expect(r.added).toBe(0);
    expect(r.enriched).toBe(1);
    expect(r.sessions[0].sensors?.hrAvg).toBe(150);
    expect(r.sessions[0].externalId).toBe('A');
  });

  it('a workout deleted in Health disappears from Kairos', () => {
    const first = mergeWatchWorkouts([], [w()], { hrMax: 190 });
    const r = mergeWatchWorkouts(first.sessions, [], { hrMax: 190, deletedUuids: ['A'] });
    expect(r.sessions).toHaveLength(0);
  });

  it('imported sessions keep history in time order', () => {
    const old = w({
      uuid: 'B',
      start: at(NOW.getTime() - 3 * D),
      end: at(NOW.getTime() - 3 * D + H),
    });
    const r = mergeWatchWorkouts([], [w(), old], { hrMax: 190 });
    expect(r.sessions.map((s) => s.id)).toEqual(['hk-B', 'hk-A']);
  });
});

describe('implausible sleep data', () => {
  const sample = (start: string, end: string) => ({ start, end, value: 1 });

  it('a stuck 20 h asleep sample is not a night', () => {
    expect(sleepByNight([sample('2026-11-16T14:00:00Z', '2026-11-17T10:00:00Z')]).size).toBe(0);
  });

  it('merged samples over 14 h are left out instead of read as a great night', () => {
    const night = sleepByNight([
      sample('2026-11-16T15:00:00Z', '2026-11-17T00:00:00Z'),
      sample('2026-11-17T00:00:00Z', '2026-11-17T08:00:00Z'),
    ]);
    expect(night.size).toBe(0);
  });

  it('a normal night still counts', () => {
    const night = sleepByNight([sample('2026-11-16T23:00:00Z', '2026-11-17T07:00:00Z')]);
    expect([...night.values()]).toEqual([8]);
  });
});
