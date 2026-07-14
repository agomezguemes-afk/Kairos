// KAIROS — SessionBrief: the boundary schema + free-text inference.
//
// Two jobs:
//   1. Validate the model's `build_session` tool arguments at the boundary
//      (valibot) so nothing untyped reaches block generation.
//   2. Infer a serviceable brief from raw user text when the LLM is absent or
//      returns malformed args — the deterministic fallback that keeps the loop
//      from ever stranding the user.
//
// Node-safe: imports only types + valibot + pure mappers. No transport, no
// store. This is what the unit tests exercise directly.

import * as v from 'valibot';

import type { Discipline } from '../../../types/core';
import type { EquipmentTag, FitnessLevel } from '../../../types/profile';
import type { StarterAnswers, StarterDiscipline } from '../../routines/starterTemplates';
// Type-only — see types.ts rationale.
import type { GroqToolDefinition } from '../client';
import type { SessionBrief } from './types';

// ======================== VALIBOT SCHEMA (boundary) ========================

const DISCIPLINES = [
  'strength',
  'running',
  'calisthenics',
  'mobility',
  'team_sport',
  'cycling',
  'swimming',
  'general',
] as const satisfies readonly Discipline[];

// Tolerant on purpose: a good session survives missing fields. We validate the
// SHAPE (types) strictly, but treat absence as "infer/​default", never a reject.
const RawBriefSchema = v.object({
  title: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(60))),
  discipline: v.optional(v.picklist(DISCIPLINES)),
  focus: v.optional(v.union([v.pipe(v.string(), v.trim(), v.maxLength(80)), v.null()])),
  duration_min: v.optional(v.union([v.pipe(v.number(), v.minValue(1), v.maxValue(300)), v.null()])),
  location: v.optional(v.union([v.picklist(['casa', 'gym', 'aire_libre']), v.null()])),
  intensity: v.optional(v.picklist(['suave', 'normal', 'fuerte'])),
  equipment: v.optional(v.array(v.pipe(v.string(), v.trim(), v.maxLength(40)))),
  notes: v.optional(v.union([v.pipe(v.string(), v.trim(), v.maxLength(280)), v.null()])),
  closing: v.optional(v.union([v.pipe(v.string(), v.trim(), v.maxLength(200)), v.null()])),
});

export type RawBrief = v.InferOutput<typeof RawBriefSchema>;

/** JSON Schema advertised to Groq. Kept tight — the model reads it as docs. */
export const BUILD_SESSION_TOOL: GroqToolDefinition = {
  type: 'function',
  function: {
    name: 'build_session',
    description:
      'Construye el bloque de entrenamiento para HOY. Llama a esta función en cuanto tengas lo mínimo para armar una sesión útil (al menos una idea de qué entrenar). No pidas datos de más: infiere lo que puedas del texto del usuario.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título corto del bloque, p. ej. "Piernas en casa".',
        },
        discipline: {
          type: 'string',
          enum: [...DISCIPLINES],
          description: 'La disciplina que mejor encaje con lo que pide el usuario.',
        },
        focus: {
          type: ['string', 'null'],
          description: 'Foco en palabras del usuario: "piernas", "tren superior", "rodaje suave"…',
        },
        duration_min: {
          type: ['number', 'null'],
          description: 'Duración aproximada en minutos si la menciona.',
        },
        location: {
          type: ['string', 'null'],
          enum: ['casa', 'gym', 'aire_libre', null],
        },
        intensity: { type: 'string', enum: ['suave', 'normal', 'fuerte'] },
        equipment: {
          type: 'array',
          items: { type: 'string' },
          description: 'Material mencionado por el usuario (mancuernas, barra, esterilla…).',
        },
        notes: { type: ['string', 'null'], description: 'Cualquier detalle extra relevante.' },
        closing: {
          type: ['string', 'null'],
          description: 'Frase breve y cálida para confirmar al usuario lo que le has montado.',
        },
      },
      required: ['discipline'],
      additionalProperties: false,
    },
  },
};

/**
 * Parse the model's build_session arguments at the boundary. On any shape
 * failure we don't reject — we infer from the accumulated user text so the loop
 * still produces a block. Returns the brief plus the model's optional closing.
 */
export function parseBriefArgs(
  rawArgs: string,
  fallbackText: string,
): { brief: SessionBrief; closing: string | null } {
  let json: unknown;
  try {
    json = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { brief: inferBriefFromText(fallbackText), closing: null };
  }

  const parsed = v.safeParse(RawBriefSchema, json);
  if (!parsed.success) {
    return { brief: inferBriefFromText(fallbackText), closing: null };
  }

  const raw = parsed.output;
  const inferred = inferBriefFromText(fallbackText);
  const brief: SessionBrief = {
    discipline: raw.discipline ?? inferred.discipline,
    focus: raw.focus ?? inferred.focus,
    durationMin: raw.duration_min ?? inferred.durationMin,
    location: raw.location ?? inferred.location,
    intensity: raw.intensity ?? inferred.intensity,
    equipment: raw.equipment && raw.equipment.length > 0 ? raw.equipment : inferred.equipment,
    notes: raw.notes ?? inferred.notes,
    title: '',
  };
  brief.title = (raw.title && raw.title.length > 0 ? raw.title : deriveTitle(brief)).slice(0, 60);
  return { brief, closing: raw.closing ?? null };
}

