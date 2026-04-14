// KAIROS — Groq-backed AI service
// RAG pipeline: user snapshot → prompt → Groq (free tier) → validated action list.
// Fallback: the mock aiChatService, so the chat always stays usable.

import type { AIAction, AIMessage, AIExerciseTemplate } from '../types/ai';
import type { Discipline } from '../types/core';
import { generateId } from '../types/core';
import {
  buildUserContextSnapshot,
  renderContextForPrompt,
  type RawUserContext,
  type UserContextSnapshot,
} from '../utils/userContext';
import { processMessage as mockProcessMessage, type AIChatContext } from './aiChatService';

// ======================== CONFIG ========================

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 20_000;

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

function getApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (typeof key === 'string' && key.trim().length > 0) return key.trim();
  return null;
}

/** True when we can reach Groq on this device. */
export function isGroqConfigured(): boolean {
  return getApiKey() !== null;
}

// ======================== PROMPT BUILDER ========================

const SYSTEM_PROMPT = `Eres Kai, el asistente de entrenamiento de la app Kairos. Hablas siempre en español, en tono cercano y directo, sin emojis.

Tu trabajo es:
1) Responder al usuario con un mensaje corto y motivador.
2) Devolver una lista de ACCIONES estructuradas que la app ejecutará contra su store (crear bloques, añadir ejercicios, etc).

REGLAS OBLIGATORIAS:
- Responde SIEMPRE con un único objeto JSON válido. Nada de texto fuera del JSON.
- El objeto tiene EXACTAMENTE dos claves: "message" (string) y "actions" (array).
- "actions" puede estar vacío si el usuario solo está charlando o pidiendo consejo.
- NO inventes IDs. Solo usa los IDs de bloque/ejercicio que aparecen en el contexto.
- Si el usuario pide modificar algo que no existe en su contexto, explica en "message" que no lo encuentras y devuelve "actions": [].
- Respeta el perfil del usuario (nivel, lesiones, frecuencia) al generar planes.

ESQUEMA DE ACCIONES (cada acción es un objeto con "type" y "payload"):

create_block:
{
  "type": "create_block",
  "payload": {
    "name": string,
    "discipline": "strength" | "running" | "calisthenics" | "mobility" | "team_sport" | "cycling" | "swimming" | "general",
    "exercises": [
      {
        "name": string,
        "sets_count": number,
        "reps": number | string,     // número para reps, string como "40s" para tiempo
        "rest_seconds": number
      }
    ]
  }
}

add_exercise:
{
  "type": "add_exercise",
  "payload": {
    "blockId": string,       // ID real del contexto
    "name": string,
    "sets_count": number,
    "reps": number | string,
    "rest_seconds": number
  }
}

update_exercise:
{
  "type": "update_exercise",
  "payload": {
    "exerciseId": string,    // ID real del contexto
    "updates": {
      "name"?: string,
      "notes"?: string,
      "rest_seconds"?: number,
      "default_sets_count"?: number
    }
  }
}

delete_exercise:
{
  "type": "delete_exercise",
  "payload": { "blockId": string, "exerciseId": string }
}

update_block_meta:
{
  "type": "update_block_meta",
  "payload": {
    "blockId": string,
    "updates": {
      "name"?: string,
      "description"?: string
    }
  }
}

delete_block:
{
  "type": "delete_block",
  "payload": { "blockId": string }
}

EJEMPLO de respuesta válida a "Créame un bloque de fuerza en casa":
{
  "message": "Listo, te preparé un bloque de fuerza básico con 4 ejercicios multiarticulares. Empieza suave y ajusta el peso según cómo responda tu cuerpo.",
  "actions": [
    {
      "type": "create_block",
      "payload": {
        "name": "Fuerza en casa",
        "discipline": "strength",
        "exercises": [
          { "name": "Sentadilla goblet", "sets_count": 4, "reps": 10, "rest_seconds": 90 },
          { "name": "Flexiones", "sets_count": 4, "reps": 12, "rest_seconds": 60 },
          { "name": "Remo con mancuerna", "sets_count": 4, "reps": 10, "rest_seconds": 90 },
          { "name": "Plancha", "sets_count": 3, "reps": "40s", "rest_seconds": 45 }
        ]
      }
    }
  ]
}`;

