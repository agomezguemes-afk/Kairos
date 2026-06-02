// Kai inside the block editor: same agent loop as global chat, different
// system prompt, plus an extra "current block" context block so the model
// always knows which blockId to mutate.

import type { AIMessage } from '../../../types/ai';
import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats, generateId, getBlockExercises } from '../../../types/core';
import {
  buildUserContextSnapshot,
  renderContextForPrompt,
  type RawUserContext,
} from '../../../utils/userContext';
import { runAgent, AgentError, type AgentProgressFn } from '../agent';
import type { GroqMessage } from '../client';
import { isAIAvailable, GroqError, QuotaExceededError } from '../client';
import { filterExercises, renderExercisesForPrompt } from '../knowledge/exercises';
import { pickTemplates, renderTemplatesForPrompt } from '../prompts/templates';
import { BLOCK_EDITOR_SYSTEM } from '../prompts/system';
import { AIUnavailableError, type ChatHistoryItem } from './globalChat';

function buildBlockContext(block: WorkoutBlock): string {
  const stats = calculateBlockStats(block);
  const exercises = getBlockExercises(block);
  const lines: string[] = [];

  lines.push(`BLOQUE ACTUAL: [${block.id}] "${block.name}" (${block.discipline})`);
  if (block.description) lines.push(`Descripción: ${block.description}`);
  lines.push(
    `Progreso: ${stats.completion_percentage}% (${stats.completed_sets}/${stats.total_sets} series)`,
  );
  lines.push(`Volumen total: ${stats.total_volume}kg`);
  lines.push('');

  if (exercises.length === 0) {
    lines.push('EJERCICIOS: ninguno — el bloque está vacío.');
  } else {
    lines.push(`EJERCICIOS (${exercises.length}):`);
    exercises.forEach((ex, i) => {
      const completed = ex.sets.filter((s) => s.completed).length;
      lines.push(
        `${i + 1}. [${ex.id}] ${ex.name} — ${ex.sets.length} series (${completed} completadas)`,
      );
      ex.sets.forEach((set, si) => {
        const vals: string[] = [];
        for (const field of ex.fields) {
          const v = set.values[field.id];
          if (v !== null && v !== undefined && v !== 0) {
            vals.push(`${v}${field.unit ?? ''}`);
          }
        }
        const check = set.completed ? ' done' : '';
        if (vals.length > 0) lines.push(`   S${si + 1}: ${vals.join(' × ')}${check}`);
      });
    });
  }

  return lines.join('\n');
}

export interface BlockChatOptions {
  onProgress?: AgentProgressFn;
  signal?: AbortSignal;
}

export async function processBlockChat(
  userText: string,
  block: WorkoutBlock,
  rawContext: RawUserContext,
  history: ChatHistoryItem[] = [],
  options: BlockChatOptions = {},
): Promise<AIMessage> {
  if (!isAIAvailable()) {
    throw new AIUnavailableError(
      'AI no disponible: inicia sesión para usar Kai, o configura EXPO_PUBLIC_GROQ_API_KEY en .env para desarrollo.',
    );
  }

  const snapshot = buildUserContextSnapshot(rawContext);
  const profileContext = renderContextForPrompt(snapshot);
  const blockContext = buildBlockContext(block);
  const catalog = renderExercisesForPrompt(
    filterExercises({
      equipment: snapshot.profile.equipment as import('../../../types/profile').EquipmentTag[],
      injuries: snapshot.profile.injuries,
      discipline: block.discipline,
      queryKeywords: userText
        .toLowerCase()
        .split(/\W+/)
        .filter((s) => s.length > 2),
      limit: 18,
    }),
  );
  const templates = renderTemplatesForPrompt(pickTemplates(userText));
  const histText =
    history.length > 0
      ? '\n\nCONVERSACIÓN PREVIA:\n' +
        history
          .slice(-8)
          .map((m) => `${m.role === 'user' ? 'Usuario' : 'Kai'}: ${m.content}`)
          .join('\n')
      : '';
  const sections = [profileContext, blockContext, catalog, templates].filter(
    (s) => s && s.length > 0,
  );
  const userPrompt = `${sections.join('\n\n')}${histText}\n\nMENSAJE DEL USUARIO:\n${userText}`;

  const messages: GroqMessage[] = [
    { role: 'system', content: BLOCK_EDITOR_SYSTEM },
    { role: 'user', content: userPrompt },
  ];

  let result;
  try {
    result = await runAgent(messages, {
      temperature: 0.5,
      maxTokens: 2048,
      onProgress: options.onProgress,
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof QuotaExceededError) throw e;
    if (e instanceof AgentError || e instanceof GroqError) {
      throw new AIUnavailableError(`AI falló: ${e.message}`, e);
    }
    const detail = e instanceof Error ? e.message : String(e);
    throw new AIUnavailableError(`AI falló: ${detail}`, e);
  }

  return {
    id: generateId(),
    role: 'assistant',
    content: result.text,
    toolResults: result.toolResults,
    affectedBlockId: block.id,
    timestamp: Date.now(),
  };
}
