// Kai inside the block editor: same parser as global chat, different system
// prompt and an extra "current block" context block. Was src/services/blockAIService.ts.

import type { AIMessage } from '../../../types/ai';
import type { WorkoutBlock } from '../../../types/core';
import { calculateBlockStats, generateId, getBlockExercises } from '../../../types/core';
import {
  buildUserContextSnapshot,
  renderContextForPrompt,
  type RawUserContext,
} from '../../../utils/userContext';
import { callGroq, isGroqAvailable } from '../client';
import { BLOCK_EDITOR_SYSTEM } from '../prompts/system';
import { parseResponse } from '../parser/actionsParser';
import { AIUnavailableError, type ChatHistoryItem } from './globalChat';

function buildBlockContext(block: WorkoutBlock): string {
  const stats = calculateBlockStats(block);
  const exercises = getBlockExercises(block);
  const lines: string[] = [];

  lines.push(`BLOQUE ACTUAL: [${block.id}] "${block.name}" (${block.discipline})`);
  if (block.description) lines.push(`Descripción: ${block.description}`);
  lines.push(`Progreso: ${stats.completion_percentage}% (${stats.completed_sets}/${stats.total_sets} series)`);
  lines.push(`Volumen total: ${stats.total_volume}kg`);
  lines.push('');

  if (exercises.length === 0) {
    lines.push('EJERCICIOS: ninguno — el bloque está vacío.');
  } else {
    lines.push(`EJERCICIOS (${exercises.length}):`);
    exercises.forEach((ex, i) => {
      const completed = ex.sets.filter((s) => s.completed).length;
      lines.push(`${i + 1}. [${ex.id}] ${ex.name} — ${ex.sets.length} series (${completed} completadas)`);
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

export async function processBlockChat(
  userText: string,
  block: WorkoutBlock,
  rawContext: RawUserContext,
  history: ChatHistoryItem[] = [],
): Promise<AIMessage> {
  if (!isGroqAvailable()) {
    throw new AIUnavailableError(
      'No hay clave de Groq configurada (EXPO_PUBLIC_GROQ_API_KEY).',
    );
  }

  const snapshot = buildUserContextSnapshot(rawContext);
  const profileContext = renderContextForPrompt(snapshot);
  const blockContext = buildBlockContext(block);
  const histText = history.length > 0
    ? '\n\nCONVERSACIÓN PREVIA:\n' +
      history.slice(-8).map((m) => `${m.role === 'user' ? 'Usuario' : 'Kai'}: ${m.content}`).join('\n')
    : '';
  const userPrompt = `${profileContext}\n\n${blockContext}${histText}\n\nMENSAJE DEL USUARIO:\n${userText}`;

  let raw: string;
  try {
    raw = await callGroq(
      [
        { role: 'system', content: BLOCK_EDITOR_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      { jsonMode: true, temperature: 0.6, maxTokens: 2048 },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new AIUnavailableError(`Groq falló: ${detail}`, e);
  }

  let parsed;
  try {
    parsed = parseResponse(raw);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new AIUnavailableError(`Respuesta inválida: ${detail}`, e);
  }

  return {
    id: generateId(),
    role: 'assistant',
    content: parsed.message,
    actions: parsed.actions,
    timestamp: Date.now(),
    affectedBlockId: block.id,
  };
}
