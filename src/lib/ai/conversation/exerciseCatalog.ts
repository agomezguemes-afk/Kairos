// KAIROS — The curated exercise catalog for focus-aware sessions.
//
// Extracted from focusSession.ts so it has TWO readers, not one:
//   · focusSession.ts composes the deterministic block from these slots.
//   · canonicalizeExercises.ts harvests them into the vocabulary index, which
//     gives every catalog movement a muscle-group tag (so it can be offered to
//     the LLM on a focused day) and an exact equipment gate (so it can be
//     WITHHELD from the LLM on a restricted day). Without this, "Remo en polea"
//     was invisible to the prompt bias: it isn't in the exercise library, so it
//     carried no muscle groups and scored 0.
//
// Option lists are ordered by PREFERENCE and resolved with "first option the
// user's equipment allows wins". Two rules keep the catalog extensible without
// moving anyone's cheese:
//
//   · A machine/cable variant is inserted BELOW its free-weight siblings. A full
//     gym (barbell + dumbbells + machines) therefore keeps the exact movement it
//     picked before — the cable row is only reached once the barbell and the
//     dumbbell are gone, i.e. on a "full máquinas" day.
//   · Where today's pick for a gym athlete is already the ungated (bodyweight)
//     option — dips, calf raises, hanging leg raises — we add NO machine variant.
//     Reordering there would silently swap a movement that carries a libraryId
//     (the progression memory's tier-1 match) for one that doesn't.
//
// Node-safe: types + pure data. No store, no transport.

import type { Discipline, MuscleGroup } from '../../../types/core';
import type { EquipmentTag } from '../../../types/profile';
import type { ExerciseOption, ExerciseSlot, PerLevel } from '../../routines/starterTemplates';
import { lv } from '../../routines/starterTemplates';

// ======================== MODEL ========================

/** Compound → accessory → finisher. Drives both ranking and block order. */
export type Tier = 0 | 1 | 2;

export interface FocusSlot {
  /**
   * The groups this movement is a legitimate CHOICE for — its training purpose,
   * not every muscle it touches. Bench press brushes the front delts, but a
   * shoulder day led by bench press is exactly the incoherence we're fixing, so
   * its groups are ['chest']. A deadlift, by contrast, IS a back exercise, so it
   * carries 'back' and can headline a pull day.
   */
  groups: MuscleGroup[];
  /** The group it's chosen FOR. A slot whose primary is on-target outranks a spillover. */
  primary: MuscleGroup;
  tier: Tier;
  /**
   * Only used when the equipment leaves too little to build a session — a
   * towel row belongs in a bodyweight pull day, never in a full gym.
   */
  fallbackOnly?: boolean;
  slot: Omit<ExerciseSlot, 'options'> & { options: ExerciseOption[] };
}

const fallback = (fs: FocusSlot): FocusSlot => ({ ...fs, fallbackOnly: true });

const strengthSlot = (
  groups: MuscleGroup[],
  primary: MuscleGroup,
  tier: Tier,
  options: ExerciseOption[],
  sets: PerLevel<number>,
  reps: PerLevel<number>,
  rest: PerLevel<number>,
): FocusSlot => ({
  groups,
  primary,
  tier,
  slot: { options, cardDiscipline: 'strength', sets, reps, rest },
});

const holdSlot = (
  primary: MuscleGroup,
  options: ExerciseOption[],
  sets: PerLevel<number>,
  duration: PerLevel<number>,
  rest: PerLevel<number>,
): FocusSlot => ({
  groups: ['core'],
  primary,
  tier: 2,
  // Calisthenics cards hold SECONDS in `duration` (the "Hold time" field).
  slot: { options, cardDiscipline: 'calisthenics', sets, duration, rest },
});

const BARBELL: EquipmentTag[] = ['barbell_plates'];
const FREE_WEIGHT: EquipmentTag[] = ['dumbbells', 'kettlebell'];
const MACHINES: EquipmentTag[] = ['machines_full_gym'];
const BANDS: EquipmentTag[] = ['resistance_bands'];

/**
 * The curated pool. Option lists mirror the starter templates' gating idiom
 * (heaviest first, bodyweight last) and reuse their exact spellings, so history
 * recorded from a template block and from a focused block are the same rows.
 */
