// src/lib/import/importWorkouts.ts
//
// L-D · Hybrid-tolerant CSV import (05 P1-6). The Strong/Hevy pipeline must map
// distance / time / pace columns to dynamic fields instead of dropping them —
// so the hybrid athlete keeps their FULL history, not just the strength sets.
//
// Each imported exercise's fields are derived from the columns that actually
// carry data across its sets: a bench-press row yields weight+reps, a treadmill
// row yields distance+duration. Nothing measured is discarded.

import type {
  Discipline,
  ExerciseCard,
  ExerciseSet,
  FieldDefinition,
  FieldValues,
  SetKind,
  WorkoutBlock,
} from '../../types/core';
import { createEmptySet, createExerciseCard, createWorkoutBlock } from '../../types/core';
import { createExerciseNode } from '../../types/content';
import type { ContentNode } from '../../types/content';
import { ANALYTICS_EVENTS, track } from '../analytics';
import { parseCsv } from './csv';

export type ImportFormat = 'strong' | 'hevy' | 'unknown';

export interface ImportResult {
  format: ImportFormat;
  blocks: WorkoutBlock[];
  warnings: string[];
  stats: {
    blocks: number;
    exercises: number;
    sets: number;
    /** Distinct dynamic fields preserved across the import (proof of tolerance). */
    fieldsPreserved: CanonField[];
  };
}

// ======================== FIELD MODEL ========================

type CanonField = 'weight' | 'reps' | 'distance' | 'duration' | 'pace';

const FIELD_TEMPLATES: Record<CanonField, Omit<FieldDefinition, 'order' | 'isPrimary'>> = {
  weight: {
    id: 'weight',
    name: 'Peso',
    type: 'number',
    unit: 'kg',
    isBase: true,
    step: 2.5,
    min: 0,
  },
  reps: { id: 'reps', name: 'Reps', type: 'number', unit: null, isBase: true, step: 1, min: 0 },
  distance: {
    id: 'distance',
    name: 'Distancia',
    type: 'number',
    unit: 'km',
    isBase: true,
    step: 0.1,
    min: 0,
  },
  duration: {
    id: 'duration',
    name: 'Tiempo',
    type: 'number',
    unit: 'sec',
    isBase: true,
    step: 1,
    min: 0,
  },
  pace: {
    id: 'pace',
    name: 'Ritmo',
    type: 'number',
    unit: 'min/km',
    isBase: true,
    step: 0.05,
    min: 0,
  },
};

// Order fields appear in a card, and the primacy order for picking the primary.
const FIELD_ORDER: CanonField[] = ['weight', 'distance', 'duration', 'pace', 'reps'];

// ======================== COLUMN ROLES ========================

type ColumnRole =
  | { kind: 'field'; field: CanonField }
  | { kind: 'date' }
  | { kind: 'workout' }
  | { kind: 'exercise' }
  | { kind: 'setOrder' }
  | { kind: 'setType' }
  | { kind: 'rpe' }
  | { kind: 'notes' }
  | { kind: 'ignore' };

const STRONG_COLUMNS: Record<string, ColumnRole> = {
  date: { kind: 'date' },
  'workout name': { kind: 'workout' },
  'exercise name': { kind: 'exercise' },
  'set order': { kind: 'setOrder' },
  weight: { kind: 'field', field: 'weight' },
  'weight (kg)': { kind: 'field', field: 'weight' },
  reps: { kind: 'field', field: 'reps' },
  distance: { kind: 'field', field: 'distance' },
  'distance (km)': { kind: 'field', field: 'distance' },
  'distance (m)': { kind: 'field', field: 'distance' },
  seconds: { kind: 'field', field: 'duration' },
  pace: { kind: 'field', field: 'pace' },
  rpe: { kind: 'rpe' },
  notes: { kind: 'notes' },
  duration: { kind: 'ignore' },
  'workout notes': { kind: 'ignore' },
};

const HEVY_COLUMNS: Record<string, ColumnRole> = {
  title: { kind: 'workout' },
  start_time: { kind: 'date' },
  exercise_title: { kind: 'exercise' },
  set_index: { kind: 'setOrder' },
  set_type: { kind: 'setType' },
  weight_kg: { kind: 'field', field: 'weight' },
  reps: { kind: 'field', field: 'reps' },
  distance_km: { kind: 'field', field: 'distance' },
  duration_seconds: { kind: 'field', field: 'duration' },
  pace: { kind: 'field', field: 'pace' },
  rpe: { kind: 'rpe' },
  end_time: { kind: 'ignore' },
  description: { kind: 'ignore' },
  superset_id: { kind: 'ignore' },
  exercise_notes: { kind: 'ignore' },
};

