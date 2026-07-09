// src/lib/export/exportData.ts
//
// Free, always-available data export (L-C anti-dark-pattern: "tus datos son
// tuyos"). Never gated. Two shapes:
//   · exportSpaceJSON  — lossless dump of blocks + history (full dynamic model)
//   · exportHistoryCSV — flat, per-set CSV for spreadsheets
//
// Pure string builders (+ a data_exported event). Data is passed in, so no
// store import — fully testable.

import type { WorkoutBlock } from '../../types/core';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import { ANALYTICS_EVENTS, track } from '../analytics';

export interface ExportInput {
  blocks: WorkoutBlock[];
  history: WorkoutHistoryEntry[];
}

const CSV_HEADER = [
  'fecha',
  'bloque',
  'ejercicio',
  'serie',
  'peso_kg',
  'reps',
  'completada',
  'rpe',
  'tipo',
  'notas',
] as const;

/** RFC-4180 cell: quote when the value holds a comma, quote or newline. */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Lossless JSON export — the canonical "your data is yours" artifact. Includes
 * every dynamic field, so a hybrid session's distance/pace/kg survive intact.
 */
export function exportSpaceJSON(input: ExportInput): string {
  const payload = {
    kind: 'kairos_export',
    version: 1,
    exportedAt: new Date().toISOString(),
    blocks: input.blocks,
    history: input.history,
  };
  track(ANALYTICS_EVENTS.data_exported, {
    format: 'json',
    blocks: input.blocks.length,
    sessions: input.history.length,
  });
  return JSON.stringify(payload, null, 2);
}

/**
 * Flat per-set CSV of workout history. One row per performed set; sessions with
 * no per-set snapshot fall back to a single summary row so nothing is dropped.
 */
export function exportHistoryCSV(history: WorkoutHistoryEntry[]): string {
  const rows: string[] = [CSV_HEADER.join(',')];

  for (const entry of history) {
    const date = isoDate(entry.startedAt);
    for (const ex of entry.exercises) {
      const performed = ex.performedSets;
      if (performed && performed.length > 0) {
        performed.forEach((s, i) => {
          rows.push(
            [
              csvCell(date),
              csvCell(entry.blockName),
              csvCell(ex.name),
              csvCell(i + 1),
              csvCell(s.weight),
              csvCell(s.reps),
              csvCell(s.completed ? 'sí' : 'no'),
              csvCell(s.rpe),
              csvCell(s.kind ?? 'working'),
              csvCell(s.notes),
            ].join(','),
          );
        });
      } else {
        // No per-set detail — keep the summary so the row count still reflects work.
        rows.push(
          [
            csvCell(date),
            csvCell(entry.blockName),
            csvCell(ex.name),
            csvCell(''),
            csvCell(ex.maxWeight || ''),
            csvCell(''),
            csvCell(''),
            csvCell(''),
            csvCell('resumen'),
            csvCell(`${ex.setsCompleted} series`),
          ].join(','),
        );
      }
    }
  }

  track(ANALYTICS_EVENTS.data_exported, { format: 'csv', sessions: history.length });
  return rows.join('\n');
}
