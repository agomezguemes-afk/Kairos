// Suggestion engine. Pure and deterministic: every number a suggestion
// shows is computed here, so an LLM may narrate it but never invents it.
//
// Principles (see docs/reports/Rediseño Kairos UX 2026.md):
//   - Few suggestions, each explained, each optional.
//   - Progress only on evidence the user actually produced.
//   - Back off only when ≥2 independent signals agree (never one metric).

import { findMovements, getMovement } from './catalog';
import { bestSetE1rm, loadTrend, roundTo, theilSenSlope } from './metrics';
import type {
  Confidence,
  MovementLog,
  MovementTarget,
  ParsedGoal,
  PlanDraft,
  Rarity,
  SessionLog,
  Suggestion,
  SuggestionKind,
} from './types';
import { affinityOf, isUnresponsive, responseProfile, type Experiment } from './experiments';

const MAX_SUGGESTIONS = 3;
const DAY_MS = 86_400_000;

export interface EngineInput {
  session: SessionLog;
  /** Earlier sessions, any order; `session` itself must not be included. */
  history: SessionLog[];
  goal?: ParsedGoal;
  plan?: PlanDraft;
  now?: Date;
  /** Past and running experiments: shape what gets proposed and in which order. */
  experiments?: Experiment[];
}

interface Occurrence {
  session: SessionLog;
  log: MovementLog;
}

function byEnd(a: SessionLog, b: SessionLog): number {
  return new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime();
}

function occurrences(movementId: string, sessions: SessionLog[]): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of [...sessions].sort(byEnd)) {
    const log = s.movements.find((m) => m.movementId === movementId);
    if (log) out.push({ session: s, log });
  }
  return out;
}

export function confidenceFor(count: number): Confidence {
  if (count >= 4) return 'solid';
  if (count >= 2) return 'emerging';
  return 'early';
}

function hitTop(log: MovementLog): boolean {
  const t = log.target;
  const done = log.sets.filter((s) => s.completed);
  if (!t.repsMax || done.length < (t.sets ?? 1)) return false;
  const rirFloor = Math.max(0, (t.rir ?? 2) - 1);
  return done.every(
    (s) => (s.reps ?? 0) >= t.repsMax! && (s.rir === undefined || s.rir >= rirFloor),
  );
}

function missedBottom(log: MovementLog): boolean {
  const t = log.target;
  if (!t.repsMin) return false;
  return log.sets.some((s) => s.completed && (s.reps ?? 0) < t.repsMin!);
}

function workingLoad(log: MovementLog): number | undefined {
  const loads = log.sets.filter((s) => s.completed && s.loadKg !== undefined).map((s) => s.loadKg!);
  return loads.length ? Math.max(...loads) : (log.target.loadKg ?? undefined);
}

// ── Recovery guard ──────────────────────────────────────────────────

export interface FatigueSignals {
  loadSpike: boolean;
  rpeDrift: boolean;
  hrDrift: boolean;
  count: number;
}

export function fatigueSignals(
  session: SessionLog,
  history: SessionLog[],
  now: Date,
): FatigueSignals {
  const trend = loadTrend([...history, session], now);
  const loadSpike = trend.band === 'spike';

  // Same planned session felt much harder than it usually does.
  const similar = history.filter(
    (h) =>
      (session.draftSessionId && h.draftSessionId === session.draftSessionId) ||
      h.title === session.title,
  );
  const recent = similar.sort(byEnd).slice(-3);
  const avgRpe = recent.length ? recent.reduce((s, h) => s + h.rpe, 0) / recent.length : null;
  const rpeDrift = avgRpe !== null && session.rpe - avgRpe >= 2;

  const hrBase = recent.map((h) => h.sensors?.hrAvg).filter((v): v is number => v !== undefined);
  const hrNow = session.sensors?.hrAvg;
  const hrDrift =
    hrNow !== undefined &&
    hrBase.length >= 2 &&
    hrNow > (hrBase.reduce((a, b) => a + b, 0) / hrBase.length) * 1.08;

  return {
    loadSpike,
    rpeDrift,
    hrDrift,
    count: [loadSpike, rpeDrift, hrDrift].filter(Boolean).length,
  };
}