export const FOCUS_CATALOG: FocusSlot[] = [
  // ── Legs ──
  strengthSlot(
    ['quads', 'glutes'],
    'quads',
    0,
    [
      { name: 'Sentadilla con barra', needsAny: BARBELL },
      { name: 'Sentadilla goblet', needsAny: FREE_WEIGHT },
      { name: 'Prensa de pierna', needsAny: MACHINES },
      { name: 'Sentadilla peso corporal' },
    ],
    lv(3, 4, 5),
    lv(8, 6, 5),
    lv(120, 150, 180),
  ),
  // Loaded hip hinge: the library counts it as back work too, so it can headline
  // a pull day. Gated on purpose — its unloaded cousin (Puente de glúteo, below)
  // is a glute exercise, NOT a back one, and must never inherit that role.
  // No machine option by design: there is no honest machine deadlift, so a
  // machines-only day drops this slot and covers hamstrings with the leg curl.
  strengthSlot(
    ['hamstrings', 'glutes', 'back'],
    'hamstrings',
    0,
    [
      { name: 'Peso muerto', needsAny: BARBELL },
      { name: 'Peso muerto rumano con mancuernas', needsAny: FREE_WEIGHT },
    ],
    lv(3, 4, 4),
    lv(8, 6, 6),
    lv(150, 180, 180),
  ),
  strengthSlot(
    ['quads', 'glutes'],
    'quads',
    1,
    [
      { name: 'Zancadas con mancuernas', needsAny: FREE_WEIGHT },
      { name: 'Zancadas en multipower', needsAny: MACHINES },
      { name: 'Zancadas' },
    ],
    lv(3, 3, 4),
    lv(10, 10, 12),
    lv(90, 90, 120),
  ),
  strengthSlot(
    ['glutes', 'hamstrings'],
    'glutes',
    1,
    [
      { name: 'Hip thrust', needsAny: [...BARBELL, ...FREE_WEIGHT, ...MACHINES] },
      { name: 'Puente de glúteo' },
    ],
    lv(3, 3, 4),
    lv(12, 10, 10),
    lv(90, 90, 90),
  ),
  strengthSlot(
    ['hamstrings'],
    'hamstrings',
    1,
    [{ name: 'Curl femoral', needsAny: MACHINES }],
    lv(3, 3, 4),
    lv(12, 12, 10),
    lv(60, 60, 90),
  ),
  strengthSlot(
    ['quads'],
    'quads',
    1,
    [{ name: 'Extensiones de cuádriceps', needsAny: MACHINES }],
    lv(3, 3, 4),
    lv(12, 12, 10),
    lv(60, 60, 90),
  ),
  // Ungated on purpose: a standing calf raise needs nothing, and today's gym day
  // picks exactly this. No machine sibling — see the header note.
  strengthSlot(
    ['calves'],
    'calves',
    1,
    [{ name: 'Elevaciones gemelos' }],
    lv(3, 4, 4),
    lv(15, 15, 20),
    lv(45, 45, 60),
  ),

  // ── Back ──
  strengthSlot(
    ['back'],
    'back',
    0,
    [
      { name: 'Remo con barra', needsAny: BARBELL },
      { name: 'Remo con mancuerna', needsAny: FREE_WEIGHT },
      { name: 'Remo en polea', needsAny: MACHINES },
      { name: 'Remo con banda', needsAny: BANDS },
      { name: 'Remo invertido' },
    ],
    lv(3, 4, 4),
    lv(10, 8, 8),
    lv(90, 120, 120),
  ),
  strengthSlot(
    ['back'],
    'back',
    0,
    [
      { name: 'Dominadas', needsAny: ['pull_up_bar'] },
      { name: 'Jalón al pecho', needsAny: MACHINES },
      { name: 'Pull-down con banda', needsAny: BANDS },
      { name: 'Superman + remo toalla' },
    ],
    lv(3, 4, 4),
    lv(6, 8, 8),
    lv(120, 120, 150),
  ),
  // The second accessory pull: whatever the athlete has left after the two
  // compounds. The machine/cable rows and the pull-overs sit below the free
  // weights, so a full gym still lands on the dumbbell row it landed on before,
  // and a machines-only day lands on the cable row instead of a towel row.
  strengthSlot(
    ['back'],
    'back',
    1,
    [
      { name: 'Jalón al pecho', needsAny: MACHINES },
      { name: 'Remo con mancuerna', needsAny: FREE_WEIGHT },
      { name: 'Remo con banda', needsAny: BANDS },
      { name: 'Remo en máquina', needsAny: MACHINES },
      { name: 'Pull-over en polea', needsAny: MACHINES },
      { name: 'Pull-over con mancuerna', needsAny: FREE_WEIGHT },
      { name: 'Pull-over con banda', needsAny: BANDS },
      { name: 'Remo invertido' },
    ],
    lv(3, 3, 4),
    lv(10, 10, 12),
    lv(90, 90, 90),
  ),
  strengthSlot(
    ['back', 'shoulders'],
    'back',
    2,
    [
      { name: 'Face pull', needsAny: [...MACHINES, ...BANDS] },
      { name: 'Pájaros', needsAny: FREE_WEIGHT },
    ],
    lv(3, 3, 3),
    lv(15, 15, 15),
    lv(60, 60, 60),
  ),
  // The one back movement that needs nothing at all — keeps a bodyweight pull
  // day from being two exercises long, and stays out of everyone else's.
  fallback(
    strengthSlot(
      ['back'],
      'back',
      2,
      [{ name: 'Superman + remo toalla' }],
      lv(3, 3, 3),
      lv(12, 15, 15),
      lv(60, 60, 60),
    ),
  ),

  // ── Chest ──
  strengthSlot(
    ['chest'],
    'chest',
    0,
    [
      { name: 'Press banca', needsAny: BARBELL },
      { name: 'Press banca mancuernas', needsAny: ['dumbbells'] },
      { name: 'Press en máquina', needsAny: MACHINES },
      { name: 'Flexiones' },
    ],
    lv(3, 4, 5),
    lv(8, 6, 5),
    lv(120, 150, 180),
  ),
  // "Press en máquina" would collide with the slot above on a machines-only day
  // (same movement, already taken) and leave this slot empty — hence the incline
  // machine press, a genuinely different row.
  strengthSlot(
    ['chest'],
    'chest',
    0,
    [
      { name: 'Press inclinado', needsAny: BARBELL },
      { name: 'Press mancuernas', needsAny: ['dumbbells'] },
      { name: 'Press inclinado en máquina', needsAny: MACHINES },
      { name: 'Flexiones declinadas' },
    ],
    lv(3, 3, 4),
    lv(10, 8, 8),
    lv(90, 120, 120),
  ),
  strengthSlot(
    ['chest'],
    'chest',
    1,
    [
      { name: 'Aperturas mancuernas', needsAny: ['dumbbells'] },
      { name: 'Aperturas con banda', needsAny: BANDS },
      { name: 'Cruce de poleas', needsAny: MACHINES },
    ],
    lv(3, 3, 3),
    lv(12, 12, 15),
    lv(60, 60, 60),
  ),
  strengthSlot(
    ['chest', 'triceps'],
    'chest',
    1,
    [{ name: 'Fondos' }],
    lv(3, 3, 4),
    lv(8, 10, 12),
    lv(90, 90, 90),
  ),

  // ── Shoulders ──
  strengthSlot(
    ['shoulders'],
    'shoulders',
    0,
    [
      { name: 'Press militar', needsAny: ['barbell_plates', 'dumbbells'] },
      { name: 'Press de hombro en máquina', needsAny: MACHINES },
      { name: 'Pike push-ups' },
    ],
    lv(3, 3, 4),
    lv(10, 8, 8),
    lv(90, 90, 120),
  ),
  strengthSlot(
    ['shoulders'],
    'shoulders',
    1,
    [
      { name: 'Elevaciones laterales', needsAny: ['dumbbells', 'resistance_bands', 'kettlebell'] },
      { name: 'Elevaciones laterales en polea', needsAny: MACHINES },
    ],
    lv(3, 3, 4),
    lv(15, 12, 12),
    lv(45, 60, 60),
  ),
  strengthSlot(
    ['shoulders'],
    'shoulders',
    1,
    [
      { name: 'Pájaros', needsAny: ['dumbbells', 'resistance_bands'] },
      { name: 'Face pull', needsAny: MACHINES },
    ],
    lv(3, 3, 3),
    lv(15, 15, 15),
    lv(45, 60, 60),
  ),

  // ── Arms ──
  strengthSlot(
    ['biceps'],
    'biceps',
    1,
    [
      { name: 'Curl con barra', needsAny: BARBELL },
      { name: 'Curl mancuernas', needsAny: FREE_WEIGHT },
      { name: 'Curl con banda', needsAny: BANDS },
      { name: 'Curl en polea', needsAny: MACHINES },
    ],
    lv(3, 3, 4),
    lv(12, 10, 10),
    lv(60, 60, 90),
  ),
  strengthSlot(
    ['biceps', 'forearms'],
    'biceps',
    1,
    [
      { name: 'Curl martillo', needsAny: FREE_WEIGHT },
      { name: 'Curl en máquina', needsAny: MACHINES },
    ],
    lv(3, 3, 3),
    lv(12, 10, 10),
    lv(60, 60, 60),
  ),
  strengthSlot(
    ['triceps'],
    'triceps',
    1,
    [{ name: 'Extensiones tríceps polea', needsAny: [...MACHINES, ...BANDS] }],
    lv(3, 3, 4),
    lv(12, 12, 10),
    lv(60, 60, 60),
  ),
  strengthSlot(
    ['triceps'],
    'triceps',
    1,
    [
      { name: 'Press francés', needsAny: ['barbell_plates', 'dumbbells'] },
      { name: 'Extensiones tríceps sobre la cabeza en polea', needsAny: MACHINES },
    ],
    lv(3, 3, 4),
    lv(12, 10, 10),
    lv(60, 90, 90),
  ),
  strengthSlot(
    ['triceps'],
    'triceps',
    1,
    [{ name: 'Fondos de tríceps en banco' }],
    lv(3, 3, 4),
    lv(10, 12, 15),
    lv(60, 60, 90),
  ),
  strengthSlot(
    ['triceps'],
    'triceps',
    2,
    [{ name: 'Flexiones diamante' }],
    lv(3, 3, 3),
    lv(8, 10, 12),
    lv(60, 60, 60),
  ),

  // ── Core ──
  holdSlot('core', [{ name: 'Plancha' }], lv(3, 3, 4), lv(30, 45, 60), lv(45, 60, 60)),
  holdSlot('core', [{ name: 'Hollow hold' }], lv(3, 3, 4), lv(20, 30, 45), lv(45, 60, 60)),
  {
    groups: ['core'],
    primary: 'core',
    tier: 2,
    slot: {
      options: [
        { name: 'Elevaciones piernas colgado', needsAny: ['pull_up_bar'] },
        { name: 'Elevaciones de piernas' },
      ],
      cardDiscipline: 'calisthenics',
      sets: lv(3, 3, 4),
      reps: lv(10, 12, 15),
      rest: lv(60, 60, 60),
    },
  },
  holdSlot(
    'core',
    [{ name: 'Core anti-rotación (plancha lateral)' }],
    lv(2, 3, 3),
    lv(20, 30, 40),
    lv(45, 45, 60),
  ),
];

