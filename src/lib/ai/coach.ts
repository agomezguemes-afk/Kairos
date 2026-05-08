import { useWorkoutStore } from '../../store/workoutStore';
import type { WorkoutBlock, Discipline } from '../../types/core';
import type { AIAction, AIExerciseTemplate } from '../../types/ai';
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

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed?.name || !Array.isArray(parsed.exercises)) return null;
  const discipline: Discipline = VALID_DISCIPLINES.includes(parsed.discipline)
    ? parsed.discipline
    : 'strength';

  const exercises: AIExerciseTemplate[] = parsed.exercises.map((e: any) => ({
    name: String(e.name ?? 'Ejercicio'),
    sets_count: Number(e.sets_count) || 3,
    reps: e.reps ?? 10,
    rest_seconds: Number(e.rest_seconds) || 60,
  }));

  const action: AIAction = {
    type: 'create_block',
    payload: {
      name: String(parsed.name),
      discipline,
      exercises,
    },
  };

  const store = useWorkoutStore.getState();
  const blockId = store.dispatchAIActions([action]);
  if (!blockId) return null;
  if (parsed.description) {
    store.updateBlock(blockId, { description: String(parsed.description).slice(0, 280) });
  }
  return useWorkoutStore.getState().blocks.find((b) => b.id === blockId) ?? null;
}
