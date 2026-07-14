// Kai's generative onboarding. Tries the real agent (existing tool pipeline)
// to build a personalized space from the user's answers; falls back to the
// curated starter templates on timeout, quota, validation failure or any
// transport error. The fallback is the contract: onboarding NEVER fails.
//
// Safety model: agent tools commit to the store synchronously mid-loop, so a
// failed/aborted run can leave partial blocks behind. We snapshot the block
// list before the run and restore it before applying the template fallback.

import { runAgent } from './agent';
import { isAIAvailable } from './client';
import { useWorkoutStore } from '../../store/workoutStore';
import { applyStarterSpace, type StarterSpaceResult } from '../routines/generateStarterRoutine';
import { STARTER_DISCIPLINES, type StarterAnswers } from '../routines/starterTemplates';
import { computeWeekAssignments } from '../routines/weekAssignments';
import { ANALYTICS_EVENTS, track } from '../analytics';
import { canonicalizeBlock, selectVocabularyForBrief } from './conversation/canonicalizeExercises';
import { buildVocabularyInstruction } from './conversation/prompts';
import type { WorkoutBlock } from '../../types/core';

const DEFAULT_TIMEOUT_MS = 9_000;
// Hard ceiling in case the abort signal fails to propagate through a hung
// transport — the user is staring at the closing animation, never block them.
const HARD_CEILING_EXTRA_MS = 3_000;

// Integration contract (docs/ai-board/BACKLOG.md): the Reveal paints
// blocks + weekAssignments; completeOnboarding(result) commits the week.
export interface OnboardingSpaceResult extends StarterSpaceResult {
  source: 'ai' | 'template';
  /** Wall-clock time of the full generation (AI attempt + fallback included). */
  durationMs: number;
}

const SYSTEM_PROMPT = `Eres Kai, el copiloto de entrenamiento de KAIROS. Tu única tarea ahora es construir el primer espacio de entrenamiento de un usuario nuevo usando las herramientas disponibles.

Reglas:
- Crea exactamente 1 bloque (2 si entrena 4+ días/semana: día A y día B).
- Cada bloque: 4-6 ejercicios apropiados para su disciplina, nivel y material disponible.
- Usa create_block y add_exercise. Los ejercicios ya se crean con sets por defecto.
- Nombres de bloques y ejercicios en español, concretos y sobrios (sin emojis).
- Si el usuario no tiene material, usa solo ejercicios de peso corporal.
- No hagas preguntas. No expliques. Cuando termines, responde con una sola frase corta de bienvenida.`;

/** Base rules + the discipline-biased canonical vocabulary (name reuse → the
 * progression memory can match these blocks against future history). */
function systemPrompt(answers: StarterAnswers): string {
  const coreDiscipline =
    STARTER_DISCIPLINES.find((d) => d.id === answers.discipline)?.coreDiscipline ?? 'general';
  const vocab = buildVocabularyInstruction(
    selectVocabularyForBrief({ discipline: coreDiscipline, focus: null }),
  );
  return vocab.length > 0 ? `${SYSTEM_PROMPT}\n\n${vocab}` : SYSTEM_PROMPT;
}

function describeAnswers(answers: StarterAnswers, userName: string): string {
  const d = STARTER_DISCIPLINES.find((x) => x.id === answers.discipline);
  const equipment =
    answers.equipment.length > 0 ? answers.equipment.join(', ') : 'sin material (peso corporal)';
  const level = { beginner: 'principiante', intermediate: 'intermedio', advanced: 'avanzado' }[
    answers.level
  ];
  return `Usuario nuevo: ${userName || 'sin nombre'}.
Disciplina principal: ${d?.label ?? answers.discipline}.
Nivel: ${level}.
Frecuencia: ${answers.frequency} días/semana.
Material: ${equipment}.
Construye su espacio ahora.`;
}

function newBlocksSince(snapshot: WorkoutBlock[]): WorkoutBlock[] {
  const known = new Set(snapshot.map((b) => b.id));
  return useWorkoutStore.getState().blocks.filter((b) => !known.has(b.id));
}

function isValidSpace(blocks: WorkoutBlock[]): boolean {
  if (blocks.length === 0) return false;
  return blocks.every((b) => {
    const exercises = b.content.filter((n) => n.type === 'exercise');
    if (exercises.length < 2) return false;
    return exercises.every((n) => n.type === 'exercise' && n.data.exercise.sets.length >= 1);
  });
}

/**
 * Build the user's first space. Resolves with the template fallback when the
 * AI path is unavailable, slow, over quota or produces an invalid space.
 * Never rejects.
 */
export async function generateOnboardingSpace(
  answers: StarterAnswers,
  opts: { userName?: string; timeoutMs?: number } = {},
): Promise<OnboardingSpaceResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  if (!isAIAvailable()) {
    return applyTemplate(answers, startedAt);
  }

  const snapshot = useWorkoutStore.getState().blocks;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await withHardCeiling(
      runAgent(
        [
          { role: 'system', content: systemPrompt(answers) },
          { role: 'user', content: describeAnswers(answers, opts.userName ?? '') },
        ],
        { maxTurns: 10, temperature: 0.4, maxTokens: 1024, signal: controller.signal },
      ),
      timeoutMs + HARD_CEILING_EXTRA_MS,
    );

    const created = newBlocksSince(snapshot);
    if (!isValidSpace(created)) {
      throw new Error(`AI space invalid (${created.length} blocks)`);
    }

    const store = useWorkoutStore.getState();
    // Speak the memory's vocabulary: canonical names + libraryIds mean this
    // space's exercises correlate with all future history from day one.
    for (const b of created) {
      const canonical = canonicalizeBlock(b);
      if (canonical !== b) store.updateBlock(b.id, { content: canonical.content });
    }
    store.updateBlock(created[0].id, { is_favorite: true });
    const blockIds = created.map((b) => b.id);
    const idSet = new Set(blockIds);
    // Re-read so `blocks` reflects the is_favorite commit above.
    const blocks = useWorkoutStore.getState().blocks.filter((b) => idSet.has(b.id));
    return finalize(
      {
        blocks,
        weekAssignments: computeWeekAssignments(blockIds, answers.frequency),
        blockIds,
        firstBlockId: created[0].id,
        source: 'ai',
      },
      startedAt,
    );
  } catch (e) {
    // Partial tool commits from the failed run must not survive.
    useWorkoutStore.getState().replaceAllBlocks(snapshot);
    if (__DEV__) console.warn('Kai onboarding: AI path failed, using template', e);
    return applyTemplate(answers, startedAt);
  } finally {
    clearTimeout(abortTimer);
  }
}

function applyTemplate(answers: StarterAnswers, startedAt: number): OnboardingSpaceResult {
  const result = applyStarterSpace(answers);
  if (!result) {
    // Unreachable with a valid discipline — but never strand the user.
    const fallback = applyStarterSpace({ ...answers, discipline: 'hybrid' })!;
    return finalize({ ...fallback, source: 'template' }, startedAt);
  }
  return finalize({ ...result, source: 'template' }, startedAt);
}

function finalize(
  result: Omit<OnboardingSpaceResult, 'durationMs'>,
  startedAt: number,
): OnboardingSpaceResult {
  const durationMs = Date.now() - startedAt;
  track(ANALYTICS_EVENTS.spaceGenerated, {
    source: result.source,
    duration_ms: durationMs,
    blocks: result.blocks.length,
    sessions_per_week: result.weekAssignments.length,
  });
  return { ...result, durationMs };
}

function withHardCeiling<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('AI generation hard timeout')), ms);
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