// ── Rules ───────────────────────────────────────────────────────────

type Draft = Omit<Suggestion, 'id' | 'createdAt' | 'status' | 'sessionId' | 'draftSessionId'> & {
  /** Planned set count, so personalise() can swap load for volume. */
  sets?: number;
};

function strengthRules(occ: Occurrence[], suppressIncrease: boolean): Draft[] {
  const last = occ[occ.length - 1];
  const m = getMovement(last.log.movementId);
  if (!m || m.kind !== 'strength') return [];
  const confidence = confidenceFor(occ.length);
  const load = workingLoad(last.log);
  const out: Draft[] = [];

  // Two sessions in a row below the rep floor → the load is too heavy.
  const prev = occ[occ.length - 2];
  if (prev && missedBottom(last.log) && missedBottom(prev.log) && load && load > 0) {
    const next = roundTo(load * 0.9, m.incrementKg ?? 2.5);
    out.push({
      kind: 'deload',
      movementId: m.id,
      title: `Baja un poco ${m.name.toLowerCase()}`,
      from: { label: 'Carga', value: load, unit: 'kg' },
      to: { label: 'Carga', value: next, unit: 'kg' },
      patch: { loadKg: next },
      rationale: `Dos sesiones seguidas por debajo de ${last.log.target.repsMin} repeticiones. Un 10 % menos te devuelve al rango y vuelves a progresar desde ahí.`,
      evidence: [
        `${prev.session.title}: series por debajo del mínimo`,
        `Hoy: series por debajo del mínimo`,
      ],
      confidence,
      rarity: 'common',
    });
    return out;
  }

  // No increment defined = load isn't the progression lever (plyometrics,
  // core holds); suggesting "add kg" to a box jump would be nonsense.
  if (!suppressIncrease && m.incrementKg !== undefined && hitTop(last.log) && load !== undefined) {
    const inc = m.incrementKg;
    const next = roundTo(load + inc, inc > 1 ? inc / 2 : inc);
    const bestBefore = Math.max(0, ...occ.slice(0, -1).map((o) => bestSetE1rm(o.log.sets) ?? 0));
    const projected =
      bestSetE1rm([{ loadKg: next, reps: last.log.target.repsMin, completed: true }]) ?? 0;
    const rarity: Rarity = bestBefore > 0 && projected > bestBefore ? 'rare' : 'common';
    out.push({
      kind: 'increase_load',
      movementId: m.id,
      title:
        load === 0 ? `Añade lastre en ${m.name.toLowerCase()}` : `Sube ${m.name.toLowerCase()}`,
      from: { label: 'Carga', value: load, unit: 'kg' },
      to: { label: 'Carga', value: next, unit: 'kg' },
      patch: { loadKg: next },
      sets: last.log.target.sets,
      rationale: `Completaste todas las series en el tope (${last.log.target.repsMax} reps) con margen. Toca subir carga y volver a ${last.log.target.repsMin} reps: progresión doble.`,
      evidence: last.log.sets
        .filter((s) => s.completed)
        .map(
          (s, i) =>
            `Serie ${i + 1}: ${s.reps} × ${s.loadKg ?? load} kg${s.rir !== undefined ? ` · RIR ${s.rir}` : ''}`,
        ),
      confidence,
      rarity,
    });
  }

  // Plateau: e1RM flat across ≥4 exposures relative to its own noise.
  if (occ.length >= 4) {
    const series = occ.map((o) => bestSetE1rm(o.log.sets)).filter((v): v is number => v !== null);
    if (series.length >= 4) {
      const mean = series.reduce((a, b) => a + b, 0) / series.length;
      const slope = theilSenSlope(series);
      if (slope <= mean * 0.0025) {
        const quality = m.qualities[0];
        const sport = last.session.sport;
        const alt = findMovements(sport, quality).find((c) => c.id !== m.id && c.kind === m.kind);
        if (alt) {
          out.push({
            kind: 'new_movement',
            movementId: m.id,
            replacementMovementId: alt.id,
            title: `Nuevo estímulo: ${alt.name}`,
            rationale: `Tu 1RM estimado en ${m.name.toLowerCase()} lleva ${series.length} sesiones plano (≈${mean.toFixed(1)} kg). Una variante cambia el estímulo sin perder lo ganado.`,
            evidence: series.map((v, i) => `Sesión ${i + 1}: e1RM ${v} kg`),
            confidence,
            rarity: 'epic',
          });
        }
      }
    }
  }
  return out;
}

