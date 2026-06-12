// Strong app CSV export parser.
//
// Classic Strong export header (one row per set):
//   Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,
//   Distance,Seconds,Notes,Workout Notes,RPE
// Variants seen in the wild: "Weight Unit" column, lb weights, localized
// duration ("1h 10m"), missing RPE. Rows are grouped into workouts by
// (Date, Workout Name).

import { csvToRecords } from './csv';
import type { ImportedSet, ImportedWorkout, ImportParseResult } from './types';

export function looksLikeStrong(header: string[]): boolean {
  const h = header.map((x) => x.toLowerCase());
  return h.includes('workout name') && (h.includes('set order') || h.includes('exercise name'));
}

// "2023-01-09 17:01:32" → epoch ms. Manual split keeps parsing engine-stable
// (Date.parse of non-ISO strings is implementation-defined).
function parseStrongDate(raw: string): number | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? '0'),
  );
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

// "1h 10m" / "45m" / "1h" / "70" (minutes) → seconds.
export function parseStrongDuration(raw: string): number | null {
  if (!raw) return null;
  const hm = raw.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/);
  if (hm && (hm[1] || hm[2])) {
    return Number(hm[1] ?? 0) * 3600 + Number(hm[2] ?? 0) * 60;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

function num(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  // Tolerate decimal commas from localized exports.
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const LB_TO_KG = 0.45359237;

export function parseStrongCsv(text: string): ImportParseResult {
  const { header, records } = csvToRecords(text);
  const warnings: string[] = [];
  // Key: `${dateRaw}|${workoutName}` preserving source order.
  const workouts = new Map<string, ImportedWorkout & { _exIndex: Map<string, number> }>();

  const headerLower = header.map((x) => x.toLowerCase());
  const weightIsLb = headerLower.includes('weight unit')
    ? false // per-row unit handled below
    : headerLower.some((x) => x.includes('(lb')); // "Weight (lbs)" variant

  for (const rec of records) {
    const dateRaw = rec['Date'] ?? '';
    const name = rec['Workout Name'] || 'Entrenamiento importado';
    const exerciseName = rec['Exercise Name'];
    if (!exerciseName) continue; // not a set row

    const startedAt = parseStrongDate(dateRaw);
    if (startedAt == null) {
      warnings.push(`Fila ignorada: fecha no reconocida "${dateRaw}"`);
      continue;
    }

    const key = `${dateRaw}|${name}`;
    let workout = workouts.get(key);
    if (!workout) {
      const durationSec = parseStrongDuration(rec['Duration'] ?? '');
      workout = {
        name,
        startedAt,
        endedAt: durationSec != null ? startedAt + durationSec * 1000 : null,
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

    let weight = num(rec['Weight']);
    const rowUnit = (rec['Weight Unit'] ?? '').toLowerCase();
    if (weight != null && (rowUnit.startsWith('lb') || (weightIsLb && !rowUnit))) {
      weight = Math.round(weight * LB_TO_KG * 100) / 100;
    }

    const setOrderRaw = (rec['Set Order'] ?? '').toUpperCase();
    const set: ImportedSet = {
      weight,
      reps: num(rec['Reps']),
      ...(num(rec['RPE']) != null ? { rpe: num(rec['RPE'])! } : {}),
      ...(num(rec['Distance']) != null ? { distanceKm: num(rec['Distance'])! } : {}),
      ...(num(rec['Seconds']) != null ? { durationSec: num(rec['Seconds'])! } : {}),
      // Strong marks warmups with "W" in Set Order ("W1", "W2"…).
      ...(setOrderRaw.startsWith('W') ? { isWarmup: true } : {}),
    };
    workout.exercises[exIdx].sets.push(set);
  }

  const list = [...workouts.values()].map(({ _exIndex, ...w }) => w);
  list.sort((a, b) => a.startedAt - b.startedAt);
  return { format: 'strong', workouts: list, warnings };
}