// ======================== FREE-TEXT INFERENCE (fallback) ========================

interface Keyworded {
  discipline: Discipline;
  words: string[];
}

// Ordered by specificity — the first discipline whose words appear wins.
const DISCIPLINE_KEYWORDS: Keyworded[] = [
  {
    discipline: 'running',
    words: ['corr', 'run', 'rodaje', 'trote', 'sprint', 'km', 'kilómetr', 'series de'],
  },
  { discipline: 'cycling', words: ['bici', 'ciclis', 'pedal', 'rodillo', 'bike'] },
  // NOT the bare stem "nad": it lives inside "domiNADas", which turned every
  // pull-up session into a swim.
  { discipline: 'swimming', words: ['nadar', 'nado', 'piscina', 'natac', 'brazada', 'crol'] },
  {
    discipline: 'mobility',
    words: ['movilidad', 'yoga', 'estir', 'flexibil', 'relaj', 'suave', 'recuper', 'descarga'],
  },
  {
    discipline: 'calisthenics',
    words: ['calisten', 'dominad', 'flexion', 'fondos', 'peso corporal', 'barra de dominadas'],
  },
  {
    discipline: 'team_sport',
    words: [
      'fútbol',
      'futbol',
      'balonces',
      'básket',
      'basket',
      'pádel',
      'padel',
      'tenis',
      'partido',
      'balón',
    ],
  },
  {
    discipline: 'strength',
    words: [
      'fuerza',
      'pesas',
      'pierna',
      'pecho',
      'espalda',
      'brazo',
      'hombro',
      'glúteo',
      'gluteo',
      'gym',
      'gimnasio',
      'sentadilla',
      'press',
      'peso muerto',
      'mancuern',
      'barra',
      'músculo',
      'musculo',
      'hipertrofia',
    ],
  },
];

const FOCUS_KEYWORDS: { focus: string; words: string[] }[] = [
  {
    focus: 'piernas',
    words: ['pierna', 'cuádriceps', 'cuadriceps', 'glúteo', 'gluteo', 'sentadilla'],
  },
  { focus: 'pecho', words: ['pecho', 'press banca'] },
  { focus: 'espalda', words: ['espalda', 'dominad', 'remo', 'jalón', 'jalon'] },
  { focus: 'hombros', words: ['hombro', 'press militar'] },
  { focus: 'brazos', words: ['brazo', 'bíceps', 'biceps', 'tríceps', 'triceps'] },
  { focus: 'core', words: ['core', 'abdomin', 'plancha'] },
  { focus: 'tren superior', words: ['tren superior', 'torso'] },
  { focus: 'tren inferior', words: ['tren inferior'] },
  // Movement-pattern days — the other way people name a session.
  { focus: 'empuje', words: ['empuje', 'empujar', 'push'] },
  { focus: 'tirón', words: ['tirón', 'tiron', 'tracción', 'traccion', 'pull'] },
  { focus: 'cuerpo completo', words: ['cuerpo completo', 'full body', 'todo el cuerpo'] },
];

function normalize(s: string): string {
  return s.toLowerCase();
}

function inferDiscipline(text: string): Discipline {
  const t = normalize(text);
  for (const { discipline, words } of DISCIPLINE_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return discipline;
  }
  // Nothing recognisable ("no sé, algo") → a balanced general session.
  return 'general';
}

function inferFocus(text: string): string | null {
  const t = normalize(text);
  for (const { focus, words } of FOCUS_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return focus;
  }
  return null;
}

