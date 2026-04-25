import type { AIAction, AIMessage } from '../types/ai';
import type { WorkoutBlock } from '../types/core';
import { generateId, calculateBlockStats, getBlockExercises } from '../types/core';
import { callGroqAPI, parseResponse, isGroqConfigured, GroqError } from './aiService';
import {
  buildUserContextSnapshot,
  renderContextForPrompt,
  type RawUserContext,
} from '../utils/userContext';

const BLOCK_SYSTEM_PROMPT = `Eres Kai, el asistente integrado en el editor de bloques de Kairos. Hablas en español, tono directo y breve. Sin emojis.

CONTEXTO: Estás dentro de un bloque de entrenamiento específico. El usuario te pide ayuda para construir, editar o mejorar ESTE bloque.

REGLAS:
- Responde SIEMPRE con JSON válido: { "message": string, "actions": [] }
- Para añadir ejercicios a ESTE bloque, usa "add_exercise" con el blockId del bloque actual.
- Para modificar ejercicios existentes, usa sus IDs reales del contexto.
- Si el bloque está vacío, genera una rutina coherente con la disciplina y nivel del usuario.
- Si tiene ejercicios, analiza y sugiere mejoras concretas.
- Adapta series, reps y descanso al nivel del usuario.
- Cuando el usuario pide "generar" o "crear", añade ejercicios directamente — no crees un bloque nuevo.
- Máximo 8 ejercicios por rutina generada.
- Sé específico con nombres de ejercicios (no genéricos).

ESQUEMA DE ACCIONES:

add_exercise: { "type": "add_exercise", "payload": { "blockId": string, "name": string, "sets_count": number, "reps": number|string, "rest_seconds": number } }
update_exercise: { "type": "update_exercise", "payload": { "exerciseId": string, "updates": { "name"?: string, "rest_seconds"?: number, "default_sets_count"?: number } } }
delete_exercise: { "type": "delete_exercise", "payload": { "blockId": string, "exerciseId": string } }
update_block_meta: { "type": "update_block_meta", "payload": { "blockId": string, "updates": { "name"?: string, "description"?: string } } }

CAMPOS DISPONIBLES POR DISCIPLINA:
- Fuerza: weight (kg), reps, rir, rpe (/10), tempo (text), rest (seg)
- Cardio: distance (km), duration (min), pace (min/km), heartRate (bpm), calories (kcal)
- Calistenia: reps, duration (sec), progression (1-10)
- Movilidad: duration (min), perceivedEffort (/10)
- General: duration (min), perceivedEffort (/10), calories (kcal), notes (text)

EJEMPLO — usuario dice "añade algo para tríceps":
{
  "message": "Te añado fondos en paralelas, gran ejercicio compuesto para tríceps que complementa tus presses.",
  "actions": [{ "type": "add_exercise", "payload": { "blockId": "abc123", "name": "Fondos en paralelas", "sets_count": 3, "reps": 12, "rest_seconds": 60 } }]
}`;

function buildBlockContext(block: WorkoutBlock): string {
  const stats = calculateBlockStats(block);
  const exercises = getBlockExercises(block);
  const lines: string[] = [];

  lines.push(`BLOQUE ACTUAL: [${block.id}] "${block.name}" (${block.discipline})`);

  if (block.description) {
    lines.push(`Descripción: ${block.description}`);
  }

  lines.push(`Progreso: ${stats.completion_percentage}% (${stats.completed_sets}/${stats.total_sets} series)`);
  lines.push(`Volumen total: ${stats.total_volume}kg`);
  lines.push('');

  if (exercises.length === 0) {
    lines.push('EJERCICIOS: ninguno — el bloque está vacío.');
  } else {
    lines.push(`EJERCICIOS (${exercises.length}):`);
    exercises.forEach((ex, i) => {
      const completed = ex.sets.filter(s => s.completed).length;
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
        if (vals.length > 0) {
          lines.push(`   S${si + 1}: ${vals.join(' × ')}${check}`);
        }
      });
    });
  }

  return lines.join('\n');
}

