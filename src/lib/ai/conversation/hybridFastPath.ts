// KAIROS — Hybrid fast-path for the conversational loop.
//
// When the user's words unambiguously ask for hybrid/race-style work ("algo
// tipo hyrox", "entrenamiento híbrido"), we skip the LLM entirely and seed the
// curated hybrid preset: deterministic, instant, offline-safe, and better than
// anything the generic builder would produce for this ask. seedHybridPreset
// commits the block (addPreparedBlocks) plus the declared week; we additionally
// pin TODAY with a one-off assignment when the seeded weekdays skip it, so the
// "hoy" semantics of the ask always hold.
//
// Node-safe: stores + pure preset only. No transport imports.

import { useScheduleStore } from '../../../store/scheduleStore';
import { useWorkoutStore } from '../../../store/workoutStore';
import { seedHybridPreset } from '../../routines/seedHybridPreset';
import { applyProgression } from '../../progression';
import { summarizeBlock } from './blockFromBrief';
import type { BuiltSession } from './types';

// Tight on purpose: only unmistakable hybrid asks skip the conversation. A
// false positive here would hijack the user's actual request, so anything
// ambiguous stays with the engine (which can still land on the same preset
// vocabulary via its own inference).
const HYBRID_PATTERNS: readonly RegExp[] = [/hyrox/i, /h[íi]brid/i, /\bhybrid\b/i];

/** True when the text unambiguously asks for hybrid/race-style training. */
export function wantsHybridSession(text: string): boolean {
  return HYBRID_PATTERNS.some((re) => re.test(text));
}

export interface HybridSessionOpts {
  /** Personalises the block's intro line. */
  displayName?: string | null;
  /** Sessions/week for the seeded schedule. Preset defaults to 3 when null. */
  weeklyFrequency?: number | null;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Weekday in the preset's 0=Mon … 6=Sun convention. */
function mondayWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Local YYYY-MM-DD (the planner's ISODate convention — no UTC drift). */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Seed the hybrid preset and return the conversational summary. Commits the
 * block via addPreparedBlocks (inside seedHybridPreset) and guarantees today
 * shows the session in the planner. Synchronous and deterministic — the
 * fast-path never touches the network.
 */
export function buildHybridSession(opts: HybridSessionOpts = {}): BuiltSession {
  const now = opts.now ?? new Date();
  const result = seedHybridPreset({
    // Load + engine — the canonical hybrid identity the preset models.
    disciplines: ['strength', 'running'],
    weeklyFrequency: opts.weeklyFrequency ?? null,
    displayName: opts.displayName ?? null,
  });
  const block = result.blocks[0];

  // Memoria que compone: carry forward last paces/weights into the seeded block.
  // A changed reference means history actually enriched it — the cue's source.
  const workoutStore = useWorkoutStore.getState();
  const enriched = applyProgression(block, workoutStore.workoutHistory);
  const enrichedFromHistory = enriched !== block;
  if (enrichedFromHistory) {
    workoutStore.updateBlock(block.id, { content: enriched.content });
  }

  // The user asked for TODAY: if the seeded week skips today, pin a one-off.
  const today = mondayWeekday(now);
  if (!result.weekAssignments.some((w) => w.weekday === today)) {
    useScheduleStore.getState().assignOnce(localISODate(now), block.id);
  }

  const summary = summarizeBlock(block.id, 'template', enrichedFromHistory);
  if (!summary) throw new Error('Hybrid block missing after seed');
  return summary;
}
