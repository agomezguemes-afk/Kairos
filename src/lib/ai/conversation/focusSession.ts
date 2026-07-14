// KAIROS — Focus-aware session composer (the deterministic path's ears).
//
// The bug this fixes (observed on-device, 2026-07): "entreno de espalda, 40
// minutos, full máquinas" returned Sentadilla + Press banca + Remo + Press
// militar — a generic full-body skeleton. Reason: SessionBrief.focus never
// reached the builder. briefToStarterAnswers only carries {discipline, level,
// frequency, equipment}, so EVERY strength brief resolved to the same
// STRENGTH.dayA template regardless of what the user asked for.
//
// The fix is a selection layer, not a new template system: a catalog of curated
// exercise slots tagged with the muscle groups they train, filtered by the
// brief's focus (mapped through focusMuscleGroups — the SAME mapping the LLM
// vocabulary bias uses), gated by the user's equipment exactly like the starter
// templates, and assembled with the starter templates' own card builder
// (buildBlockFromTemplate). Curated slot lists in, coherent block out.
//
// Contract:
//   · No focus, unrecognised focus, or a discipline where muscle groups are
//     meaningless (running, mobility…) → returns null. The caller keeps the
//     curated full-body template. Unchanged, honest default.
//   · Every option name is canonical vocabulary (see canonicalizeExercises), so
//     the progression memory keeps matching — by libraryId where the library
//     knows the movement, by stable name otherwise.
//   · An option whose equipment gate isn't satisfied is skipped, never
//     substituted for something the user can't do: a home session simply drops
//     the machine slots. If fewer than MIN_EXERCISES survive, we return null
//     rather than ship a two-line session.
//
// Node-safe: pure. No store, no transport.

import type { MuscleGroup } from '../../../types/core';
import type { EquipmentTag } from '../../../types/profile';
import type {
  BlockTemplate,
  ExerciseOption,
  ExerciseSlot,
  PerLevel,
  StarterAnswers,
} from '../../routines/starterTemplates';
import { lv } from '../../routines/starterTemplates';
import { canonicalizeExerciseName, focusMuscleGroups } from './canonicalizeExercises';
import type { SessionBrief } from './types';

// ======================== CATALOG MODEL ========================

/** Compound → accessory → finisher. Drives both ranking and block order. */
type Tier = 0 | 1 | 2;