export function getBlockSuggestions(block: WorkoutBlock): Array<{ label: string; prompt: string }> {
  const exercises = getBlockExercises(block);
  const stats = calculateBlockStats(block);

  if (exercises.length === 0) {
    return [
      { label: 'Generar rutina', prompt: `Genera una rutina completa de ${block.discipline} para este bloque, adaptada a mi nivel` },
      { label: 'Rutina rápida', prompt: 'Crea una rutina corta de 15-20 minutos con 4 ejercicios' },
      { label: 'Calentamiento', prompt: 'Añade ejercicios de calentamiento y movilidad para empezar' },
    ];
  }

  const suggestions: Array<{ label: string; prompt: string }> = [];

  if (exercises.length < 3) {
    suggestions.push({ label: 'Completar rutina', prompt: 'Sugiere ejercicios complementarios para completar esta rutina' });
  }

  suggestions.push({ label: 'Añadir ejercicio', prompt: 'Recomienda un ejercicio que complemente los que ya tengo' });

  if (exercises.length >= 3) {
    suggestions.push({ label: 'Analizar bloque', prompt: 'Analiza este bloque: equilibrio muscular, volumen, y qué puedo mejorar' });
  }

  if (stats.completion_percentage > 0) {
    suggestions.push({ label: 'Progresión', prompt: 'Basándote en mi progreso, qué debería ajustar para la próxima sesión' });
  }

  suggestions.push({ label: 'Ajustar volumen', prompt: 'Revisa las series y repeticiones, ajústalas si ves algo desbalanceado' });

  return suggestions.slice(0, 4);
}

