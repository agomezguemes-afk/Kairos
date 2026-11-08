// LLM refinement of a free-text training goal. The deterministic parser
// always runs first and is the fallback: the model can only pick values
// from the engine's own enums, and anything it returns that doesn't
// validate is dropped field by field. It never produces plan numbers.

import { parseGoal } from '../adaptive/goalParser';
import type { ParsedGoal, Quality, Sport } from '../adaptive/types';
import { chatCompletion, isGroqAvailable } from './client';

const SPORTS: readonly Sport[] = [
  'padel',
  'tennis',
  'climbing',
  'hiking',
  'running',
  'cycling',
  'football',
  'basketball',
  'swimming',
  'strength',
  'general',
];
const QUALITIES: readonly Quality[] = [
  'endurance',
  'strength',
  'power',
  'speed',
  'mobility',
  'technique',
];

const MAX_SPORTS = 3;
const MAX_QUALITIES = 4;
const MAX_TEXT = 140;
export const GOAL_AI_TIMEOUT_MS = 8_000;

export const GOAL_SYSTEM_PROMPT = `Eres el intérprete de objetivos de Kairos, una app de entrenamiento.
Recibes lo que el usuario quiere conseguir, en sus palabras, y devuelves SOLO un objeto JSON:
{
  "sports": string[],        // de: ${SPORTS.join(', ')}. El principal primero. Deporte no listado → el más parecido por exigencias físicas, o "general".
  "qualities": string[],     // de: ${QUALITIES.join(', ')}. Por prioridad, máximo ${MAX_QUALITIES}. Deduce lo que limita al usuario aunque no use esas palabras ("me ahogo en el tercer set" → endurance; "no llego a las bolas" → speed).
  "daysPerWeek": number|null,   // solo si lo dice o se deduce sin duda ("lunes y jueves" → 2). Si no, null.
  "horizonWeeks": number|null,  // solo si da un plazo o fecha ("en 3 meses" → 13). Si no, null.
  "confidence": number,      // 0–1: cuánto se puede planificar con lo dicho.
  "summary": string,         // el objetivo reformulado en una frase, en segunda persona, en el idioma del usuario, máx. 90 caracteres.
  "question": string|null    // UNA pregunta breve solo si falta algo decisivo (p. ej. qué deporte). Si no, null.
}
No inventes datos que el usuario no dio. No des consejos ni planes.`;

function pickList<T extends string>(raw: unknown, allowed: readonly T[], max: number): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const v = item.trim().toLowerCase() as T;
    if (allowed.includes(v) && !out.includes(v)) out.push(v);
    if (out.length === max) break;
  }
  return out;
}

function pickInt(raw: unknown, lo: number, hi: number): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : null;
}

function pickText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return undefined;
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1).trimEnd()}…` : t;
}

/**
 * Overlay a model response on the rules parse. Invalid or missing fields
 * keep the rules value; if nothing usable came back the base is returned
 * unchanged (still marked 'rules').
 */
export function mergeAiGoal(base: ParsedGoal, raw: unknown): ParsedGoal {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const r = raw as Record<string, unknown>;

  const sports = pickList(r.sports, SPORTS, MAX_SPORTS);
  // "general" next to a real sport is noise.
  const cleanSports = sports.length > 1 ? sports.filter((s) => s !== 'general') : sports;
  const qualities = pickList(r.qualities, QUALITIES, MAX_QUALITIES);
  const days = pickInt(r.daysPerWeek, 1, 7);
  const weeks = pickInt(r.horizonWeeks, 2, 52);
  const conf =
    typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? r.confidence : null;
  const summary = pickText(r.summary);
  const question = pickText(r.question);

  const usable =
    cleanSports.length > 0 || qualities.length > 0 || days !== null || weeks !== null || !!summary;
  if (!usable) return base;

  return {
    ...base,
    sports: cleanSports.length ? cleanSports : base.sports,
    qualities: qualities.length ? qualities : base.qualities,
    daysPerWeek: days ?? base.daysPerWeek,
    horizonWeeks: weeks ?? base.horizonWeeks,
    confidence: conf === null ? base.confidence : Number(Math.min(1, Math.max(0, conf)).toFixed(2)),
    source: 'ai',
    summary,
    question,
  };
}

export function isGoalAiAvailable(): boolean {
  return isGroqAvailable();
}

/**
 * Rules parse refined by the LLM when available. Never throws and never
 * waits longer than `timeoutMs`: on any failure the caller gets the
 * rules parse, so drafting a plan works offline.
 */
export async function interpretGoal(
  text: string,
  timeoutMs: number = GOAL_AI_TIMEOUT_MS,
): Promise<ParsedGoal> {
  const base: ParsedGoal = { ...parseGoal(text), source: 'rules' };
  if (!isGroqAvailable() || text.trim().length < 3) return base;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const choice = await Promise.race([
      chatCompletion(
        [
          { role: 'system', content: GOAL_SYSTEM_PROMPT },
          { role: 'user', content: text.trim().slice(0, 600) },
        ],
        { jsonMode: true, temperature: 0.2, maxTokens: 300 },
      ),
      timeout,
    ]);
    if (!choice || typeof choice.message.content !== 'string') return base;
    return mergeAiGoal(base, JSON.parse(choice.message.content));
  } catch (e) {
    // Offline, rate-limited or malformed JSON: the rules parse is a
    // complete answer, so degrade silently but leave a trace for debugging.
    console.warn('[goalInterpreter] falling back to rules:', e instanceof Error ? e.message : e);
    return base;
  } finally {
    clearTimeout(timer);
  }
}