// ======================== VOCABULARY VIEW ========================

export interface CatalogVocabEntry {
  name: string;
  groups: MuscleGroup[];
  /** Exactly the option's gate. An ungated option is bodyweight, and says so. */
  equipment: EquipmentTag[];
  discipline: Discipline;
}

let CACHED: CatalogVocabEntry[] | null = null;

/**
 * Every option in the catalog, flattened, with its muscle groups and its exact
 * equipment gate. A name reachable from several slots merges the union of both —
 * "Face pull" is a back AND a shoulder choice, "Jalón al pecho" is reachable
 * from two back slots.
 */
export function catalogVocabulary(): CatalogVocabEntry[] {
  if (CACHED) return CACHED;
  const byName = new Map<string, CatalogVocabEntry>();
  for (const fs of FOCUS_CATALOG) {
    for (const opt of fs.slot.options) {
      const equipment: EquipmentTag[] = opt.needsAny ? [...opt.needsAny] : ['bodyweight'];
      const existing = byName.get(opt.name);
      if (!existing) {
        byName.set(opt.name, {
          name: opt.name,
          groups: [...fs.groups],
          equipment,
          discipline: fs.slot.cardDiscipline,
        });
        continue;
      }
      for (const g of fs.groups) if (!existing.groups.includes(g)) existing.groups.push(g);
      for (const e of equipment) if (!existing.equipment.includes(e)) existing.equipment.push(e);
    }
  }
  CACHED = [...byName.values()];
  return CACHED;
}