export async function processBlockMessage(
  userText: string,
  block: WorkoutBlock,
  rawContext: RawUserContext,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<AIMessage> {
  const blockContext = buildBlockContext(block);

  if (!isGroqConfigured()) {
    return buildMockResponse(userText, block);
  }

  try {
    const snapshot = buildUserContextSnapshot(rawContext);
    const profileContext = renderContextForPrompt(snapshot);

    const historyText = history.length > 0
      ? '\n\nCONVERSACIÓN PREVIA:\n' + history.slice(-8).map(m =>
          `${m.role === 'user' ? 'Usuario' : 'Kai'}: ${m.content}`
        ).join('\n')
      : '';

    const userPrompt = `${profileContext}\n\n${blockContext}${historyText}\n\nMENSAJE DEL USUARIO:\n${userText}`;

    const { message, actions } = await callGroqAPI(BLOCK_SYSTEM_PROMPT, userPrompt);

    return {
      id: generateId(),
      role: 'assistant',
      content: message,
      actions,
      timestamp: Date.now(),
      affectedBlockId: block.id,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[Kai/Block] Groq failed:', detail);

    const fallback = await buildMockResponse(userText, block);
    return {
      ...fallback,
      content: process.env.NODE_ENV !== 'production'
        ? `⚠️ Groq offline (${detail})\n\n${fallback.content}`
        : fallback.content,
    };
  }
}

// ======================== MOCK FALLBACK ========================

const EXERCISE_DB: Record<string, string[]> = {
  strength: [
    'Press de banca', 'Sentadilla', 'Peso muerto', 'Press militar',
    'Remo con barra', 'Curl de bíceps', 'Extensión de tríceps', 'Prensa de piernas',
    'Elevaciones laterales', 'Face pull', 'Hip thrust', 'Zancadas',
    'Fondos en paralelas', 'Pull-ups', 'Encogimientos de hombros',
  ],
  calisthenics: [
    'Flexiones', 'Dominadas', 'Fondos', 'Pistol squats',
    'Muscle up', 'L-sit', 'Plancha frontal', 'Handstand push-up',
    'Dragon flag', 'Remo invertido', 'Pike push-up', 'Bulgarian split squat',
  ],
  running: [
    'Carrera continua', 'Intervalos 400m', 'Fartlek', 'Tempo run',
    'Hill sprints', 'Carrera de recuperación', 'Progresivos',
  ],
  mobility: [
    'Estiramiento de cadera', 'Cat-cow', 'World greatest stretch',
    'Foam rolling piernas', 'Rotación torácica', 'Estiramiento de isquiotibiales',
    'Movilidad de hombro', 'Sentadilla profunda con pausa',
  ],
  general: [
    'Burpees', 'Mountain climbers', 'Jumping jacks', 'Sentadilla con salto',
    'Plancha', 'Bear crawl', 'Box jumps', 'Kettlebell swing',
  ],
};

function pickExercises(discipline: string, count: number, exclude: string[]): string[] {
  const pool = EXERCISE_DB[discipline] ?? EXERCISE_DB.general;
  const available = pool.filter(e => !exclude.some(ex => ex.toLowerCase() === e.toLowerCase()));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function buildMockResponse(userText: string, block: WorkoutBlock): Promise<AIMessage> {
  const lower = userText.toLowerCase();
  const exercises = getBlockExercises(block);
  const existingNames = exercises.map(e => e.name);
  const stats = calculateBlockStats(block);
  const actions: AIAction[] = [];
  let message = '';

  const wantsGenerate = /genera|crea|rutina|completa|llena|arma/.test(lower);
  const wantsAdd = /añade|agrega|sugiere|recomienda|pon/.test(lower);
  const wantsAnalyze = /anali|revisa|mejora|evalú|diagnóst/.test(lower);
  const wantsAdjust = /ajust|cambia|modific|series|reps|volumen|descanso/.test(lower);
  const wantsProgress = /progres|siguiente|próxima|sesión|avance/.test(lower);

  if (wantsGenerate && exercises.length === 0) {
    const count = /rápid|cort|15|20 min/.test(lower) ? 4 : 6;
    const picked = pickExercises(block.discipline, count, existingNames);
    picked.forEach(name => {
      actions.push({
        type: 'add_exercise',
        payload: {
          blockId: block.id,
          name,
          sets_count: block.discipline === 'running' ? 1 : (Math.random() > 0.5 ? 4 : 3),
          reps: block.discipline === 'running' ? '20min' : (8 + Math.floor(Math.random() * 5)),
          rest_seconds: block.discipline === 'mobility' ? 30 : (60 + Math.floor(Math.random() * 3) * 15),
        },
      });
    });
    message = `Te preparé ${picked.length} ejercicios de ${block.discipline}. Revísalos y ajusta los pesos según tu nivel.`;

  } else if (wantsAdd || (wantsGenerate && exercises.length > 0)) {
    const count = /2|dos|par/.test(lower) ? 2 : (/3|tres/.test(lower) ? 3 : 1);
    const picked = pickExercises(block.discipline, count, existingNames);
    picked.forEach(name => {
      actions.push({
        type: 'add_exercise',
        payload: {
          blockId: block.id,
          name,
          sets_count: 3,
          reps: block.discipline === 'running' ? '10min' : 12,
          rest_seconds: 60,
        },
      });
    });
    message = picked.length === 1
      ? `Te añado ${picked[0]}. Complementa bien lo que ya tienes.`
      : `Añadidos: ${picked.join(', ')}. Deberían equilibrar tu rutina.`;

  } else if (wantsAnalyze) {
    const muscleBalance = exercises.length >= 4 ? 'buena variedad' : 'podrías diversificar más';
    const volumeNote = stats.total_sets > 20 ? 'volumen alto, asegúrate de recuperar bien' : 'volumen adecuado';
    message = `Análisis de "${block.name}": ${exercises.length} ejercicios, ${stats.total_sets} series totales. ${muscleBalance}, ${volumeNote}. Progreso actual: ${stats.completion_percentage}%.`;

    if (exercises.length < 4) {
      const picked = pickExercises(block.discipline, 1, existingNames);
      if (picked.length > 0) {
        message += ` Te sugiero añadir ${picked[0]} para completar.`;
        actions.push({
          type: 'add_exercise',
          payload: { blockId: block.id, name: picked[0], sets_count: 3, reps: 10, rest_seconds: 60 },
        });
      }
    }

  } else if (wantsAdjust && exercises.length > 0) {
    exercises.forEach(ex => {
      if (ex.sets.length < 3) {
        actions.push({
          type: 'update_exercise',
          payload: { exerciseId: ex.id, updates: { default_sets_count: 3 } },
        });
      }
    });
    message = actions.length > 0
      ? 'He ajustado el volumen de los ejercicios que tenían menos de 3 series.'
      : 'El volumen actual se ve equilibrado. Si quieres algo específico, dime qué ejercicio ajustar.';

  } else if (wantsProgress) {
    if (stats.completion_percentage >= 80) {
      message = 'Gran sesión. Para la próxima, considera subir un 5% el peso o añadir 1 serie a los ejercicios principales.';
    } else if (stats.completion_percentage >= 40) {
      message = 'Buen avance. Mantén la consistencia y termina las series restantes antes de subir intensidad.';
    } else {
      message = 'Todavía queda camino. Enfócate en completar las series actuales con buena técnica antes de progresar.';
    }

  } else {
    message = exercises.length === 0
      ? 'Este bloque está vacío. Puedo generarte una rutina completa o añadir ejercicios específicos. Dime qué necesitas.'
      : `Tienes ${exercises.length} ejercicios con ${stats.completion_percentage}% completado. Puedo analizar tu bloque, ajustar volumen, o añadir ejercicios. Dime cómo te ayudo.`;
  }

  return {
    id: generateId(),
    role: 'assistant',
    content: message,
    actions,
    timestamp: Date.now(),
    affectedBlockId: block.id,
  };
}