function enduranceRules(occ: Occurrence[], suppressIncrease: boolean): Draft[] {
  if (suppressIncrease) return [];
  const last = occ[occ.length - 1];
  const m = getMovement(last.log.movementId);
  if (!m) return [];
  const confidence = confidenceFor(occ.length);
  const t = last.log.target;
  // Needs two comfortable exposures: one easy day can be luck.
  const recent = occ.slice(-2);
  if (recent.length < 2) return [];

  if (m.kind === 'steady') {
    const comfortable = recent.every(
      (o) => o.session.rpe <= 6 && o.log.sets.every((s) => s.completed),
    );
    if (!comfortable) return [];
    if (t.distanceKm) {
      const next = roundTo(t.distanceKm * 1.1, 0.5);
      if (next <= t.distanceKm) return [];
      return [
        {
          kind: 'extend_distance',
          movementId: m.id,
          title: `Alarga ${m.name.toLowerCase()}`,
          from: { label: 'Distancia', value: t.distanceKm, unit: 'km' },
          to: { label: 'Distancia', value: next, unit: 'km' },
          patch: { distanceKm: next },
          rationale:
            'Dos sesiones seguidas cómodas (esfuerzo ≤ 6/10). Un +10 % es un paso que el cuerpo asimila sin coste extra.',
          evidence: recent.map((o) => `${o.session.title}: esfuerzo ${o.session.rpe}/10`),
          confidence,
          rarity: next >= 10 && t.distanceKm < 10 ? 'rare' : 'common',
        },
      ];
    }
    const base = t.durationMin ?? m.defaults.durationMin ?? 30;
    const next = Math.max(base + 5, roundTo(base * 1.1, 5));
    return [
      {
        kind: 'extend_duration',
        movementId: m.id,
        title: `Alarga ${m.name.toLowerCase()}`,
        from: { label: 'Duración', value: base, unit: 'min' },
        to: { label: 'Duración', value: next, unit: 'min' },
        patch: { durationMin: next },
        rationale:
          'Dos sesiones seguidas cómodas (esfuerzo ≤ 6/10). Más tiempo en zona 2 es la forma más segura de ganar fondo.',
        evidence: recent.map((o) => `${o.session.title}: esfuerzo ${o.session.rpe}/10`),
        confidence,
        rarity: next >= 60 && base < 60 ? 'rare' : 'common',
      },
    ];
  }

  if (m.kind === 'interval' && t.intervals) {
    const allDone = recent.every(
      (o) => o.log.sets.length > 0 && o.log.sets.every((s) => s.completed),
    );
    const manageable = recent.every((o) => o.session.rpe <= 7);
    const cap = Math.ceil((m.defaults.intervals?.reps ?? t.intervals.reps) * 1.5);
    if (!allDone || !manageable || t.intervals.reps >= cap) return [];
    const next = { ...t.intervals, reps: t.intervals.reps + 1 };
    return [
      {
        kind: 'add_interval',
        movementId: m.id,
        title: `Una repetición más en ${m.name.toLowerCase()}`,
        from: { label: 'Repeticiones', value: t.intervals.reps, unit: '' },
        to: { label: 'Repeticiones', value: next.reps, unit: '' },
        patch: { intervals: next },
        rationale:
          'Completaste todos los intervalos dos veces con esfuerzo controlado. Sumar uno sube el volumen de calidad sin cambiar la intensidad.',
        evidence: recent.map(
          (o) =>
            `${o.session.title}: ${o.log.sets.length} intervalos · esfuerzo ${o.session.rpe}/10`,
        ),
        confidence,
        rarity: 'common',
      },
    ];
  }
  return [];
}

