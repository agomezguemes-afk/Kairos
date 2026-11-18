// iPhone ↔ Apple Watch protocol. Plain JSON over WatchConnectivity, mirrored
// by targets/watch/Protocol.swift — change both together and bump VERSION.
//
//   phone → watch  applicationContext["plan"]  WatchPlan   (latest state only)
//   watch → phone  transferUserInfo["session"] WatchResult (queued, survives restarts)
//   watch → phone  sendMessage["live"]         WatchLive   (only while reachable)
//   phone → watch  sendMessage["cmd"]          WatchCommand
//
// Strings cross the bridge instead of dictionaries: one parse, one
// validation, here, at the boundary.

import * as v from 'valibot';

import {
  getMovement,
  initialLogs,
  previousLog,
  type DraftSession,
  type MovementLog,
  type PlanDraft,
  type SessionLog,
  type Sport,
} from '../adaptive';
import { trimTargets, type DayPlan } from '../engine';

export const WATCH_PROTOCOL_VERSION = 1;

export interface WatchSet {
  reps?: number;
  loadKg?: number;
  durationSec?: number;
  distanceKm?: number;
}

export interface WatchMovement {
  id: string;
  name: string;
  kind: 'strength' | 'steady' | 'interval' | 'mobility' | 'skill';
  cue: string;
  /** Rest between sets (s); 0 = none. */
  restSec: number;
  /** Load step for the crown (kg). */
  stepKg: number;
  rir?: number;
  repsMin?: number;
  repsMax?: number;
  zone?: number;
  workSec?: number;
  sets: WatchSet[];
}

export interface WatchSession {
  id: string;
  title: string;
  sport: Sport;
  durationMin: number;
  /** Trimmed for a light day; `note` says why. */
  light: boolean;
  note?: string;
  movements: WatchMovement[];
}

export interface WatchPlan {
  v: number;
  generatedAt: string;
  /** The session the engine pre-planned for today, shown first. */
  nextId: string | null;
  band?: DayPlan['band'];
  hrMax: number;
  sessions: WatchSession[];
}

const REST_BY_KIND: Record<WatchMovement['kind'], number> = {
  strength: 120,
  interval: 0,
  steady: 0,
  mobility: 30,
  skill: 60,
};

function watchSession(
  draft: DraftSession,
  history: SessionLog[],
  day: DayPlan | null,
): WatchSession {
  const today = day?.draftSessionId === draft.id ? day : null;
  const light = !!today?.trimSets;
  const shaped = light ? trimTargets(draft) : draft;
  const logs = initialLogs(shaped, previousLog(history, draft.id));
  return {
    id: draft.id,
    title: draft.title,
    sport: draft.sport,
    durationMin: draft.durationMin,
    light,
    note: today?.note,
    movements: logs.map((l) => {
      const m = getMovement(l.movementId);
      const kind = m?.kind ?? 'steady';
      const t = l.target;
      return {
        id: l.movementId,
        name: m?.name ?? l.movementId,
        kind,
        cue: m?.cue ?? '',
        restSec: t.restSec ?? t.intervals?.restSec ?? REST_BY_KIND[kind],
        stepKg: m?.incrementKg ?? 2.5,
        rir: t.rir,
        repsMin: t.repsMin,
        repsMax: t.repsMax,
        zone: t.zone,
        workSec: t.intervals?.workSec,
        sets: l.sets.map(({ reps, loadKg, durationSec, distanceKm }) =>
          clean({ reps, loadKg, durationSec, distanceKm }),
        ),
      };
    }),
  };
}

/** Accepted sessions of the plan, today's first, ready for the wrist. */
export function planForWatch(
  plan: PlanDraft | null,
  history: SessionLog[],
  day: DayPlan | null,
  hrMax: number,
  now: Date = new Date(),
): WatchPlan {
  const kept = (plan?.sessions ?? []).filter((s) => s.status === 'accepted');
  const nextId = day && kept.some((s) => s.id === day.draftSessionId) ? day.draftSessionId : null;
  const ordered = [...kept].sort(
    (a, b) => Number(b.id === nextId) - Number(a.id === nextId) || a.slot - b.slot,
  );
  return {
    v: WATCH_PROTOCOL_VERSION,
    generatedAt: now.toISOString(),
    nextId,
    band: nextId ? day?.band : undefined,
    hrMax: Math.round(hrMax),
    sessions: ordered.map((d) => watchSession(d, history, day)),
  };
}

/** The same plan, minus the timestamp: only push when something really changed. */
export function planKey(p: WatchPlan): string {
  return JSON.stringify({ ...p, generatedAt: undefined });
}

