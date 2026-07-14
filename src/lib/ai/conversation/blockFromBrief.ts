// KAIROS — Deterministic block builder for the conversational loop.
//
// The always-works path: turn a SessionBrief into ONE fully-formed block for
// today and commit it to the store, without touching the LLM. This is both the
// LLM-down fallback and the deterministic mock the unit tests assert against —
// i.e. the honest default, so it has to answer what the user actually asked.
//
// Two ways to reach a block, in order:
//   1. The brief names a focus we understand ("espalda", "piernas", "empuje")
//      → buildFocusSessionTemplate composes a session from the curated catalog,
//      filtered by the focus's muscle groups and the user's equipment.
//   2. No focus, or one we can't map (running, "cuerpo completo", "lo que sea")
//      → the curated starter template for the discipline. Unchanged default.
//
// Both paths go through the same card builder, so sets/reps/rest conventions
// are identical; only the exercise selection differs.
//
// Node-safe: store + templates only. No transport imports.

import { useWorkoutStore } from '../../../store/workoutStore';
import type { WorkoutBlock, ExerciseCard } from '../../../types/core';
import { calculateBlockStats, getBlockExercises } from '../../../types/core';
import { buildBlockFromTemplate, buildStarterBlocks } from '../../routines/starterTemplates';
import { applyProgression } from '../../progression';
import { briefToStarterAnswers } from './brief';
import { canonicalizeBlock } from './canonicalizeExercises';
import { buildFocusSessionTemplate } from './focusSession';
import type { BuiltSession, SessionBrief } from './types';

const USER_ID = 'user_001'; // matches MOCK_USER_ID in workoutStore

/** Honest per-exercise detail, derived from the card's own sets. */
function exerciseDetail(ex: ExerciseCard): string {
  const sets = ex.sets.length;
  return sets > 0 ? `${sets} ${sets === 1 ? 'serie' : 'series'}` : '';
}

function summarize(
  block: WorkoutBlock,
  source: 'ai' | 'template',
  enrichedFromHistory: boolean,
): BuiltSession {
  return {
    blockId: block.id,
    blockName: block.name,
    discipline: block.discipline,
    exercises: getBlockExercises(block)
      .slice(0, 6)
      .map((e) => ({ name: e.name, detail: exerciseDetail(e) })),
    durationMin: calculateBlockStats(block).estimated_duration,
    source,
    enrichedFromHistory,
  };
}

/**
 * Build the summary view-model for an already-committed block id.
 * `enrichedFromHistory` is decided by the caller (it holds the pre/post-
 * progression blocks) — the store copy no longer carries that provenance.
 */
export function summarizeBlock(
  blockId: string,
  source: 'ai' | 'template',
  enrichedFromHistory = false,
): BuiltSession | null {
  const block = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
  return block ? summarize(block, source, enrichedFromHistory) : null;
}

/**
 * Deterministic build: brief → one committed block. Never throws for a valid
 * brief (buildStarterBlocks always yields ≥1 block). The block is renamed to
 * the brief's title, tagged as favorite, and gets a description from the brief.
 */
export function buildSessionBlockDeterministic(brief: SessionBrief): BuiltSession {
  const store = useWorkoutStore.getState();
  const answers = briefToStarterAnswers(brief);
  const sortOrder = store.blocks.length;

  // Focus-aware selection when the brief says what to train; the curated
  // discipline template otherwise.
  const focusTemplate = buildFocusSessionTemplate(brief, answers);
  const base = focusTemplate
    ? // Catalog names are already canonical; this attaches the library ids the
      // progression memory matches on (tier-1) without touching any name.
      canonicalizeBlock(buildBlockFromTemplate(focusTemplate, answers, USER_ID, sortOrder))
    : buildStarterBlocks(answers, USER_ID, sortOrder)[0];

  const description = [
    brief.focus ? `Foco: ${brief.focus}.` : null,
    brief.durationMin ? `~${brief.durationMin} min.` : null,
    brief.location
      ? `En ${brief.location === 'gym' ? 'el gym' : brief.location === 'casa' ? 'casa' : 'exterior'}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const block: WorkoutBlock = {
    ...base,
    name: brief.title || base.name,
    description: description.length > 0 ? description : base.description,
    is_favorite: true,
  };

  // Memoria que compone: pre-fill last weights/paces before the block lands.
  // A changed reference means history actually enriched it — the cue's source.
  const enriched = applyProgression(block, store.workoutHistory);
  const enrichedFromHistory = enriched !== block;

  store.replaceAllBlocks([...store.blocks, enriched]);
  return summarize(enriched, 'template', enrichedFromHistory);
}