function qualityGapRule(input: EngineInput, now: Date): Draft[] {
  const { goal, session, history } = input;
  if (!goal) return [];
  const all = [...history, session];
  if (all.length < 3) return [];
  const since = now.getTime() - 14 * DAY_MS;
  const trained = new Set<string>();
  for (const s of all) {
    if (new Date(s.endedAt).getTime() < since) continue;
    for (const ml of s.movements)
      getMovement(ml.movementId)?.qualities.forEach((q) => trained.add(q));
  }
  const gap = goal.qualities.find((q) => q !== 'mobility' && !trained.has(q));
  if (!gap) return [];
  const sport = goal.sports[0];
  const done = new Set(all.flatMap((s) => s.movements.map((m) => m.movementId)));
  const alt = findMovements(sport, gap).find((m) => !done.has(m.id));
  if (!alt) return [];
  return [
    {
      kind: 'new_movement',
      movementId: alt.id,
      title: `Desbloquea ${alt.name}`,
      rationale: `Tu objetivo incluye ${gap === 'endurance' ? 'resistencia' : gap === 'strength' ? 'fuerza' : gap} pero no la has trabajado en 14 días. Este ejercicio la cubre en tu deporte.`,
      evidence: [`Objetivo: "${goal.raw}"`, `Últimos 14 días: ${all.length} sesiones sin ${gap}`],
      confidence: confidenceFor(all.length),
      rarity: 'epic',
    },
  ];
}

const RARITY_RANK: Record<Rarity, number> = { epic: 0, rare: 1, common: 2 };

const KIND_LABEL: Partial<Record<SuggestionKind, string>> = {
  increase_load: 'subir carga',
  add_set: 'añadir series',
  extend_duration: 'alargar la sesión',
  extend_distance: 'sumar distancia',
  add_interval: 'añadir intervalos',
  new_movement: 'cambiar de ejercicio',
};

/**
 * Personalisation pass over the rule drafts:
 *  - never stack a second change on a movement that is mid-experiment
 *    (its outcome would become unreadable), safety kinds excepted;
 *  - when load increases have repeatedly failed for this person, offer
 *    the volume lever (one more set) instead;
 *  - cite the person's own track record for the kind being proposed.
 */
function personalise(drafts: Draft[], experiments: Experiment[] | undefined): Draft[] {
  if (!experiments?.length) return drafts;
  const profile = responseProfile(experiments);
  const busy = new Set(
    experiments
      .filter((e) => e.status === 'running' || e.status === 'review')
      .map((e) => e.movementId),
  );
  const out: Draft[] = [];
  for (const d of drafts) {
    const safety = d.kind === 'hold' || d.kind === 'deload';
    if (!safety && d.movementId && busy.has(d.movementId)) continue;
    let draft = d;
    if (d.kind === 'increase_load' && isUnresponsive(profile, 'increase_load')) {
      const sets = d.sets ?? 3;
      if (sets < 5) {
        const k = profile.increase_load!;
        draft = {
          ...d,
          kind: 'add_set',
          title: d.title
            .replace(/^Sube /, 'Una serie más en ')
            .replace(/^Añade lastre en /, 'Una serie más en '),
          from: { label: 'Series', value: sets, unit: 'series' },
          to: { label: 'Series', value: sets + 1, unit: 'series' },
          patch: { sets: sets + 1 },
          rationale: `Las subidas de carga te han funcionado ${k.worked} de ${k.tried} veces. Probamos por volumen: misma carga, una serie más.`,
        };
      }
    }
    const k = profile[draft.kind];
    if (k && k.tried > 0 && draft.kind !== 'hold') {
      draft = {
        ...draft,
        evidence: [
          ...draft.evidence,
          `Tu historial: ${KIND_LABEL[draft.kind] ?? 'este cambio'} te ha funcionado ${k.worked} de ${k.tried} veces`,
        ],
      };
    }
    out.push(draft);
  }
  return out;
}