// ── Watch → phone ────────────────────────────────────────────────

const num = (min: number, max: number) =>
  v.pipe(v.number(), v.finite(), v.minValue(min), v.maxValue(max));
const iso = v.pipe(v.string(), v.isoTimestamp());

const SetSchema = v.object({
  reps: v.optional(num(0, 1000)),
  loadKg: v.optional(num(0, 1000)),
  rir: v.optional(num(0, 10)),
  durationSec: v.optional(num(0, 86_400)),
  distanceKm: v.optional(num(0, 1000)),
  completed: v.boolean(),
});

const SPORTS = [
  'padel',
  'tennis',
  'climbing',
  'hiking',
  'running',
  'cycling',
  'football',
  'basketball',
  'swimming',
  'strength',
  'general',
] as const satisfies readonly Sport[];

export const WatchResultSchema = v.object({
  v: v.number(),
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  draftSessionId: v.optional(v.string()),
  title: v.pipe(v.string(), v.maxLength(120)),
  sport: v.picklist(SPORTS),
  startedAt: iso,
  endedAt: iso,
  rpe: num(0, 10),
  workoutUuid: v.optional(v.string()),
  hrAvg: v.optional(num(25, 240)),
  hrMax: v.optional(num(25, 240)),
  zoneSeconds: v.optional(v.pipe(v.array(num(0, 86_400)), v.length(5))),
  energyKcal: v.optional(num(0, 20_000)),
  distanceKm: v.optional(num(0, 1000)),
  movements: v.array(v.object({ id: v.string(), sets: v.array(SetSchema) })),
});

export type WatchResult = v.InferOutput<typeof WatchResultSchema>;

export const WatchLiveSchema = v.object({
  v: v.number(),
  hr: num(25, 240),
  /** Epoch ms on the watch. */
  at: v.number(),
});

export type WatchLive = v.InferOutput<typeof WatchLiveSchema>;

export interface WatchCommand {
  v: number;
  /** End the sensor-mode workout the phone started; `save` keeps it in Health. */
  kind: 'end';
  save: boolean;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseWith<T>(schema: v.GenericSchema<unknown, T>, json: string): Parsed<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const r = v.safeParse(schema, raw);
  if (!r.success) return { ok: false, error: v.summarize(r.issues) };
  if ((r.output as { v: number }).v > WATCH_PROTOCOL_VERSION)
    return {
      ok: false,
      error: `protocol v${(r.output as { v: number }).v} is newer than this app`,
    };
  return { ok: true, value: r.output };
}

export const parseWatchResult = (json: string) => parseWith(WatchResultSchema, json);
export const parseWatchLive = (json: string) => parseWith(WatchLiveSchema, json);

/**
 * A session logged on the wrist becomes a Kairos session like any other:
 * targets come from the plan it was started from, so the engine reads it
 * exactly as if it had been logged on the phone.
 */
export function sessionFromWatch(r: WatchResult, plan: PlanDraft | null): SessionLog | null {
  const start = new Date(r.startedAt).getTime();
  const end = new Date(r.endedAt).getTime();
  if (!(end > start)) return null;
  const draft = r.draftSessionId
    ? plan?.sessions.find((s) => s.id === r.draftSessionId)
    : undefined;
  const movements: MovementLog[] = r.movements
    .filter((m) => m.sets.length > 0)
    .map((m) => ({
      movementId: m.id,
      target: { ...(draft?.movements.find((pm) => pm.movementId === m.id)?.target ?? {}) },
      sets: m.sets.map((s) => clean(s)),
    }));
  const hasHr = r.hrAvg !== undefined;
  return clean({
    id: `watch-${r.id}`,
    draftSessionId: draft?.id,
    title: r.title || draft?.title || 'Entreno en el reloj',
    sport: r.sport,
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(end).toISOString(),
    durationMin: Math.max(1, Math.round((end - start) / 60_000)),
    rpe: Math.round(r.rpe * 2) / 2,
    movements,
    sensors: hasHr
      ? clean({
          hrAvg: Math.round(r.hrAvg as number),
          hrMax: r.hrMax !== undefined ? Math.round(r.hrMax) : undefined,
          zoneSeconds: r.zoneSeconds as [number, number, number, number, number] | undefined,
          sources: ['Apple Watch'],
        })
      : undefined,
    source: 'kairos',
    recordedOn: 'watch',
    externalId: r.workoutUuid,
    distanceKm: r.distanceKm,
    energyKcal: r.energyKcal,
  }) as SessionLog;
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined)) as T;
}
