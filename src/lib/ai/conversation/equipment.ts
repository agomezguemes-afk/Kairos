// KAIROS — Equipment semantics for the conversational loop.
//
// The bug this fixes (observed on-device, 2026-07): "entreno de espalda, 40
// minutos, full máquinas" led with Remo con barra + Peso muerto. Reason: the
// location→equipment baseline mapped `gym` to {machines + barbell + dumbbells},
// and the words the user actually said could only ever ADD tags. There was no
// way to express "solo máquinas", "sin barra" or "peso corporal y ya" — every
// restriction the user stated was silently discarded.
//
// The rule, stated once and applied everywhere (deterministic composer, starter
// templates, LLM vocabulary bias):
//
//   1. The user names equipment  → that set IS the allowed set. It REPLACES the
//      location baseline; it does not extend it. "Full máquinas" in a gym means
//      machines, not machines-and-also-the-barbell-rack.
//   2. The user negates equipment ("sin barra", "nada de mancuernas") → those
//      tags are SUBTRACTED from whatever remains.
//   3. The user names nothing    → the location baseline stands, untouched.
//      This is the pre-existing behaviour and must not drift.
//
// Two deliberate deviations from a naive reading of rule 1:
//   · We do NOT intersect the named set with the location baseline. "Peso
//     corporal en el gym" would intersect to ∅ and force us to invent something.
//     The location is a prior; the user's words are evidence. Evidence wins.
//   · Bodyweight (ungated) movements stay first-class ONLY when the user didn't
//     restrict, or explicitly allowed bodyweight, or only used negation. On a
//     "full máquinas" day a towel row is a degradation, not a pick — see
//     `bodyweightAllowed` and its use in focusSession.
//
// Node-safe: types only. No store, no transport, no LLM.

import type { EquipmentTag } from '../../../types/profile';

// ======================== POLICY ========================

/** Where the session happens. Mirrors SessionBrief['location'] — declared here
 * so types.ts can depend on this module and not the other way round. */
export type SessionLocation = 'casa' | 'gym' | 'aire_libre' | null;

/**
 * The user's explicit equipment intent, extracted from their own words.
 * Empty on both sides = no intent stated = the location baseline stands.
 */
export interface EquipmentPolicy {
  /** Named by the user → the ALLOWED set (replaces the baseline). */
  allow: EquipmentTag[];
  /** Negated by the user ("sin barra") → subtracted from whatever remains. */
  deny: EquipmentTag[];
}

export const EMPTY_EQUIPMENT_POLICY: EquipmentPolicy = { allow: [], deny: [] };

/** Spanish labels — used to echo the constraint back to the model and the user. */
export const EQUIPMENT_TAG_LABEL: Record<EquipmentTag, string> = {
  bodyweight: 'peso corporal',
  dumbbells: 'mancuernas',
  barbell_plates: 'barra y discos',
  kettlebell: 'kettlebell',
  resistance_bands: 'bandas elásticas',
  pull_up_bar: 'barra de dominadas',
  machines_full_gym: 'máquinas y poleas',
  cardio_equipment: 'máquinas de cardio',
  yoga_mat: 'esterilla',
  jump_rope: 'cuerda de saltar',
};

// ======================== VOCABULARY ========================

interface EquipmentConcept {
  /** Canonical word we store in `brief.equipment` (the LLM-facing echo). */
  label: string;
  /** Matched against accent-stripped, lowercased text. */
  pattern: RegExp;
  tags: EquipmentTag[];
}

// Order matters: the pull-up bar must claim "barra de dominadas" before the
// barbell rule sees a bare "barra" — otherwise a home athlete gets a deadlift.
const CONCEPTS: EquipmentConcept[] = [
  { label: 'mancuernas', pattern: /mancuern/g, tags: ['dumbbells'] },
  {
    label: 'barra de dominadas',
    pattern: /barra de dominadas|barra fija|dominad/g,
    tags: ['pull_up_bar'],
  },
  {
    label: 'barra',
    pattern: /\bbarras?\b(?! de dominadas| fija)|barbell|pesos? libres?/g,
    tags: ['barbell_plates'],
  },
  { label: 'kettlebell', pattern: /kettlebell|pesas? rusas?/g, tags: ['kettlebell'] },
  { label: 'bandas', pattern: /\bbandas?\b|\bgomas?\b/g, tags: ['resistance_bands'] },
  {
    label: 'máquinas',
    pattern: /maquin|\bpoleas?\b|\bcables?\b|multipower|\bmultipowers?\b/g,
    tags: ['machines_full_gym'],
  },
  {
    label: 'peso corporal',
    pattern:
      /peso corporal|bodyweight|calistenia|sin material|sin equipo|sin equipamiento|sin nada|solo (?:con )?mi cuerpo|solo el cuerpo/g,
    tags: ['bodyweight'],
  },
  { label: 'esterilla', pattern: /esterilla|colchoneta/g, tags: ['yoga_mat'] },
  { label: 'cuerda de saltar', pattern: /\bcuerdas?\b|\bcomba\b/g, tags: ['jump_rope'] },
  {
    label: 'cardio',
    pattern: /cinta de correr|eliptica|bici estatica|remoergo|remo ergo/g,
    tags: ['cardio_equipment'],
  },
];

