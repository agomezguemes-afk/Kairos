// Free-form coach + one-shot routine generator.
//
// `callCoach` is plain text — used by the Plateau insights surface and any
// "ask Kai a question" flow that does NOT need tool calls.
//
// `generateWorkoutPlan` is a one-shot JSON-mode generator that calls Groq
// once and then executes store mutations directly (no agent loop). It's the
// "Generar rutina" form inside BlockAISheet.

import { useWorkoutStore } from '../../store/workoutStore';
import type { WorkoutBlock, Discipline } from '../../types/core';
import { callGroq, type GroqMessage } from './client';
import { ROUTINE_GENERATOR_SYSTEM, buildCoachChatSystem } from './prompts/system';

const VALID_DISCIPLINES: readonly Discipline[] = [
  'strength', 'running', 'calisthenics', 'mobility',
  'team_sport', 'cycling', 'swimming', 'general',
];

interface UserSnapshot {
  blocksCount: number;
  favoriteBlocks: string[];
  recentSessions: { block: string; date: string; sets: number; volume: number }[];
  injuries?: string;
  goal?: string;
}

function buildUserSnapshot(): UserSnapshot {
  const s = useWorkoutStore.getState();
  return {
    blocksCount: s.blocks.length,
    favoriteBlocks: s.blocks.filter((b) => b.is_favorite).map((b) => b.name).slice(0, 3),
    recentSessions: s.workoutHistory.slice(0, 5).map((h) => ({
      block: h.blockName,
      date: new Date(h.startedAt).toISOString().slice(0, 10),
      sets: h.setCount,
      volume: Math.round(h.totalVolume),
    })),
  };
}

export function buildSystemPrompt(history?: GroqMessage[]): string {
  const userData = buildUserSnapshot();
  const histText = history && history.length > 0
    ? '\n\nHISTORIAL RECIENTE:\n' + history.slice(-6).map((m) => {
        const role = 'role' in m ? m.role : 'user';
        const content = 'content' in m ? (m.content ?? '') : '';
        return `${role}: ${content}`;
      }).join('\n')
    : '';
  return buildCoachChatSystem({
    userDataJson: JSON.stringify(userData, null, 2),
    historyText: histText,
  });
}

export async function callCoach(userMessage: string, history?: GroqMessage[]): Promise<string> {
  const system = buildSystemPrompt(history);
  return callGroq(
    [
      { role: 'system', content: system },
      ...(history ?? []),
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.6, maxTokens: 900 },
  );
}

export interface PlanPreferences {
  objetivo: string;
  días: number;
  duración: number;
  lesiones?: string[];
}

interface RawPlanExercise {
  name?: unknown;
  sets_count?: unknown;
  reps?: unknown;
  rest_seconds?: unknown;
}

function coerceReps(v: unknown): number | string {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return 10;
}

function coerceInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

export async function generateWorkoutPlan(prefs: PlanPreferences): Promise<WorkoutBlock | null> {
  const user = `Crea UN bloque de entrenamiento.
Objetivo: ${prefs.objetivo}.
Días/semana: ${prefs.días}.
Minutos por sesión: ${prefs.duración}.
Lesiones: ${prefs.lesiones && prefs.lesiones.length > 0 ? prefs.lesiones.join(', ') : 'ninguna'}.`;

  const raw = await callGroq(
    [
      { role: 'system', content: ROUTINE_GENERATOR_SYSTEM },
      { role: 'user', content: user },
    ],
    { jsonMode: true, temperature: 0.5, maxTokens: 1500 },
  );

  let parsed: { name?: unknown; discipline?: unknown; description?: unknown; exercises?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed?.name !== 'string' || !Array.isArray(parsed.exercises)) return null;
  const discipline: Discipline = VALID_DISCIPLINES.includes(parsed.discipline as Discipline)
    ? (parsed.discipline as Discipline)
    : 'strength';

  const store = useWorkoutStore.getState();
  const blockId = store.addBlock(discipline, { name: String(parsed.name) });
  if (typeof parsed.description === 'string') {
    store.updateBlock(blockId, { description: parsed.description.slice(0, 280) });
  }

  // Append exercises and fill reps + rest.
  const rawExercises = parsed.exercises as RawPlanExercise[];
  for (const e of rawExercises) {
    const name = typeof e.name === 'string' ? e.name : 'Ejercicio';
    const setsCount = coerceInt(e.sets_count, 3);
    const rest = coerceInt(e.rest_seconds, 60);
    const reps = coerceReps(e.reps);
    store.addExercise(blockId, { name, discipline });
    const fresh = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
    if (!fresh) continue;
    const nodes = fresh.content.filter((n) => n.type === 'exercise');
    const last = nodes[nodes.length - 1];
    if (!last || last.type !== 'exercise') continue;
    const card = last.data.exercise;
    store.updateExercise(blockId, card.id, {
      rest_seconds: rest,
      default_sets_count: setsCount,
    });
    // Adjust set count.
    if (setsCount > card.sets.length) {
      for (let i = 0; i < setsCount - card.sets.length; i += 1) {
        store.addSet(blockId, card.id);
      }
    } else if (setsCount < card.sets.length) {
      const after = useWorkoutStore.getState().blocks
        .find((b) => b.id === blockId)
        ?.content.find((n) => n.type === 'exercise' && n.data.exercise.id === card.id);
      if (after && after.type === 'exercise') {
        const drop = after.data.exercise.sets.slice(setsCount);
        for (const s of drop) store.removeSet(blockId, card.id, s.id);
      }
    }
    // Pre-fill reps in every set.
    const after = useWorkoutStore.getState().blocks
      .find((b) => b.id === blockId)
      ?.content.find((n) => n.type === 'exercise' && n.data.exercise.id === card.id);
    if (after && after.type === 'exercise') {
      for (const s of after.data.exercise.sets) {
        store.updateSetValue(blockId, card.id, s.id, 'reps', reps);
      }
    }
  }

  return useWorkoutStore.getState().blocks.find((b) => b.id === blockId) ?? null;
}
