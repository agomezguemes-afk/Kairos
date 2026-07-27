// KAIROS — Progression engine: enrich a freshly built block with history.
//
// The user-visible payoff of "memoria que compone": a block Kai just generated
// already carries your last weights/paces. applyProgression walks the block's
// top-level exercise nodes (the content model is flat — column/subBlock wrappers
// group siblings, they don't nest exercises), matches each against history by
// libraryId/name, and pre-fills every set's values with the suggested numbers.
//
// Pure + immutable: returns a new block, never mutates the input. Exercises with
// no history pass through untouched — a first-ever session stays blank, honestly.

import type { WorkoutBlock, ExerciseCard, ExerciseSet } from '../../types/core';
import type { ContentNode } from '../../types/content';
import type { WorkoutHistoryEntry } from '../../store/workoutStore';
import type { AdaptationSignal } from '../readiness/adaptiveEngine';
import { readExerciseHistory } from './readExerciseHistory';
import { suggestNextValues, WEIGHT_NUDGE_KG } from './suggestNextValues';
import type { SuggestionBasis } from './types';

/**
 * The RPE nudge is a *working-set* prescription: it says "last working set felt
 * easy/hard, so start 2.5 kg up/down". A warmup set should NOT inherit it — a
 * warmup is a ramp to that working weight, not a rep-out at it. So warmup sets
 * carry the last weight forward un-nudged. Only `weight` is ever nudged, so we
 * reverse it by the fixed step the nudge added.
 *
 * NOTE: as of this pass no build path tags generated sets with kind='warmup'
 * (starter templates, the hybrid preset and the AI builder all emit plain
 * working sets), so this branch is a correct no-op today. It becomes load-
 * bearing the moment warmup-tagging exists — leaving the uniform-fill bug fixed
 * ahead of the UI rather than after it.
 */
function carryForwardValues(
  suggested: Record<string, number>,
  basis: Record<string, SuggestionBasis>,
): Record<string, number> {
  const weight = suggested['weight'];
  if (typeof weight !== 'number') return suggested;
  if (basis['weight'] === 'nudge-up')
    return { ...suggested, weight: Math.max(0, weight - WEIGHT_NUDGE_KG) };
  if (basis['weight'] === 'nudge-down') return { ...suggested, weight: weight + WEIGHT_NUDGE_KG };
  return suggested;
}

/** Pre-fill one exercise's sets + goals from its suggestion. */
function enrichExercise(
  exercise: ExerciseCard,
  history: WorkoutHistoryEntry[],
  adaptation?: AdaptationSignal,
): ExerciseCard {
  const hist = readExerciseHistory(history, {
    name: exercise.name,
    libraryId: exercise.libraryId,
  });
  const suggestion = suggestNextValues(exercise.fields, hist, adaptation);
  const suggested = suggestion.values;
  if (Object.keys(suggested).length === 0) return exercise;

  const warmupValues = carryForwardValues(suggested, suggestion.basis);
  const sets: ExerciseSet[] = exercise.sets.map((s) => ({
    ...s,
    values: { ...s.values, ...(s.kind === 'warmup' ? warmupValues : suggested) },
  }));

  const goalWeight =
    typeof suggested['weight'] === 'number' ? suggested['weight'] : exercise.goalWeight;
  const goalReps = typeof suggested['reps'] === 'number' ? suggested['reps'] : exercise.goalReps;

  return {
    ...exercise,
    sets,
    goalWeight,
    goalReps,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Return a copy of `block` with every exercise that matches history pre-filled
 * with its suggested next values. No-op for exercises without history.
 */
export function applyProgression(
  block: WorkoutBlock,
  history: WorkoutHistoryEntry[],
  adaptation?: AdaptationSignal,
): WorkoutBlock {
  if (history.length === 0) return block;

  let changed = false;
  const content: ContentNode[] = block.content.map((node) => {
    if (node.type !== 'exercise') return node;
    const enriched = enrichExercise(node.data.exercise, history, adaptation);
    if (enriched === node.data.exercise) return node;
    changed = true;
    return { ...node, data: { ...node.data, exercise: enriched } };
  });

  if (!changed) return block;
  return { ...block, content, updated_at: new Date().toISOString() };
}
