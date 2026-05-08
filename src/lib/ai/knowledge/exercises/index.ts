// Aggregator + filter for the exercise knowledge base.
//
// We DO NOT inject the whole catalog into the prompt — that's ~150 entries
// and would burn tokens. Instead, the chat surfaces call `filterExercises`
// with the user's equipment / injuries / discipline / query keywords and we
// hand back a small, relevant subset (default cap 18 entries).

import type { Discipline } from '../../../../types/core';
import type { EquipmentTag } from '../../../../types/profile';

import { CALISTHENICS_EXERCISES } from './calisthenics';
import { ENDURANCE_EXERCISES } from './endurance';
import { MOBILITY_EXERCISES } from './mobility';
import { SPORT_EXERCISES } from './sport_specific';
import { STRENGTH_EXERCISES } from './strength';
import type { Equipment, ExerciseEntry, MovementPattern } from './types';

export const ALL_EXERCISES: ExerciseEntry[] = [
  ...STRENGTH_EXERCISES,
  ...CALISTHENICS_EXERCISES,
  ...ENDURANCE_EXERCISES,
  ...MOBILITY_EXERCISES,
  ...SPORT_EXERCISES,
];

export const EXERCISE_INDEX: Record<string, ExerciseEntry> = Object.fromEntries(
  ALL_EXERCISES.map((e) => [e.id, e]),
);

// Map UserProfile equipment tags → catalog Equipment ids.
const EQUIPMENT_MAP: Record<EquipmentTag, Equipment[]> = {
  bodyweight: ['bodyweight'],
  dumbbells: ['dumbbells', 'bench'],
  barbell_plates: ['barbell_plates', 'bench'],
  kettlebell: ['kettlebell'],
  resistance_bands: ['resistance_bands'],
  pull_up_bar: ['pull_up_bar'],
  machines_full_gym: ['machine', 'cable', 'bench', 'barbell_plates', 'dumbbells', 'pull_up_bar'],
  cardio_equipment: ['rower', 'treadmill', 'bike'],
  yoga_mat: ['yoga_mat', 'foam_roller'],
  jump_rope: ['jump_rope'],
};

export interface FilterCriteria {
  /** Tags exactly as in UserProfile.equipment. */
  equipment?: EquipmentTag[];
  /** Free text the user typed (already lowercased works too). */
  injuries?: string | null;
  /** Limit results to entries that include this discipline. */
  discipline?: Discipline;
  /** Optional movement pattern bias (push, pull, squat, hinge, ...). */
  pattern?: MovementPattern;
  /** Free-text query keywords. We token-match against name + aliases + tags. */
  queryKeywords?: string[];
  /** Hard cap on output size. Default 18. */
  limit?: number;
}

/**
 * Map a free-form injury phrase to a list of contraindication tags. Keep it
 * small and pragmatic; misses are OK (the model still has the user's text).
 */
function injuriesToTags(injuries: string | null | undefined): string[] {
  if (!injuries) return [];
  const text = injuries.toLowerCase();
  const tags: string[] = [];
  if (/(rodilla|knee)/.test(text)) tags.push('knee_pain');
  if (/(hombro|shoulder)/.test(text)) tags.push('shoulder_pain');
  if (/(espalda|lumbar|lower back|back)/.test(text)) tags.push('lower_back_pain');
  if (/(tobillo|ankle)/.test(text)) tags.push('ankle_pain');
  if (/(muñeca|wrist)/.test(text)) tags.push('wrist_pain');
  return tags;
}

export function filterExercises(criteria: FilterCriteria): ExerciseEntry[] {
  const cap = criteria.limit ?? 18;
  const allowedEquipment = new Set<Equipment>();
  if (criteria.equipment && criteria.equipment.length > 0) {
    for (const tag of criteria.equipment) {
      for (const eq of EQUIPMENT_MAP[tag] ?? []) allowedEquipment.add(eq);
    }
  }
  const contra = new Set(injuriesToTags(criteria.injuries));
  const kw = (criteria.queryKeywords ?? [])
    .map((s) => s.toLowerCase().trim())
    .filter((s) => s.length > 1);

  const scored = ALL_EXERCISES.map((e): { e: ExerciseEntry; score: number } => {
    let score = 0;

    // Discipline gate.
    if (criteria.discipline && !e.disciplines.includes(criteria.discipline)) {
      return { e, score: -1 };
    }
    if (criteria.discipline && e.disciplines.includes(criteria.discipline)) score += 3;

    // Equipment gate. If user listed equipment, drop entries that need
    // anything outside the allowed set. Bodyweight always ok.
    if (allowedEquipment.size > 0) {
      const usable = e.equipment.every(
        (eq) => allowedEquipment.has(eq) || eq === 'bodyweight' || eq === 'open_space',
      );
      if (!usable) return { e, score: -1 };
      if (e.equipment.some((eq) => allowedEquipment.has(eq))) score += 2;
    }

    // Pattern bias.
    if (criteria.pattern && e.pattern === criteria.pattern) score += 4;

    // Contraindication gate.
    if (contra.size > 0) {
      const conflicts = (e.contraindications ?? []).some((c) => contra.has(c));
      if (conflicts) return { e, score: -1 };
    }

    // Keyword score against name / aliases / tags.
    if (kw.length > 0) {
      const haystack = [
        e.name.toLowerCase(),
        ...e.aliases.map((a) => a.toLowerCase()),
        ...(e.tags ?? []),
      ].join(' ');
      for (const k of kw) {
        if (haystack.includes(k)) score += 2;
      }
    }

    return { e, score };
  });

  return scored
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map((x) => x.e);
}

/**
 * Compact prompt-friendly representation. ~1 line per entry. No markdown
 * — keeps the token count down while still telegraphing the catalog shape.
 */
export function renderExercisesForPrompt(entries: ExerciseEntry[]): string {
  if (entries.length === 0) return '';
  const lines = entries.map((e) => {
    const eq = e.equipment.slice(0, 3).join('+');
    const muscles = e.primaryMuscles.slice(0, 3).join('/');
    const lvl = e.minLevel[0]; // b/i/a
    return `- ${e.name} (${e.id}) · ${e.pattern} · ${muscles} · ${eq} · ${lvl}`;
  });
  return ['CATÁLOGO DE EJERCICIOS RELEVANTES:', ...lines].join('\n');
}

export type { ExerciseEntry, MovementPattern, Equipment } from './types';
