// KAIROS — Readiness scoring
//
// Three independent 0-100 dimensions, designed so the user can cross-
// reference them daily ("today I'm green on Fuerza but red on Recovery
// — light session").
//
// Pure functions — no React, no store. The signal is computed from the
// existing workoutHistory; later we can ingest Health data without
// changing the API.
//
//   • Energía     — readiness to perform. Drops on rest days >4, drops
//                   on consecutive heavy days. Sweet spot 1-3 days off.
//   • Fuerza      — strength trend. Up if recent PRs / volume rising.
//                   Neutral with no data; declines with 4+ weeks flat.
//   • Recuperación— muscle-group recovery. Drops if same group worked
//                   in last 48h; recovers linearly to 100% by 72h.

import type { WorkoutHistoryEntry } from '../../store/workoutStore';

export interface ReadinessSnapshot {
  energia: number; // 0-100
  fuerza: number; // 0-100
  recuperacion: number; // 0-100
  /** Concise one-line interpretation for the UI. */
  headline: string;
  /** Stable diagnostic codes the headline derives from — useful in tests. */
  signals: ReadinessSignals;
}

export interface ReadinessSignals {
  daysSinceLastWorkout: number | null;
  prsLast4Weeks: number;
  /** Muscle groups worked in last 48h (lowercase normalized). */
  recentMuscleGroups: string[];
  sessionsLast7Days: number;
}

const MS_PER_DAY = 24 * 3600 * 1000;

/**
 * Compute readiness snapshot from history at a given moment.
 * `now` parameter exposed so tests can pin time.
 */
export function computeReadiness(
  history: WorkoutHistoryEntry[],
  now = Date.now(),
): ReadinessSnapshot {
  // History comes from persisted storage — a corrupt/imported entry with a
  // non-finite timestamp would otherwise propagate NaN into every score.
  const clean = history.filter((h) => Number.isFinite(h.endedAt));
  const signals = collectSignals(clean, now);

  const energia = scoreEnergia(signals);
  const fuerza = scoreFuerza(signals, clean, now);
  const recuperacion = scoreRecuperacion(signals);

  return {
    energia,
    fuerza,
    recuperacion,
    headline: buildHeadline({ energia, fuerza, recuperacion }, signals),
    signals,
  };
}

// ── Signal extraction ───────────────────────────────────────────────

function collectSignals(history: WorkoutHistoryEntry[], now: number): ReadinessSignals {
  if (history.length === 0) {
    return {
      daysSinceLastWorkout: null,
      prsLast4Weeks: 0,
      recentMuscleGroups: [],
      sessionsLast7Days: 0,
    };
  }

  const sorted = [...history].sort((a, b) => b.endedAt - a.endedAt);
  const last = sorted[0];
  // Future-dated entries (clock skew, imported data) count as "trained today",
  // not as a negative gap that would inflate the energy score.
  const daysSinceLastWorkout = Math.max(0, Math.floor((now - last.endedAt) / MS_PER_DAY));

  const last7d = now - 7 * MS_PER_DAY;
  const sessionsLast7Days = sorted.filter((h) => h.endedAt >= last7d).length;

  // 48h window for muscle-group recovery. We pull names from exercise
  // names since the history entry doesn't carry muscle_groups directly
  // — a heuristic that's good enough for v1, refined when we tag
  // exercises canonically in the library.
  const last48h = now - 2 * MS_PER_DAY;
  const recentMuscleGroups = new Set<string>();
  for (const entry of sorted) {
    if (entry.endedAt < last48h) break;
    for (const ex of entry.exercises) {
      const tag = inferMuscleGroup(ex.name);
      if (tag) recentMuscleGroups.add(tag);
    }
  }

  // PRs in last 4 weeks: any session whose max weight on any exercise
  // beats the prior best for that exercise. Cheap heuristic — proper
  // PR detection already lives in lib/workout, this is the lite version.
  const fourWeeks = now - 28 * MS_PER_DAY;
  const recentSorted = sorted.filter((h) => h.endedAt >= fourWeeks);
  const bestSeen = new Map<string, number>();
  let prsLast4Weeks = 0;
  // Iterate oldest → newest so "beat" semantics work forward in time.
  for (let i = recentSorted.length - 1; i >= 0; i--) {
    for (const ex of recentSorted[i].exercises) {
      const key = ex.libraryId ?? ex.name.toLowerCase();
      const prev = bestSeen.get(key) ?? 0;
      if (Number.isFinite(ex.maxWeight) && ex.maxWeight > prev) {
        if (prev > 0) prsLast4Weeks += 1; // first seen isn't a "PR"
        bestSeen.set(key, ex.maxWeight);
      }
    }
  }

  return {
    daysSinceLastWorkout,
    prsLast4Weeks,
    recentMuscleGroups: [...recentMuscleGroups],
    sessionsLast7Days,
  };
}