// A negation cue immediately before the mention (up to two filler words:
// "sin usar barra", "nada de peso muerto con barra"). Punctuation between the
// cue and the mention breaks the window on purpose — "sin descanso, barra y
// mancuernas" is not a negation of the barbell.
const NEGATION_WINDOW =
  /\b(?:sin|nada de|no tengo|no hay|no quiero|no uses?|evitar?|olvidate de)\s+(?:[a-z]+\s+){0,2}$/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface EquipmentMentions {
  policy: EquipmentPolicy;
  /** The material the user affirmatively mentioned, in their words. */
  labels: string[];
}

/**
 * Read the user's raw text for equipment intent. A concept mentioned at least
 * once WITHOUT a negation cue counts as named (allow); a concept whose every
 * mention is negated counts as excluded (deny). Nothing found → empty policy,
 * i.e. "the location baseline stands" — today's behaviour, untouched.
 */
export function inferEquipmentMentions(text: string): EquipmentMentions {
  const t = normalize(text);
  const allow: EquipmentTag[] = [];
  const deny: EquipmentTag[] = [];
  const labels: string[] = [];

  for (const concept of CONCEPTS) {
    let positive = false;
    let negative = false;
    concept.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = concept.pattern.exec(t)) !== null) {
      if (NEGATION_WINDOW.test(t.slice(0, m.index))) negative = true;
      else positive = true;
      if (m.index === concept.pattern.lastIndex) concept.pattern.lastIndex += 1; // zero-width guard
    }
    if (positive) {
      labels.push(concept.label);
      for (const tag of concept.tags) if (!allow.includes(tag)) allow.push(tag);
    } else if (negative) {
      for (const tag of concept.tags) if (!deny.includes(tag)) deny.push(tag);
    }
  }

  return { policy: { allow, deny }, labels };
}

/** Free-form material word (the model's `equipment` array) → tags. Additive only. */
export function tagsFromEquipmentWord(word: string): EquipmentTag[] {
  const w = normalize(word);
  const tags: EquipmentTag[] = [];
  for (const concept of CONCEPTS) {
    concept.pattern.lastIndex = 0;
    if (concept.pattern.test(w)) {
      for (const tag of concept.tags) if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return tags;
}

// ======================== RESOLUTION ========================

/** What a place offers when the user says nothing about material. Unchanged. */
const LOCATION_BASELINE: Record<NonNullable<SessionLocation>, EquipmentTag[]> = {
  gym: ['machines_full_gym', 'barbell_plates', 'dumbbells'],
  casa: [],
  aire_libre: [],
};

export interface EquipmentResolution {
  /** The tags the builders gate on. Never empty (falls back to bodyweight). */
  tags: EquipmentTag[];
  /** The user explicitly constrained the material (named and/or negated). */
  restricted: boolean;
  /**
   * May ungated (bodyweight) movements be first-class picks? False only when the
   * user named a non-bodyweight set: on a "full máquinas" day, a towel row is an
   * honest last resort, never a headline choice.
   */
  bodyweightAllowed: boolean;
}

/** The fields the resolution reads. All optional, so a partial brief works. */
export interface EquipmentContext {
  location?: SessionLocation;
  /** Free-form material words (the model's echo). Additive, never restrictive. */
  equipment?: string[];
  equipmentPolicy?: EquipmentPolicy;
}

/**
 * The single place where location, the user's words and their negations become
 * a concrete tag set. Everything that gates an exercise — the focus composer,
 * the starter templates, the LLM vocabulary — resolves through here.
 */
export function resolveEquipment(ctx: EquipmentContext): EquipmentResolution {
  const policy = ctx.equipmentPolicy ?? EMPTY_EQUIPMENT_POLICY;
  const allow = new Set(policy.allow);
  const deny = new Set(policy.deny);
  const restricted = allow.size > 0 || deny.size > 0;

  // Rule 1: a named set REPLACES the baseline. Rule 3: no mention → baseline
  // plus whatever loose words the model echoed back (additive, as before).
  const tags = new Set<EquipmentTag>();
  if (allow.size > 0) {
    for (const tag of allow) tags.add(tag);
  } else {
    for (const tag of ctx.location ? LOCATION_BASELINE[ctx.location] : []) tags.add(tag);
    for (const word of ctx.equipment ?? []) {
      for (const tag of tagsFromEquipmentWord(word)) tags.add(tag);
    }
  }

  // Rule 2: negation subtracts, whatever the source of the tag.
  for (const tag of deny) tags.delete(tag);

  if (tags.size === 0) tags.add('bodyweight');

  const bodyweightAllowed = deny.has('bodyweight')
    ? false
    : allow.size === 0 || allow.has('bodyweight');

  return { tags: [...tags], restricted, bodyweightAllowed };
}

/** The set an exercise must intersect to be usable. Includes the bodyweight escape. */
export function allowedEquipmentSet(resolution: EquipmentResolution): Set<EquipmentTag> {
  const set = new Set(resolution.tags);
  if (resolution.bodyweightAllowed) set.add('bodyweight');
  return set;
}
