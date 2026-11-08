// Movement catalogue for plan drafting. Deliberately small and
// sport-tagged: the drafter picks from here, the user edits from there.

import type { Movement, Quality, Sport } from './types';

export const MOVEMENTS: Movement[] = [
  // ── General strength ─────────────────────────────────────────────
  {
    id: 'back_squat',
    name: 'Sentadilla trasera',
    kind: 'strength',
    sports: ['strength', 'hiking', 'football', 'padel', 'general'],
    qualities: ['strength'],
    incrementKg: 2.5,
    defaults: { sets: 3, repsMin: 6, repsMax: 8, rir: 2, loadKg: null },
    cue: 'Bajada controlada, rodillas siguiendo la punta del pie.',
  },
  {
    id: 'romanian_deadlift',
    name: 'Peso muerto rumano',
    kind: 'strength',
    sports: ['strength', 'hiking', 'climbing', 'running', 'general'],
    qualities: ['strength'],
    incrementKg: 2.5,
    defaults: { sets: 3, repsMin: 8, repsMax: 10, rir: 2, loadKg: null },
    cue: 'Cadera atrás, espalda neutra, barra pegada al cuerpo.',
  },
  {
    id: 'pull_up',
    name: 'Dominadas',
    kind: 'strength',
    sports: ['climbing', 'strength', 'general'],
    qualities: ['strength'],
    incrementKg: 1.25,
    defaults: { sets: 4, repsMin: 4, repsMax: 8, rir: 1, loadKg: 0 },
    cue: 'Escápulas abajo antes de tirar. Lastre cuando llegues al tope.',
  },
  {
    id: 'one_arm_row',
    name: 'Remo a una mano',
    kind: 'strength',
    sports: ['climbing', 'padel', 'tennis', 'strength', 'general'],
    qualities: ['strength'],
    incrementKg: 2,
    defaults: { sets: 3, repsMin: 8, repsMax: 12, rir: 2, loadKg: null },
    cue: 'Codo hacia la cadera, sin girar el tronco.',
  },
  {
    id: 'step_up',
    name: 'Step-up con carga',
    kind: 'strength',
    sports: ['hiking', 'running', 'football', 'general'],
    qualities: ['strength', 'endurance'],
    incrementKg: 2,
    defaults: { sets: 3, repsMin: 8, repsMax: 12, rir: 2, loadKg: null },
    cue: 'Empuja con la pierna de arriba, no rebotes con la de abajo.',
  },
  {
    id: 'split_squat',
    name: 'Sentadilla búlgara',
    kind: 'strength',
    sports: ['padel', 'tennis', 'football', 'basketball', 'running', 'hiking'],
    qualities: ['strength'],
    incrementKg: 2,
    defaults: { sets: 3, repsMin: 6, repsMax: 10, rir: 2, loadKg: null },
    cue: 'Tronco ligeramente inclinado, rodilla delantera estable.',
  },
  {
    id: 'calf_raise',
    name: 'Elevación de gemelos',
    kind: 'strength',
    sports: ['hiking', 'running', 'padel', 'basketball'],
    qualities: ['strength', 'endurance'],
    incrementKg: 2.5,
    defaults: { sets: 3, repsMin: 12, repsMax: 20, rir: 2, loadKg: null },
    cue: 'Pausa arriba un segundo, bajada lenta.',
  },

  // ── Climbing specific ────────────────────────────────────────────
  {
    id: 'max_hang',
    name: 'Suspensiones máximas',
    kind: 'strength',
    sports: ['climbing'],
    qualities: ['strength'],
    incrementKg: 1,
    defaults: { sets: 5, repsMin: 1, repsMax: 1, rir: 2, loadKg: 0 },
    cue: '10 s colgado en regleta de 20 mm, 3 min de descanso.',
  },
  {
    id: 'repeaters',
    name: 'Repeaters en multipresa',
    kind: 'interval',
    sports: ['climbing'],
    qualities: ['endurance'],
    defaults: { intervals: { reps: 6, workSec: 7, restSec: 3 }, sets: 4 },
    cue: '7 s colgado / 3 s descanso. Para si pierdes la posición.',
  },
  {
    id: 'core_lever',
    name: 'Elevación de piernas colgado',
    kind: 'strength',
    sports: ['climbing', 'general'],
    qualities: ['strength'],
    defaults: { sets: 3, repsMin: 6, repsMax: 12, rir: 2, loadKg: 0 },
    cue: 'Sin balanceo; sube la pelvis, no solo las piernas.',
  },

  // ── Racket sports ────────────────────────────────────────────────
  {
    id: 'court_intervals',
    name: 'Intervalos de pista 30/30',
    kind: 'interval',
    sports: ['padel', 'tennis', 'basketball', 'football'],
    qualities: ['endurance', 'speed'],
    defaults: { intervals: { reps: 10, workSec: 30, restSec: 30 }, zone: 4 },
    cue: 'Desplazamientos de partido a ritmo alto, recupera andando.',
  },
  {
    id: 'lateral_shuffle',
    name: 'Desplazamientos laterales + split-step',
    kind: 'interval',
    sports: ['padel', 'tennis', 'basketball'],
    qualities: ['speed', 'power'],
    defaults: { intervals: { reps: 8, workSec: 15, restSec: 45 } },
    cue: 'Split-step antes de cada cambio, pies activos.',
  },
  {
    id: 'rotational_throw',
    name: 'Lanzamiento rotacional con balón',
    kind: 'strength',
    sports: ['padel', 'tennis', 'climbing', 'general'],
    qualities: ['power'],
    incrementKg: 1,
    defaults: { sets: 4, repsMin: 5, repsMax: 6, rir: 3, loadKg: 4 },
    cue: 'La fuerza nace de la cadera, el brazo solo acompaña.',
  },

  // ── Endurance ────────────────────────────────────────────────────
  {
    id: 'easy_run',
    name: 'Carrera suave Z2',
    kind: 'steady',
    sports: ['running', 'padel', 'football', 'hiking', 'tennis', 'general'],
    qualities: ['endurance'],
    defaults: { durationMin: 30, zone: 2 },
    cue: 'Ritmo en el que puedes hablar con frases completas.',
  },
  {
    id: 'run_intervals',
    name: 'Series 4×4 min',
    kind: 'interval',
    sports: ['running', 'football', 'padel', 'general'],
    qualities: ['endurance', 'speed'],
    defaults: { intervals: { reps: 4, workSec: 240, restSec: 180 }, zone: 4 },
    cue: 'Duro pero sostenible; las 4 series al mismo ritmo.',
  },
  {
    id: 'long_run',
    name: 'Tirada larga',
    kind: 'steady',
    sports: ['running'],
    qualities: ['endurance'],
    defaults: { durationMin: 50, distanceKm: 8, zone: 2 },
    cue: 'Constante de principio a fin; mejor terminar con ganas.',
  },
  {
    id: 'loaded_hike',
    name: 'Ruta con mochila cargada',
    kind: 'steady',
    sports: ['hiking'],
    qualities: ['endurance', 'strength'],
    defaults: { durationMin: 90, distanceKm: 6, zone: 2, loadKg: 6 },
    cue: 'Desnivel positivo si puedes; bastones opcionales.',
  },
  {
    id: 'z2_ride',
    name: 'Rodaje Z2 en bici',
    kind: 'steady',
    sports: ['cycling', 'hiking', 'running', 'general'],
    qualities: ['endurance'],
    defaults: { durationMin: 45, zone: 2, cadenceRpm: 85 },
    cue: 'Cadencia fluida 85–95 rpm, sin picos de esfuerzo.',
  },
  {
    id: 'sweet_spot',
    name: 'Bloques sweet spot',
    kind: 'interval',
    sports: ['cycling'],
    qualities: ['endurance'],
    defaults: { intervals: { reps: 3, workSec: 600, restSec: 300 }, zone: 3, cadenceRpm: 90 },
    cue: 'Esfuerzo 8/10 sostenido; respiración profunda pero controlada.',
  },
  {
    id: 'swim_aerobic',
    name: 'Nado aeróbico continuo',
    kind: 'steady',
    sports: ['swimming'],
    qualities: ['endurance', 'technique'],
    defaults: { durationMin: 30, distanceKm: 1, zone: 2 },
    cue: 'Prioriza técnica: brazada larga, respiración bilateral.',
  },

  // ── Power / speed ────────────────────────────────────────────────
  {
    id: 'box_jump',
    name: 'Saltos al cajón',
    kind: 'strength',
    sports: ['football', 'basketball', 'padel', 'tennis', 'general'],
    qualities: ['power'],
    defaults: { sets: 4, repsMin: 3, repsMax: 5, rir: 3, loadKg: 0 },
    cue: 'Aterriza suave y en silencio; baja andando.',
  },
  {
    id: 'sprints',
    name: 'Sprints 10×20 m',
    kind: 'interval',
    sports: ['football', 'basketball', 'running', 'general'],
    qualities: ['speed', 'power'],
    defaults: { intervals: { reps: 10, workSec: 4, restSec: 60 }, zone: 5 },
    cue: 'Máxima velocidad, descanso completo entre repeticiones.',
  },

  // ── Mobility ─────────────────────────────────────────────────────
  {
    id: 'hip_mobility',
    name: 'Movilidad de cadera',
    kind: 'mobility',
    sports: ['general', 'hiking', 'running', 'climbing', 'football', 'padel'],
    qualities: ['mobility'],
    defaults: { durationMin: 10 },
    cue: '90/90, rana y cosaco; respira en cada posición.',
  },
  {
    id: 'shoulder_mobility',
    name: 'Movilidad de hombro',
    kind: 'mobility',
    sports: ['climbing', 'padel', 'tennis', 'swimming', 'general'],
    qualities: ['mobility'],
    defaults: { durationMin: 10 },
    cue: 'Dislocaciones con banda y rotaciones externas lentas.',
  },
];

const BY_ID = new Map(MOVEMENTS.map((m) => [m.id, m]));

export function getMovement(id: string): Movement | undefined {
  return BY_ID.get(id);
}

/** Movements that fit sport+quality, most sport-specific first. */
export function findMovements(sport: Sport, quality: Quality): Movement[] {
  return MOVEMENTS.filter((m) => m.qualities.includes(quality))
    .filter((m) => m.sports.includes(sport) || m.sports.includes('general'))
    .sort((a, b) => {
      const sa = a.sports.includes(sport) ? 0 : 1;
      const sb = b.sports.includes(sport) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      // Primary quality first: a movement whose first tag is the asked
      // quality is more on-target than one that merely includes it.
      const pa = a.qualities[0] === quality ? 0 : 1;
      const pb = b.qualities[0] === quality ? 0 : 1;
      return pa - pb;
    });
}
