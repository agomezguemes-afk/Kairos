// Hevy app CSV export parser.
//
// Hevy export header (one row per set):
//   title,start_time,end_time,description,exercise_title,superset_id,
//   exercise_notes,set_index,set_type,weight_kg,reps,distance_km,
//   duration_seconds,rpe
// Dates appear either as `29 Jul 2024, 17:01` (app exports) or ISO-ish
// `2024-07-29 17:01:32` (newer/web exports). Rows group by (title, start_time).

import { csvToRecords } from './csv';
import type { ImportedSet, ImportedWorkout, ImportParseResult } from './types';

export function looksLikeHevy(header: string[]): boolean {
  const h = header.map((x) => x.toLowerCase());
  return h.includes('exercise_title') && h.includes('start_time');
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseHevyDate(raw: string): number | null {
  if (!raw) return null;
  // "29 Jul 2024, 17:01"
  const app = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (app) {
    const month = MONTHS[app[2].toLowerCase()];
    if (month === undefined) return null;
    const d = new Date(Number(app[3]), month, Number(app[1]), Number(app[4]), Number(app[5]));
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  // "2024-07-29 17:01:32" / ISO
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    const d = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4]),
      Number(iso[5]),
      Number(iso[6] ?? '0'),
    );
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function num(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseHevyCsv(text: string): ImportParseResult {
  const { records } = csvToRecords(text);
  const warnings: string[] = [];
  const workouts = new Map<string, ImportedWorkout & { _exIndex: Map<string, number> }>();

  for (const rec of records) {
    const exerciseName = rec['exercise_title'];
    if (!exerciseName) continue;
    const startRaw = rec['start_time'] ?? '';
    const startedAt = parseHevyDate(startRaw);
    if (startedAt == null) {
      warnings.push(`Fila ignorada: fecha no reconocida "${startRaw}"`);
      continue;
    }
    const name = rec['title'] || 'Entrenamiento importado';

    const key = `${startRaw}|${name}`;
    let workout = workouts.get(key);
    if (!workout) {
      workout = {
        name,
        startedAt,
        endedAt: parseHevyDate(rec['end_time'] ?? ''),
        exercises: [],
        _exIndex: new Map(),
      };
      workouts.set(key, workout);
    }

    let exIdx = workout._exIndex.get(exerciseName);
    if (exIdx === undefined) {
      exIdx = workout.exercises.length;
      workout._exIndex.set(exerciseName, exIdx);
      workout.exercises.push({ name: exerciseName, sets: [] });
    }

    const setType = (rec['set_type'] ?? '').toLowerCase();
    const set: ImportedSet = {
      weight: num(rec['weight_kg']),
      reps: num(rec['reps']),
      ...(num(rec['rpe']) != null ? { rpe: num(rec['rpe'])! } : {}),
      ...(num(rec['distance_km']) != null ? { distanceKm: num(rec['distance_km'])! } : {}),
      ...(num(rec['duration_seconds']) != null
        ? { durationSec: num(rec['duration_seconds'])! }
        : {}),
      ...(setType === 'warmup' ? { isWarmup: true } : {}),
    };
    workout.exercises[exIdx].sets.push(set);
  }

  const list = [...workouts.values()].map(({ _exIndex, ...w }) => w);
  list.sort((a, b) => a.startedAt - b.startedAt);
  return { format: 'hevy', workouts: list, warnings };
}
