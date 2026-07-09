// KAIROS — Block coach-mark gate (pure).
//
// Replaces the full-screen PlannerTour: the first Dashboard entry after
// onboarding is a momentum moment, so instead of a 3-page tour we show ONE
// contextual coach-mark anchored to the user's real first block, on the very
// first arrival, dismissable, first-time-only.
//
// The gate reuses `tourCompletedAt` as the "already taught" flag so existing
// users who finished (or skipped) the old tour never see the coach-mark, and a
// single dismissal marks it done forever. Pure so it's unit-testable without
// React or the store.

export interface BlockCoachMarkGateInput {
  /** ISO timestamp once the teaching moment was seen; null = never. */
  tourCompletedAt: string | null;
  /** Whether there is a real block to anchor the coach-mark to. */
  hasBlock: boolean;
}

/**
 * Show the coach-mark exactly once, on first arrival, only when a real block
 * exists to name. Unlike the retired tour it is NOT deferred a session — the
 * first space entry is precisely where the contextual hint belongs.
 */
export function shouldShowBlockCoachMark({
  tourCompletedAt,
  hasBlock,
}: BlockCoachMarkGateInput): boolean {
  if (tourCompletedAt != null) return false; // already taught (incl. existing users)
  return hasBlock;
}