function inferDuration(text: string): number | null {
  // "40 min", "40min", "media hora", "una hora".
  const m = normalize(text).match(/(\d{1,3})\s*(?:min|minutos|')/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 5 && n <= 300) return n;
  }
  const t = normalize(text);
  if (t.includes('media hora')) return 30;
  if (t.includes('una hora') || t.includes('1 hora')) return 60;
  const h = t.match(/(\d)\s*h(?:oras?)?\b/);
  if (h) {
    const n = parseInt(h[1], 10) * 60;
    if (n >= 5 && n <= 300) return n;
  }
  return null;
}

function inferLocation(text: string): SessionBrief['location'] {
  const t = normalize(text);
  if (t.includes('casa') || t.includes('en el salón') || t.includes('salon')) return 'casa';
  if (t.includes('gym') || t.includes('gimnasio')) return 'gym';
  if (
    t.includes('calle') ||
    t.includes('parque') ||
    t.includes('aire libre') ||
    t.includes('fuera')
  )
    return 'aire_libre';
  return null;
}

function inferIntensity(text: string): SessionBrief['intensity'] {
  const t = normalize(text);
  if (
    t.includes('suave') ||
    t.includes('flojo') ||
    t.includes('tranqui') ||
    t.includes('ligero') ||
    t.includes('relaj') ||
    t.includes('recuper') ||
    t.includes('descarga')
  )
    return 'suave';
  if (
    t.includes('fuerte') ||
    t.includes('intens') ||
    t.includes('duro') ||
    t.includes('a tope') ||
    t.includes('máximo') ||
    t.includes('maximo')
  )
    return 'fuerte';
  return 'normal';
}

function inferEquipment(text: string): string[] {
  const t = normalize(text);
  const found: string[] = [];
  // Regex, not substring: a bare "barra" needle turns "barra de dominadas" into
  // a barbell, and hands a home athlete a deadlift they can't do.
  const map: [RegExp, string][] = [
    [/mancuern/, 'mancuernas'],
    [/dominad|barra fija/, 'barra de dominadas'],
    [/\bbarra\b(?! de dominadas| fija)/, 'barra'],
    [/kettlebell|pesa rusa/, 'kettlebell'],
    [/banda/, 'bandas'],
    [/esterilla/, 'esterilla'],
    [/cuerda|comba/, 'cuerda de saltar'],
  ];
  for (const [pattern, label] of map) {
    if (pattern.test(t) && !found.includes(label)) found.push(label);
  }
  return found;
}

/** Build a title from the inferred fields when the model gives none. */
function deriveTitle(brief: SessionBrief): string {
  const DISCIPLINE_LABEL: Record<Discipline, string> = {
    strength: 'Fuerza',
    running: 'Running',
    calisthenics: 'Calistenia',
    mobility: 'Movilidad',
    team_sport: 'Sesión de campo',
    cycling: 'Bici',
    swimming: 'Natación',
    general: 'Entreno',
  };
  const base = brief.focus
    ? brief.focus.charAt(0).toUpperCase() + brief.focus.slice(1)
    : DISCIPLINE_LABEL[brief.discipline];
  if (brief.location === 'casa') return `${base} en casa`;
  if (brief.location === 'gym') return `${base} en el gym`;
  if (brief.intensity === 'suave') return `${base} suave`;
  return base;
}

/** Deterministic brief from raw user text. Always returns a usable session. */
export function inferBriefFromText(text: string): SessionBrief {
  const discipline = inferDiscipline(text);
  const brief: SessionBrief = {
    title: '',
    discipline,
    focus: inferFocus(text),
    durationMin: inferDuration(text),
    location: inferLocation(text),
    intensity: inferIntensity(text),
    equipment: inferEquipment(text),
    notes: null,
  };
  brief.title = deriveTitle(brief);
  return brief;
}

// ======================== BRIEF → STARTER ANSWERS ========================

const CORE_TO_STARTER: Record<Discipline, StarterDiscipline> = {
  strength: 'strength',
  running: 'running',
  calisthenics: 'calisthenics',
  mobility: 'yoga_mobility',
  team_sport: 'team_sport',
  cycling: 'hybrid',
  swimming: 'hybrid',
  general: 'hybrid',
};

// Regex, not substring: "barra de dominadas" is a pull-up bar and NOT a
// barbell — the bare "barra" needle used to hand a home athlete a barbell.
const EQUIPMENT_LABEL_TO_TAG: [RegExp, EquipmentTag][] = [
  [/mancuern/, 'dumbbells'],
  [/barra de dominadas|barra fija|dominad/, 'pull_up_bar'],
  [/\bbarra\b(?! de dominadas)/, 'barbell_plates'],
  [/kettlebell|pesa rusa/, 'kettlebell'],
  [/banda|goma/, 'resistance_bands'],
  [/esterilla|mat\b/, 'yoga_mat'],
  [/cuerda|comba/, 'jump_rope'],
];

/**
 * Map a brief onto the curated-template inputs. Location drives the baseline
 * equipment set (a gym unlocks machines/barbell), then any explicit words the
 * user mentioned are layered on. Intensity nudges the level so a "suave"
 * session isn't over-prescribed and a "fuerte" one gets real volume.
 */
export function briefToStarterAnswers(brief: SessionBrief): StarterAnswers {
  const tags = new Set<EquipmentTag>();
  if (brief.location === 'gym') {
    tags.add('machines_full_gym');
    tags.add('barbell_plates');
    tags.add('dumbbells');
  }
  for (const word of brief.equipment) {
    const w = word.toLowerCase();
    for (const [pattern, tag] of EQUIPMENT_LABEL_TO_TAG) {
      if (pattern.test(w)) tags.add(tag);
    }
  }
  if (tags.size === 0) tags.add('bodyweight');

  const level: FitnessLevel =
    brief.intensity === 'suave'
      ? 'beginner'
      : brief.intensity === 'fuerte'
        ? 'advanced'
        : 'intermediate';

  return {
    discipline: CORE_TO_STARTER[brief.discipline],
    level,
    frequency: 1, // one session for today — never the A/B split
    equipment: [...tags],
  };
}
