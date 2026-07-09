import { beforeEach, describe, expect, it } from 'vitest';

import { ANALYTICS_EVENTS, getTrackedEventsByName, resetAnalytics } from '../analytics';
import type { WorkoutBlock } from '../../types/core';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import { buildHybridRaceBlock } from '../routines/hybridPreset';
import { exportHistoryCSV, exportSpaceJSON } from './exportData';

function historyEntry(overrides: Partial<WorkoutHistoryEntry> = {}): WorkoutHistoryEntry {
  return {
    id: 'h1',
    blockId: 'b1',
    blockName: 'Fuerza · Día A',
    startedAt: Date.UTC(2026, 6, 8, 10, 0, 0),
    endedAt: Date.UTC(2026, 6, 8, 11, 0, 0),
    exerciseCount: 1,
    setCount: 2,
    totalVolume: 1000,
    durationSec: 3600,
    exercises: [
      {
        exerciseId: 'e1',
        name: 'Press banca',
        maxWeight: 60,
        totalVolume: 1000,
        setsCompleted: 2,
        performedSets: [
          { weight: 60, reps: 8, completed: true, rpe: 7 },
          { weight: 62.5, reps: 6, completed: true, kind: 'working', notes: 'buena' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('exportSpaceJSON', () => {
  beforeEach(() => resetAnalytics());

  it('produces valid, lossless JSON of blocks and history', () => {
    const blocks: WorkoutBlock[] = [buildHybridRaceBlock()];
    const json = exportSpaceJSON({ blocks, history: [historyEntry()] });
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe('kairos_export');
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.history).toHaveLength(1);
  });

  it('keeps hybrid dynamic fields (distance/pace/kg) intact', () => {
    const block = buildHybridRaceBlock();
    const json = exportSpaceJSON({ blocks: [block], history: [] });
    // Dynamic fields survive verbatim — the "your data is yours" promise.
    expect(json).toContain('"pace"');
    expect(json).toContain('"distance"');
    expect(json).toContain('"weight"');
  });

  it('emits data_exported with format json and counts', () => {
    exportSpaceJSON({ blocks: [buildHybridRaceBlock()], history: [historyEntry()] });
    const ev = getTrackedEventsByName(ANALYTICS_EVENTS.data_exported)[0];
    expect(ev.props).toMatchObject({ format: 'json', blocks: 1, sessions: 1 });
  });
});

describe('exportHistoryCSV', () => {
  beforeEach(() => resetAnalytics());

  it('writes a header and one row per performed set', () => {
    const csv = exportHistoryCSV([historyEntry()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('fecha,bloque,ejercicio,serie,peso_kg,reps,completada,rpe,tipo,notas');
    expect(lines).toHaveLength(3); // header + 2 sets
    expect(lines[1]).toContain('2026-07-08');
    expect(lines[1]).toContain('Press banca');
  });

  it('escapes cells containing commas, quotes or newlines', () => {
    const entry = historyEntry();
    entry.exercises[0].performedSets![0].notes = 'dura, con "peto"';
    const csv = exportHistoryCSV([entry]);
    expect(csv).toContain('"dura, con ""peto"""');
  });

  it('falls back to a summary row when a session has no per-set detail', () => {
    const entry = historyEntry();
    delete entry.exercises[0].performedSets;
    const csv = exportHistoryCSV([entry]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 summary row
    expect(lines[1]).toContain('resumen');
    expect(lines[1]).toContain('2 series');
  });

  it('emits data_exported with format csv', () => {
    exportHistoryCSV([historyEntry()]);
    const ev = getTrackedEventsByName(ANALYTICS_EVENTS.data_exported)[0];
    expect(ev.props).toMatchObject({ format: 'csv', sessions: 1 });
  });
});