interface FocusSlot {
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
const CATALOG: FocusSlot[] = [
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
    [{ name: 'Zancadas con mancuernas', needsAny: FREE_WEIGHT }, { name: 'Zancadas' }],
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
  strengthSlot(
    ['back'],
    'back',
    1,
    [
      { name: 'Jalón al pecho', needsAny: MACHINES },
      { name: 'Remo con mancuerna', needsAny: FREE_WEIGHT },
      { name: 'Remo con banda', needsAny: BANDS },
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
  strengthSlot(
    ['chest'],
    'chest',
    0,
    [
      { name: 'Press inclinado', needsAny: BARBELL },
      { name: 'Press mancuernas', needsAny: ['dumbbells'] },
      { name: 'Press en máquina', needsAny: MACHINES },
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
    [{ name: 'Elevaciones laterales', needsAny: ['dumbbells', 'resistance_bands', 'kettlebell'] }],
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
    ],
    lv(3, 3, 4),
    lv(12, 10, 10),
    lv(60, 60, 90),
  ),
  strengthSlot(
    ['biceps', 'forearms'],
    'biceps',
    1,
    [{ name: 'Curl martillo', needsAny: FREE_WEIGHT }],
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
    [{ name: 'Press francés', needsAny: ['barbell_plates', 'dumbbells'] }],
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

// ======================== SELECTION ========================

/** Muscle-group focus only means something for these. A "rodaje suave" has no lats. */
const FOCUSABLE: StarterAnswers['discipline'][] = ['strength', 'calisthenics', 'hybrid'];

const MAX_EXERCISES = 6;
/** Exercise count when the user never said how long they have. */
const DEFAULT_EXERCISES = 4;
/** A session may run this much over the asked duration before we stop adding. */
const DURATION_TOLERANCE = 1.15;
/** Below this, a "session" isn't one — better to ship the curated template. */
const MIN_VIABLE = 2;
/** Under this many real candidates, the fallback-only movements are unlocked. */
const MIN_DECENT = 3;

/** Same arithmetic as calculateBlockStats: 45 s of work per set + inter-set rest. */
function estimatedMinutes(slot: ExerciseSlot, level: StarterAnswers['level']): number {
  const sets = slot.sets[level];
  const rest = slot.rest[level];
  return (sets * 45 + Math.max(0, sets - 1) * rest) / 60;
}

interface Candidate {
  focusSlot: FocusSlot;
  /** The one option the user's equipment allows, already canonicalized. */
  option: ExerciseOption;
  minutes: number;
}

/**
 * Rank: compounds before accessories; within a tier, movements chosen FOR the
 * asked focus before spillover (a deadlift is a back movement, but a back day
 * leads with rows). Ties keep catalog order — deterministic, no randomness.
 */
function rank(a: FocusSlot, ai: number, b: FocusSlot, bi: number, targets: MuscleGroup[]): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  const ap = targets.includes(a.primary) ? 0 : 1;
  const bp = targets.includes(b.primary) ? 0 : 1;
  if (ap !== bp) return ap - bp;
  return ai - bi;
}

/**
 * Resolve each on-target slot to the best option the user can actually do,
 * skipping any movement already taken (a gym user gets "Remo con barra" then
 * "Jalón al pecho", never the same row twice) and dropping slots whose every
 * option is gated behind equipment the user doesn't have.
 */
function resolveCandidates(
  targets: MuscleGroup[],
  answers: StarterAnswers,
  onTarget: (slot: FocusSlot) => boolean,
): Candidate[] {
  const ordered = CATALOG.map((focusSlot, i) => ({ focusSlot, i }))
    .filter(({ focusSlot }) => onTarget(focusSlot))
    .sort((a, b) => rank(a.focusSlot, a.i, b.focusSlot, b.i, targets));

  const used = new Set<string>();
  const resolve = (which: boolean): Candidate[] => {
    const out: Candidate[] = [];
    for (const { focusSlot } of ordered) {
      if ((focusSlot.fallbackOnly ?? false) !== which) continue;
      const option = focusSlot.slot.options.find((opt) => {
        const available = !opt.needsAny || opt.needsAny.some((t) => answers.equipment.includes(t));
        return available && !used.has(canonicalizeExerciseName(opt.name).name);
      });
      if (!option) continue;
      used.add(canonicalizeExerciseName(option.name).name);
      out.push({ focusSlot, option, minutes: estimatedMinutes(focusSlot.slot, answers.level) });
    }
    return out;
  };

  // Real movements first; the bodyweight stand-ins only if the equipment left
  // us short. A gym back day never has to reach for a towel row.
  const main = resolve(false);
  return main.length >= MIN_DECENT ? main : [...main, ...resolve(true)];
}

/**
 * Pick the session: cover every asked muscle group first (a leg day gets a
 * squat AND a hinge AND calves before it gets a second squat pattern), then
 * fill in rank order until the duration budget — or the exercise ceiling — says
 * stop. With no stated duration we land on DEFAULT_EXERCISES, matching the
 * curated templates' density.
 */
function select(
  candidates: Candidate[],
  targets: MuscleGroup[],
  durationMin: number | null,
): Candidate[] {
  const picked = new Set<Candidate>();
  const covered = new Set<MuscleGroup>();
  const budget = durationMin != null ? durationMin * DURATION_TOLERANCE : null;
  let spent = 0;

  const fits = (c: Candidate): boolean => {
    if (picked.size >= MAX_EXERCISES) return false;
    if (budget == null) return picked.size < DEFAULT_EXERCISES;
    // Always allow a viable minimum: a 15-minute ask still gets a real session.
    if (picked.size < MIN_VIABLE) return true;
    return spent + c.minutes <= budget;
  };

  const take = (c: Candidate): void => {
    picked.add(c);
    spent += c.minutes;
    for (const g of c.focusSlot.groups) if (targets.includes(g)) covered.add(g);
  };

  // Coverage pass — one movement per asked group, in rank order.
  for (const c of candidates) {
    if (!fits(c)) break;
    const adds = c.focusSlot.groups.some((g) => targets.includes(g) && !covered.has(g));
    if (adds) take(c);
  }
  // Fill pass — depth on the focus, still in rank order.
  for (const c of candidates) {
    if (picked.has(c)) continue;
    if (!fits(c)) break;
    take(c);
  }

  // Emit in rank order, not selection order: compounds lead the block.
  return candidates.filter((c) => picked.has(c));
}

// ======================== PUBLIC API ========================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The brief's focus → a curated, equipment-aware BlockTemplate, or null when
 * the focus is absent/unrecognised, the discipline isn't muscle-group shaped,
 * or the user's equipment leaves too little to build a real session. Null means
 * "use the curated full-body template" — the caller's unchanged default.
 */
export function buildFocusSessionTemplate(
  brief: SessionBrief,
  answers: StarterAnswers,
): BlockTemplate | null {
  if (!FOCUSABLE.includes(answers.discipline)) return null;

  const targets = focusMuscleGroups(brief.focus);
  if (targets.length === 0) return null;

  const onTarget = (fs: FocusSlot): boolean => fs.groups.some((g) => targets.includes(g));
  const candidates = resolveCandidates(targets, answers, onTarget);
  const chosen = select(candidates, targets, brief.durationMin);
  if (chosen.length < MIN_VIABLE) return null;

  // A calisthenics athlete logs reps and holds, not kilos.
  const asCalisthenics = answers.discipline === 'calisthenics';

  const slots: ExerciseSlot[] = chosen.map(({ focusSlot, option }) => ({
    ...focusSlot.slot,
    options: [option],
    cardDiscipline: asCalisthenics ? 'calisthenics' : focusSlot.slot.cardDiscipline,
  }));

  const focusLabel = capitalize((brief.focus ?? '').trim());
  return {
    name: focusLabel.length > 0 ? focusLabel : 'Sesión enfocada',
    description: `Sesión enfocada en ${brief.focus}. Básicos primero, accesorios después.`,
    slots,
  };
}
