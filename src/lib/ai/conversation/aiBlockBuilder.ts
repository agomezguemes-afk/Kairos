// KAIROS — AI block builder for the conversational loop (device/runtime only).
//
// Materialises ONE session block from a brief using the existing agent + tool
// pipeline (create_block / add_exercise), with the same safety contract as
// onboardingSpace.ts: snapshot the store before the run, restore it on any
// failure, and fall back to the deterministic template builder. Generation of
// today's session NEVER fails — worst case the user gets the curated fallback.

import { runAgent } from '../agent';
import { isAIAvailable } from '../client';
import { useWorkoutStore } from '../../../store/workoutStore';
import type { WorkoutBlock } from '../../../types/core';
import { buildSessionBlockDeterministic, summarizeBlock } from './blockFromBrief';
import type { BuiltSession, SessionBrief } from './types';

const DEFAULT_TIMEOUT_MS = 9_000;
const HARD_CEILING_EXTRA_MS = 3_000;

const AGENT_SYSTEM_PROMPT = `Eres Kai, el copiloto de entrenamiento de KAIROS. Tu única tarea ahora es construir UN bloque de entrenamiento para HOY a partir del brief del usuario, usando las herramientas.

Reglas:
- Crea exactamente 1 bloque con create_block.
- Añade 4-6 ejercicios con add_exercise, apropiados al foco, material, sitio e intensidad del brief.
- Si no hay material o entrena en casa, usa solo ejercicios de peso corporal (salvo que mencione material concreto).
- Respeta la intensidad: "suave" = menos volumen y ejercicios de recuperación/movilidad; "fuerte" = más series/intensidad.
- Nombres de bloque y ejercicios en español, concretos y sobrios, sin emojis. Los ejercicios ya vienen con sets por defecto.
- No hagas preguntas ni expliques. Cuando termines, responde con una sola frase corta.`;

function describeBrief(brief: SessionBrief): string {
  const parts = [
    `Título sugerido: ${brief.title}.`,
    `Disciplina: ${brief.discipline}.`,
    brief.focus ? `Foco: ${brief.focus}.` : null,
    brief.durationMin ? `Duración: ~${brief.durationMin} min.` : null,
    brief.location ? `Sitio: ${brief.location}.` : null,
    `Intensidad: ${brief.intensity}.`,
    brief.equipment.length > 0
      ? `Material: ${brief.equipment.join(', ')}.`
      : 'Material: no especificado.',
    brief.notes ? `Notas: ${brief.notes}.` : null,
  ].filter(Boolean);
  return `${parts.join('\n')}\nConstruye su bloque de hoy ahora.`;
}

function newBlocksSince(snapshot: WorkoutBlock[]): WorkoutBlock[] {
  const known = new Set(snapshot.map((b) => b.id));
  return useWorkoutStore.getState().blocks.filter((b) => !known.has(b.id));
}

function isValidBlock(block: WorkoutBlock | undefined): boolean {
  if (!block) return false;
  const exercises = block.content.filter((n) => n.type === 'exercise');
  if (exercises.length < 2) return false;
  return exercises.every((n) => n.type === 'exercise' && n.data.exercise.sets.length >= 1);
}

function withHardCeiling<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('AI block hard timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Build today's block from the brief. Tries the real agent; on unavailability,
 * timeout, invalid output or any error, restores the store and returns the
 * deterministic template block instead. Never rejects.
 */
export async function buildSessionBlockViaAgent(
  brief: SessionBrief,
  opts: { timeoutMs?: number } = {},
): Promise<BuiltSession> {
  if (!isAIAvailable()) return buildSessionBlockDeterministic(brief);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const snapshot = useWorkoutStore.getState().blocks;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await withHardCeiling(
      runAgent(
        [
          { role: 'system', content: AGENT_SYSTEM_PROMPT },
          { role: 'user', content: describeBrief(brief) },
        ],
        { maxTurns: 10, temperature: 0.4, maxTokens: 1024, signal: controller.signal },
      ),
      timeoutMs + HARD_CEILING_EXTRA_MS,
    );

    const created = newBlocksSince(snapshot);
    const block = created[0];
    if (!isValidBlock(block)) throw new Error(`AI block invalid (${created.length} created)`);

    // Rename to the conversational title + mark favorite so it's the pick.
    useWorkoutStore
      .getState()
      .updateBlock(block.id, { name: brief.title || block.name, is_favorite: true });
    const summary = summarizeBlock(block.id, 'ai');
    if (!summary) throw new Error('AI block disappeared after commit');
    return summary;
  } catch {
    // Undo any partial tool commits before the deterministic fallback.
    useWorkoutStore.getState().replaceAllBlocks(snapshot);
    return buildSessionBlockDeterministic(brief);
  } finally {
    clearTimeout(abortTimer);
  }
}