export function generateSuggestions(input: EngineInput): Suggestion[] {
  const now = input.now ?? new Date();
  const { session, history } = input;
  const all = [...history, session];
  const fatigue = fatigueSignals(session, history, now);
  const drafts: Draft[] = [];

  if (fatigue.count >= 2) {
    const reasons = [
      fatigue.loadSpike && 'tu carga de 7 días está muy por encima de tu media',
      fatigue.rpeDrift && 'esta sesión te costó bastante más de lo habitual',
      fatigue.hrDrift && 'tu pulso medio fue más alto de lo normal para el mismo trabajo',
    ].filter(Boolean) as string[];
    drafts.push({
      kind: 'hold',
      movementId: '',
      title: 'Mantén y recupera',
      rationale: `Varias señales coinciden: ${reasons.join(', ')}. Esta semana mejor repetir cargas que subirlas.`,
      evidence: reasons,
      confidence: confidenceFor(all.length),
      rarity: 'common',
    });
  }
  const suppress = fatigue.count >= 2;

  for (const ml of session.movements) {
    const occ = occurrences(ml.movementId, all);
    drafts.push(...strengthRules(occ, suppress));
    drafts.push(...enduranceRules(occ, suppress));
  }
  if (!suppress) drafts.push(...qualityGapRule(input, now));

  const profile = input.experiments ? responseProfile(input.experiments) : undefined;
  const ordered = personalise(drafts, input.experiments)
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const ka = a.d.kind === 'hold' || a.d.kind === 'deload' ? -1 : RARITY_RANK[a.d.rarity];
      const kb = b.d.kind === 'hold' || b.d.kind === 'deload' ? -1 : RARITY_RANK[b.d.rarity];
      // Within a tier, kinds that have worked for this person come first.
      return ka - kb || affinityOf(profile, b.d.kind) - affinityOf(profile, a.d.kind) || a.i - b.i;
    })
    .slice(0, MAX_SUGGESTIONS);

  return ordered.map(({ d: { sets: _sets, ...d } }) => ({
    ...d,
    id: `${session.id}:${d.kind}:${d.movementId || 'session'}`,
    sessionId: session.id,
    draftSessionId: session.draftSessionId,
    createdAt: now.toISOString(),
    status: 'locked',
  }));
}

/**
 * First exposures calibrate unknown targets from what the user really did
 * (e.g. a null starting load becomes the load they lifted). Silent on
 * purpose: it records reality, it doesn't suggest anything.
 */
export function calibratePlan(plan: PlanDraft, session: SessionLog): PlanDraft {
  if (!session.draftSessionId) return plan;
  return {
    ...plan,
    sessions: plan.sessions.map((ds) => {
      if (ds.id !== session.draftSessionId) return ds;
      return {
        ...ds,
        movements: ds.movements.map((pm) => {
          if (pm.target.loadKg !== null) return pm;
          const log = session.movements.find((ml) => ml.movementId === pm.movementId);
          const load = log ? workingLoad(log) : undefined;
          return load === undefined || load === null
            ? pm
            : { ...pm, target: { ...pm.target, loadKg: load } };
        }),
      };
    }),
  };
}

/** Applies an accepted suggestion to the plan. Returns a new plan; never mutates. */
export function applySuggestion(
  plan: PlanDraft,
  s: Suggestion,
  override?: Partial<MovementTarget>,
): PlanDraft {
  const patch = { ...s.patch, ...override };
  const sessions = plan.sessions.map((ds) => {
    const scoped = !s.draftSessionId || ds.id === s.draftSessionId;
    if (s.kind === 'new_movement') {
      if (s.replacementMovementId) {
        // Plateau swap: replace everywhere the stale movement appears.
        const alt = getMovement(s.replacementMovementId);
        if (!alt) return ds;
        return {
          ...ds,
          movements: ds.movements.map((pm) =>
            pm.movementId === s.movementId
              ? { movementId: alt.id, target: { ...alt.defaults } }
              : pm,
          ),
        };
      }
      // Quality gap: add to the session the suggestion came from.
      const add = getMovement(s.movementId);
      if (!add || !scoped || ds.movements.some((pm) => pm.movementId === add.id)) return ds;
      return {
        ...ds,
        movements: [...ds.movements, { movementId: add.id, target: { ...add.defaults } }],
      };
    }
    if (s.kind === 'hold') return ds;
    // Paused, not deleted: it reappears under "sin decidir" to re-enable.
    if (s.kind === 'reduce_days')
      return ds.id === s.draftSessionId ? { ...ds, status: 'pending' as const } : ds;
    return {
      ...ds,
      movements: ds.movements.map((pm) =>
        pm.movementId === s.movementId ? { ...pm, target: { ...pm.target, ...patch } } : pm,
      ),
    };
  });
  return { ...plan, sessions };
}