/**
 * Combines profile, history, and the user's latest message into a structured prompt.
 * Returns both halves so the caller can log or reuse them independently.
 */
export function buildPrompt(
  snapshot: UserContextSnapshot,
  userQuery: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): { system: string; user: string } {
  const contextBlock = renderContextForPrompt(snapshot);

  const historyText =
    conversationHistory.length > 0
      ? '\n\nHISTORIAL DE CONVERSACIÓN:\n' +
        conversationHistory
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'Usuario' : 'Kai'}: ${m.content}`)
          .join('\n')
      : '';

  const user = `${contextBlock}${historyText}\n\nMENSAJE DEL USUARIO:\n${userQuery}`;

  return { system: SYSTEM_PROMPT, user };
}

// ======================== GROQ CALL ========================

interface GroqChoice {
  message?: { content?: string };
}
interface GroqResponse {
  choices?: GroqChoice[];
  error?: { message?: string };
}

export class GroqError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'GroqError';
  }
}

/**
 * Send a system+user prompt to Groq and return the parsed structured response.
 * Throws GroqError on network failures, bad status codes, or unparseable output.
 */
export async function callGroqAPI(
  system: string,
  user: string,
): Promise<ParsedAIResponse> {
  const apiKey = getApiKey();
  if (!apiKey) throw new GroqError('EXPO_PUBLIC_GROQ_API_KEY no está configurada');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    throw new GroqError('No se pudo contactar con Groq', e);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const bodyText = await safeReadText(res);
    throw new GroqError(`Groq respondió ${res.status}: ${bodyText.slice(0, 200)}`);
  }

  let json: GroqResponse;
  try {
    json = (await res.json()) as GroqResponse;
  } catch (e) {
    throw new GroqError('Respuesta de Groq no era JSON', e);
  }

  const raw = json.choices?.[0]?.message?.content;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new GroqError('Groq devolvió una respuesta vacía');
  }

  return parseResponse(raw);
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

// ======================== RESPONSE PARSER ========================

export interface ParsedAIResponse {
  message: string;
  actions: AIAction[];
}

/**
 * Parse and validate a raw JSON string produced by the LLM.
 * Any structurally invalid action is dropped rather than crashing the chat.
 */
export function parseResponse(raw: string): ParsedAIResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Some models wrap JSON in ```json fences despite response_format.
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

  if (!isObject(parsed)) {
    throw new GroqError('La respuesta no es un objeto JSON');
  }

  const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
  if (!message) {
    throw new GroqError('La respuesta no contiene "message"');
  }

  const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: AIAction[] = [];
  for (const candidate of rawActions) {
    const normalized = normalizeAction(candidate);
    if (normalized) actions.push(normalized);
  }

  return { message, actions };
}

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

  return {
    type: 'create_block',
    payload: { name, discipline, exercises },
  };
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

// ======================== COERCION HELPERS ========================

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

// ======================== MAIN ENTRY ========================

/**
 * Process a user message through Groq (if configured) and return an AIMessage
 * in the same shape as the mock service — drop-in replacement for AIChatScreen.
 * Falls back to the mock implementation on any Groq failure so the chat stays alive.
 */
export async function processWithGroq(
  userText: string,
  raw: RawUserContext,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<AIMessage> {
  if (!isGroqConfigured()) {
    return mockProcessMessage(userText, toMockContext(raw));
  }

  try {
    const snapshot = buildUserContextSnapshot(raw);
    const { system, user } = buildPrompt(snapshot, userText, conversationHistory);
    const { message, actions } = await callGroqAPI(system, user);

    return {
      id: generateId(),
      role: 'assistant',
      content: message,
      actions,
      timestamp: Date.now(),
    };
  } catch (e) {
    console.warn('Kairos: Groq failed, falling back to mock', e);
    const fallback = await mockProcessMessage(userText, toMockContext(raw));
    return {
      ...fallback,
      content: fallback.content,
    };
  }
}

function toMockContext(raw: RawUserContext): AIChatContext {
  return {
    blocks: raw.blocks,
    streak: raw.streak,
    badges: raw.badges,
    prCards: raw.prCards,
    activeMission: raw.activeMission,
  };
}
