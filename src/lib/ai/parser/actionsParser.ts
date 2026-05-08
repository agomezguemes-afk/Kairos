// Boundary parser for the JSON-mode `{ message, actions[] }` envelope used
// by the global chat and block-editor surfaces. Anything that fails the
// shape check is dropped (per-action) rather than raised — invalid actions
// must never reach the store.
//
// Note: this is the legacy parser. Fase 1 introduces tool-call validation
// via valibot; this file stays only for the JSON-mode chat path until the
// chat is migrated to tool calling.

import type { AIAction, AIExerciseTemplate } from '../../../types/ai';
import type { Discipline } from '../../../types/core';
import { GroqError } from '../client';

const VALID_DISCIPLINES: readonly Discipline[] = [
  'strength',
  'running',
  'calisthenics',
  'mobility',
  'team_sport',
  'cycling',
  'swimming',
  'general',
];

export interface ParsedAIResponse {
  message: string;
  actions: AIAction[];
}

export function parseResponse(raw: string): ParsedAIResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Some models still wrap JSON in ```json fences despite response_format.
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new GroqError('Respuesta no parseable como JSON', e);
    }
  }

  if (!isObject(parsed)) throw new GroqError('La respuesta no es un objeto JSON');

  const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
  if (!message) throw new GroqError('La respuesta no contiene "message"');

  const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: AIAction[] = [];
  for (const candidate of rawActions) {
    const normalized = normalizeAction(candidate);
    if (normalized) actions.push(normalized);
  }

  return { message, actions };
}

// ======================== NORMALIZERS ========================

function normalizeAction(value: unknown): AIAction | null {
  if (!isObject(value)) return null;
  const type = value.type;
  const payload = isObject(value.payload) ? value.payload : null;
  if (typeof type !== 'string' || !payload) return null;

  switch (type) {
    case 'create_block':
      return normalizeCreateBlock(payload);
    case 'add_exercise':
      return normalizeAddExercise(payload);
    case 'update_exercise':
      return normalizeUpdateExercise(payload);
    case 'delete_exercise':
      return normalizeDeleteExercise(payload);
    case 'update_block_meta':
      return normalizeUpdateBlockMeta(payload);
    case 'delete_block':
      return normalizeDeleteBlock(payload);
    default:
      return null;
  }
}

function normalizeCreateBlock(payload: Record<string, unknown>): AIAction | null {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const discipline = coerceDiscipline(payload.discipline);
  if (!name || !discipline) return null;

  const exercises: AIExerciseTemplate[] = [];
  if (Array.isArray(payload.exercises)) {
    for (const ex of payload.exercises) {
      if (!isObject(ex)) continue;
      const exName = typeof ex.name === 'string' ? ex.name.trim() : '';
      if (!exName) continue;
      exercises.push({
        name: exName,
        discipline: coerceDiscipline(ex.discipline) ?? discipline,
        sets_count: coerceNumber(ex.sets_count),
        reps: coerceReps(ex.reps),
        rest_seconds: coerceNumber(ex.rest_seconds),
      });
    }
  }

  return { type: 'create_block', payload: { name, discipline, exercises } };
}

function normalizeAddExercise(payload: Record<string, unknown>): AIAction | null {
  const blockId = typeof payload.blockId === 'string' ? payload.blockId.trim() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!blockId || !name) return null;
  return {
    type: 'add_exercise',
    payload: {
      blockId,
      name,
      discipline: coerceDiscipline(payload.discipline),
      sets_count: coerceNumber(payload.sets_count),
      reps: coerceReps(payload.reps),
      rest_seconds: coerceNumber(payload.rest_seconds),
    },
  };
}

function normalizeUpdateExercise(payload: Record<string, unknown>): AIAction | null {
  const exerciseId = typeof payload.exerciseId === 'string' ? payload.exerciseId.trim() : '';
  const updatesRaw = isObject(payload.updates) ? payload.updates : null;
  if (!exerciseId || !updatesRaw) return null;

  const updates: { name?: string; notes?: string; rest_seconds?: number; default_sets_count?: number } = {};
  if (typeof updatesRaw.name === 'string') updates.name = updatesRaw.name.trim();
  if (typeof updatesRaw.notes === 'string') updates.notes = updatesRaw.notes.trim();
  if (typeof updatesRaw.rest_seconds === 'number') updates.rest_seconds = updatesRaw.rest_seconds;
  if (typeof updatesRaw.default_sets_count === 'number') updates.default_sets_count = updatesRaw.default_sets_count;

  if (Object.keys(updates).length === 0) return null;
  return { type: 'update_exercise', payload: { exerciseId, updates } };
}

function normalizeDeleteExercise(payload: Record<string, unknown>): AIAction | null {
  const blockId = typeof payload.blockId === 'string' ? payload.blockId.trim() : '';
  const exerciseId = typeof payload.exerciseId === 'string' ? payload.exerciseId.trim() : '';
  if (!blockId || !exerciseId) return null;
  return { type: 'delete_exercise', payload: { blockId, exerciseId } };
}

function normalizeUpdateBlockMeta(payload: Record<string, unknown>): AIAction | null {
  const blockId = typeof payload.blockId === 'string' ? payload.blockId.trim() : '';
  const updatesRaw = isObject(payload.updates) ? payload.updates : null;
  if (!blockId || !updatesRaw) return null;

  const updates: { name?: string; description?: string } = {};
  if (typeof updatesRaw.name === 'string') updates.name = updatesRaw.name.trim();
  if (typeof updatesRaw.description === 'string') updates.description = updatesRaw.description.trim();
  if (Object.keys(updates).length === 0) return null;
  return { type: 'update_block_meta', payload: { blockId, updates } };
}

function normalizeDeleteBlock(payload: Record<string, unknown>): AIAction | null {
  const blockId = typeof payload.blockId === 'string' ? payload.blockId.trim() : '';
  if (!blockId) return null;
  return { type: 'delete_block', payload: { blockId } };
}

// ======================== HELPERS ========================

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function coerceDiscipline(v: unknown): Discipline | undefined {
  if (typeof v !== 'string') return undefined;
  const lower = v.toLowerCase() as Discipline;
  return VALID_DISCIPLINES.includes(lower) ? lower : undefined;
}

function coerceNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function coerceReps(v: unknown): number | string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return undefined;
}
