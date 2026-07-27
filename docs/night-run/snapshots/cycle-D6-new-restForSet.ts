// restForSet — rest that FOLLOWS a set depends on the completed set's kind
// (BRIEF-07): warmup ramps with a short rest, never longer than the exercise's
// work rest; working/drop/failure keep the full work rest. Pure leaf — only
// imports types, so the store can import it without a cycle.

import type { SetKind } from '../../../types/core';

export const DEFAULT_REST_SECONDS = 90; // espeja el `|| 90` de completeSet
export const WARMUP_REST_SECONDS = 45; // rampa corta, estilo Strong

export function restForSet(kind: SetKind, workRestSeconds: number | undefined): number {
  const work = workRestSeconds && workRestSeconds > 0 ? workRestSeconds : DEFAULT_REST_SECONDS;
  if (kind === 'warmup') return Math.min(work, WARMUP_REST_SECONDS);
  return work;
}