const MUSCLE_KEYWORDS: { tag: string; words: string[] }[] = [
  { tag: 'chest', words: ['pecho', 'bench', 'banca', 'press', 'flexion', 'fly'] },
  { tag: 'back', words: ['espalda', 'row', 'remo', 'pull', 'jalon', 'dorsal'] },
  { tag: 'shoulders', words: ['hombro', 'shoulder', 'lateral', 'overhead', 'militar'] },
  { tag: 'biceps', words: ['biceps', 'curl'] },
  { tag: 'triceps', words: ['triceps', 'extension'] },
  { tag: 'quads', words: ['cuadriceps', 'squat', 'sentadilla', 'leg press', 'extension'] },
  { tag: 'hamstrings', words: ['isquio', 'hamstring', 'romanian', 'deadlift', 'peso muerto'] },
  { tag: 'glutes', words: ['gluteo', 'hip thrust'] },
  { tag: 'core', words: ['abdominal', 'core', 'plancha', 'crunch'] },
  { tag: 'cardio', words: ['correr', 'run', 'bike', 'bicicleta', 'cycling', 'swim'] },
];

function inferMuscleGroup(name: string): string | null {
  const lc = name.toLowerCase();
  for (const { tag, words } of MUSCLE_KEYWORDS) {
    if (words.some((w) => lc.includes(w))) return tag;
  }
  return null;
}

// ── Scoring functions ──────────────────────────────────────────────

function scoreEnergia(s: ReadinessSignals): number {
  if (s.daysSinceLastWorkout === null) return 90; // fresh user: optimistic
  const d = s.daysSinceLastWorkout;

  // 0 days = entrenó hoy → 50% (cuesta repetir el mismo día)
  // 1-2 days = sweet spot → 90-100
  // 3-4 days = good but losing momentum → 80-70
  // 5-7 days = stale → 60-50
  // 8+ days = detrained feeling → 45 → 30 floor
  let base: number;
  if (d === 0) base = 50;
  else if (d <= 2) base = 100 - (d - 1) * 5;
  else if (d <= 4) base = 90 - (d - 2) * 10;
  else if (d <= 7) base = 70 - (d - 4) * 7;
  else base = Math.max(30, 50 - (d - 7) * 3);

  // Volume penalty — if 5+ sessions in last 7 days, reduce energy.
  if (s.sessionsLast7Days >= 5) base = Math.max(40, base - 15);

  return Math.round(clamp(base, 0, 100));
}

function scoreFuerza(s: ReadinessSignals, history: WorkoutHistoryEntry[], now: number): number {
  if (history.length === 0) return 70; // no data → mildly optimistic placeholder

  // Base from PRs in last 4 weeks: each PR adds 10 points (capped).
  const prBoost = Math.min(40, s.prsLast4Weeks * 10);

  // Volume trend — last 14d vs prior 14d. Up = +up to 20, flat = 0, down = -15.
  const last14d = now - 14 * MS_PER_DAY;
  const prior14d = now - 28 * MS_PER_DAY;
  let recentVol = 0;
  let priorVol = 0;
  for (const h of history) {
    const vol = Number.isFinite(h.totalVolume) ? h.totalVolume : 0;
    if (h.endedAt >= last14d) recentVol += vol;
    else if (h.endedAt >= prior14d) priorVol += vol;
  }

  let trend = 0;
  if (priorVol > 0) {
    const ratio = recentVol / priorVol;
    if (ratio >= 1.1) trend = 20;
    else if (ratio >= 0.95) trend = 5;
    else if (ratio >= 0.7) trend = -8;
    else trend = -15;
  } else if (recentVol > 0) {
    trend = 15; // building from zero
  }

  // Stale penalty — 4+ weeks with no PR is fatigue/plateau signal.
  let stale = 0;
  if (s.prsLast4Weeks === 0 && history.length >= 4) stale = -10;

  return Math.round(clamp(50 + prBoost + trend + stale, 20, 100));
}

function scoreRecuperacion(s: ReadinessSignals): number {
  // Each muscle group worked in last 48h drops recovery by 12 points.
  // Cap at 5 groups so the floor is 40 even after a wall-to-wall day.
  const penalty = Math.min(60, s.recentMuscleGroups.length * 12);
  return Math.round(clamp(100 - penalty, 40, 100));
}

// ── Headline ───────────────────────────────────────────────────────

function buildHeadline(
  scores: { energia: number; fuerza: number; recuperacion: number },
  s: ReadinessSignals,
): string {
  if (s.daysSinceLastWorkout === null) {
    return 'Bienvenido. Tu sistema empieza con tu primer entrenamiento.';
  }

  const min = Math.min(scores.energia, scores.fuerza, scores.recuperacion);
  const max = Math.max(scores.energia, scores.fuerza, scores.recuperacion);

  // High across the board — green-light day.
  if (min >= 75) return 'Día verde. Puedes ir fuerte hoy.';

  // Recovery is the bottleneck.
  if (scores.recuperacion === min && scores.recuperacion < 65) {
    return 'Recuperación baja. Hoy mejor sesión ligera o un grupo distinto.';
  }

  // Energy is the bottleneck.
  if (scores.energia === min && scores.energia < 60) {
    if (s.daysSinceLastWorkout >= 5) return 'Llevas días sin entrenar. Empieza suave.';
    if (s.sessionsLast7Days >= 5) return 'Mucha carga esta semana. Considera un descanso.';
    return 'Energía justa. Calienta bien antes de subir intensidad.';
  }

  // Strength stalled.
  if (scores.fuerza === min && scores.fuerza < 55) {
    return 'Progreso parado. Cambia el estímulo o baja volumen una semana.';
  }

  // Default mid-range.
  if (max < 70) return 'Día medio. Sesión estándar funciona bien.';
  return 'Estado decente. Sigue el plan.';
}

// ── Utility ────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
