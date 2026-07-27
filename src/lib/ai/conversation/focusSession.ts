// KAIROS — Focus-aware session composer (the deterministic path's ears).
//
// The bug this fixed first (observed on-device, 2026-07): "entreno de espalda,
// 40 minutos, full máquinas" returned Sentadilla + Press banca + Remo + Press
// militar — a generic full-body skeleton, because SessionBrief.focus never
// reached the builder. The composer below is the selection layer that fixed it:
// a catalog of curated slots (see exerciseCatalog.ts) tagged with the muscle
// groups they train, filtered by the brief's focus, gated by the user's
// equipment, and assembled with the starter templates' own card builder.
//
// The bug it fixes NOW: the same sentence still led with Remo con barra + Peso
// muerto, because "full máquinas" only ever ADDED tags to the gym baseline — it
// could not restrict it. Equipment intent is now resolved once, in equipment.ts,
// and this composer honours two things it returns:
//
//   · `tags` — the allowed equipment. Any option gated behind something else is
//     skipped. Never substituted for a movement the user can't do.
//   · `bodyweightAllowed` — false when the user named a non-bodyweight set. On a
//     "full máquinas" day an ungated movement (towel row, push-up) is NOT a
//     legitimate pick; it is a last resort, unlocked only if the restriction
//     would otherwise starve the session. Degrade honestly, never fake.
//
// Contract:
//   · No focus, unrecognised focus, or a discipline where muscle groups are
//     meaningless (running, mobility…) → returns null. The caller keeps the
//     curated full-body template. Unchanged, honest default.
//   · Every option name is canonical vocabulary (see canonicalizeExercises), so
//     the progression memory keeps matching — by libraryId where the library
//     knows the movement, by stable name otherwise.
//   · If fewer than MIN_VIABLE movements survive even after degradation, we
//     return null rather than ship a two-line session.
//
// Node-safe: pure. No store, no transport.

import type { MuscleGroup } from '../../../types/core';
import type {
  BlockTemplate,
  ExerciseOption,
  ExerciseSlot,
  StarterAnswers,
} from '../../routines/starterTemplates';
import { canonicalizeExerciseName, focusMuscleGroups } from './canonicalizeExercises';
import { resolveEquipment } from './equipment';
import type { FocusSlot } from './exerciseCatalog';
import { FOCUS_CATALOG } from './exerciseCatalog';
import type { SessionBrief } from './types';

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
 * Is this option within reach? An ungated option is a bodyweight movement: it is
 * always physically possible, but on a day the user restricted to machines (or
 * to dumbbells) it is not what they asked for — `bodyweightAllowed` is how the
 * strict pass says so.
 */
function optionAllowed(
  opt: ExerciseOption,
  answers: StarterAnswers,
  bodyweightAllowed: boolean,
): boolean {
  if (!opt.needsAny) return bodyweightAllowed;
  return opt.needsAny.some((tag) => answers.equipment.includes(tag));
}

/**
 * Resolve each on-target slot to the best option the user can actually do,
 * skipping any movement already taken (a gym user gets "Remo con barra" then
 * "Jalón al pecho", never the same row twice) and dropping slots whose every
 * option is gated behind equipment the user doesn't have.
 */
function collect(
  ordered: FocusSlot[],
  answers: StarterAnswers,
  bodyweightAllowed: boolean,
): Candidate[] {
  const used = new Set<string>();

  const pass = (fallbackOnly: boolean): Candidate[] => {
    const out: Candidate[] = [];
    for (const focusSlot of ordered) {
      if ((focusSlot.fallbackOnly ?? false) !== fallbackOnly) continue;
      const option = focusSlot.slot.options.find(
        (opt) =>
          optionAllowed(opt, answers, bodyweightAllowed) &&
          !used.has(canonicalizeExerciseName(opt.name).name),
      );
      if (!option) continue;
      used.add(canonicalizeExerciseName(option.name).name);
      out.push({ focusSlot, option, minutes: estimatedMinutes(focusSlot.slot, answers.level) });
    }
    return out;
  };

  // Real movements first; the bodyweight stand-ins only if the equipment left
  // us short. A gym back day never has to reach for a towel row.
  const main = pass(false);
  return main.length >= MIN_DECENT ? main : [...main, ...pass(true)];
}

/**
 * The strict pool, and — only when a restriction starved it — an honest
 * degradation: re-open the ungated movements the restriction had demoted, and
 * take that pool if it is genuinely bigger. Nothing outside the user's allowed
 * equipment ever comes back: a machines-only day that runs short gets bodyweight
 * accessories, never the barbell it just refused.
 */
function resolveCandidates(
  targets: MuscleGroup[],
  answers: StarterAnswers,
  bodyweightAllowed: boolean,
  onTarget: (slot: FocusSlot) => boolean,
): Candidate[] {
  const ordered = FOCUS_CATALOG.map((focusSlot, i) => ({ focusSlot, i }))
    .filter(({ focusSlot }) => onTarget(focusSlot))
    .sort((a, b) => rank(a.focusSlot, a.i, b.focusSlot, b.i, targets))
    .map(({ focusSlot }) => focusSlot);

  const strict = collect(ordered, answers, bodyweightAllowed);
  if (bodyweightAllowed || strict.length >= MIN_DECENT) return strict;

  const degraded = collect(ordered, answers, true);
  return degraded.length > strict.length ? degraded : strict;
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

  const { bodyweightAllowed } = resolveEquipment(brief);
  const onTarget = (fs: FocusSlot): boolean => fs.groups.some((g) => targets.includes(g));
  const candidates = resolveCandidates(targets, answers, bodyweightAllowed, onTarget);
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