// ======================== FORMAT DETECTION ========================

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

export function detectFormat(headers: string[]): ImportFormat {
  const set = new Set(headers.map(normalizeHeader));
  if (set.has('exercise_title') || set.has('weight_kg') || set.has('title')) return 'hevy';
  if (set.has('exercise name') || set.has('set order') || set.has('workout name')) return 'strong';
  return 'unknown';
}

// ======================== VALUE PARSING ========================

/** Locale-tolerant number parse: handles "2,5" (decimal comma) and "1,000.5". */
function parseNum(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  let t = s.replace(/\s/g, '');
  if (t.includes('.') && t.includes(',')) {
    t = t.replace(/,/g, ''); // comma = thousands separator
  } else if (t.includes(',')) {
    t = t.replace(',', '.'); // comma = decimal separator
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toSetKind(raw: string): SetKind {
  const s = raw.trim().toLowerCase();
  if (s === 'warmup' || s === 'warm up' || s === 'w') return 'warmup';
  if (s === 'dropset' || s === 'drop set' || s === 'drop') return 'drop';
  if (s === 'failure' || s === 'f') return 'failure';
  return 'working';
}

function toEpoch(raw: string): number {
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? Date.now() : t;
}

function inferDiscipline(fields: CanonField[]): Discipline {
  if (fields.includes('weight')) return 'strength';
  if (fields.includes('distance') || fields.includes('pace')) return 'running';
  if (fields.includes('reps')) return 'calisthenics';
  return 'general';
}

// ======================== ROW MODEL ========================

interface ParsedRow {
  workout: string;
  date: string;
  exercise: string;
  setOrder: number | null;
  setType: string;
  rpe: number | null;
  notes: string;
  values: Partial<Record<CanonField, number>>;
}

interface CardBucket {
  name: string;
  rows: ParsedRow[];
}

interface WorkoutBucket {
  name: string;
  date: string;
  cards: Map<string, CardBucket>;
}

// ======================== CORE IMPORT ========================

function importRows(
  rows: string[][],
  columns: Record<string, ColumnRole>,
  format: ImportFormat,
): ImportResult {
  const warnings: string[] = [];
  const header = rows[0].map(normalizeHeader);

  // Warn about populated columns we don't understand (data isn't silently lost).
  const unknownCols = new Set<string>();

  const parsed: ParsedRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r];
    const pr: ParsedRow = {
      workout: '',
      date: '',
      exercise: '',
      setOrder: null,
      setType: '',
      rpe: null,
      notes: '',
      values: {},
    };
    for (let c = 0; c < header.length; c++) {
      const role = columns[header[c]];
      const cell = raw[c] ?? '';
      if (!role) {
        if (cell.trim() !== '') unknownCols.add(header[c]);
        continue;
      }
      switch (role.kind) {
        case 'workout':
          pr.workout = cell.trim();
          break;
        case 'date':
          pr.date = cell.trim();
          break;
        case 'exercise':
          pr.exercise = cell.trim();
          break;
        case 'setOrder':
          pr.setOrder = parseNum(cell);
          break;
        case 'setType':
          pr.setType = cell.trim();
          break;
        case 'rpe':
          pr.rpe = parseNum(cell);
          break;
        case 'notes':
          pr.notes = cell.trim();
          break;
        case 'field': {
          const n = parseNum(cell);
          if (n !== null) pr.values[role.field] = n;
          break;
        }
        case 'ignore':
        default:
          break;
      }
    }

    if (pr.exercise === '') {
      warnings.push(`Fila ${r + 1} ignorada: sin nombre de ejercicio.`);
      continue;
    }
    parsed.push(pr);
  }

  for (const col of unknownCols) {
    warnings.push(`Columna sin mapear conservada como nota: "${col}".`);
  }

  // Group → workout → exercise, preserving first-seen order.
  const workouts = new Map<string, WorkoutBucket>();
  for (const pr of parsed) {
    const wKey = `${pr.workout}__${pr.date}`;
    let w = workouts.get(wKey);
    if (!w) {
      w = { name: pr.workout || 'Sesión importada', date: pr.date, cards: new Map() };
      workouts.set(wKey, w);
    }
    let card = w.cards.get(pr.exercise);
    if (!card) {
      card = { name: pr.exercise, rows: [] };
      w.cards.set(pr.exercise, card);
    }
    card.rows.push(pr);
  }

  const blocks: WorkoutBlock[] = [];
  const fieldsPreserved = new Set<CanonField>();
  let exerciseCount = 0;
  let setCount = 0;

  let sortOrder = 0;
  for (const w of workouts.values()) {
    const epoch = toEpoch(w.date);
    const iso = new Date(epoch).toISOString();
    const block = createWorkoutBlock('user_001', sortOrder++, 'general', { name: w.name });

    const content: ContentNode[] = [];
    let order = 0;
    const cardDisciplines: CanonField[] = [];

    for (const card of w.cards.values()) {
      const present = FIELD_ORDER.filter((f) =>
        card.rows.some((row) => row.values[f] !== undefined),
      );
      // An exercise with no measured field still keeps a rep field so the card
      // isn't fieldless (edge: a logged-but-empty set).
      const usedFields = present.length > 0 ? present : (['reps'] as CanonField[]);
      for (const f of usedFields) fieldsPreserved.add(f);
      cardDisciplines.push(...usedFields);

      const fields: FieldDefinition[] = usedFields.map((f, i) => ({
        ...FIELD_TEMPLATES[f],
        order: i,
        isPrimary: i === 0,
      }));

      const discipline = inferDiscipline(usedFields);
      const base = createExerciseCard(block.id, order, discipline, { name: card.name, fields });

      const sets: ExerciseSet[] = card.rows.map((row, i) => {
        const values: FieldValues = {};
        for (const f of usedFields) values[f] = row.values[f] ?? null;
        const empty = createEmptySet(base.id, i, fields);
        const set: ExerciseSet = {
          ...empty,
          values,
          completed: true,
          completed_at: iso,
          kind: toSetKind(row.setType),
          notes: row.notes || null,
        };
        if (row.rpe !== null) set.rpe = row.rpe;
        return set;
      });
      setCount += sets.length;

      const finishedCard: ExerciseCard = {
        ...base,
        sets,
        default_sets_count: sets.length || base.default_sets_count,
      };
      content.push(createExerciseNode(order, finishedCard));
      order++;
      exerciseCount++;
    }

    blocks.push({
      ...block,
      content,
      discipline: inferDiscipline(cardDisciplines),
      status: 'completed',
      last_performed_at: iso,
      times_performed: 1,
      created_at: iso,
    });
  }

  track(ANALYTICS_EVENTS.data_imported, {
    format,
    blocks: blocks.length,
    exercises: exerciseCount,
    sets: setCount,
  });

  return {
    format,
    blocks,
    warnings,
    stats: {
      blocks: blocks.length,
      exercises: exerciseCount,
      sets: setCount,
      fieldsPreserved: FIELD_ORDER.filter((f) => fieldsPreserved.has(f)),
    },
  };
}

// ======================== PUBLIC API ========================

function emptyResult(format: ImportFormat, warning: string): ImportResult {
  return {
    format,
    blocks: [],
    warnings: [warning],
    stats: { blocks: 0, exercises: 0, sets: 0, fieldsPreserved: [] },
  };
}

export function parseStrongCSV(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return emptyResult('strong', 'CSV vacío o sin filas de datos.');
  return importRows(rows, STRONG_COLUMNS, 'strong');
}

export function parseHevyCSV(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return emptyResult('hevy', 'CSV vacío o sin filas de datos.');
  return importRows(rows, HEVY_COLUMNS, 'hevy');
}

/** Auto-detect Strong vs Hevy and import. Unknown formats fail with a warning. */
export function importWorkoutCSV(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return emptyResult('unknown', 'CSV vacío o sin filas de datos.');
  const format = detectFormat(rows[0]);
  if (format === 'strong') return importRows(rows, STRONG_COLUMNS, 'strong');
  if (format === 'hevy') return importRows(rows, HEVY_COLUMNS, 'hevy');
  return emptyResult('unknown', 'Formato no reconocido. Se admite export de Strong o Hevy.');
}
