// KAIROS — PlannerTour gate (pure + a tiny session flag).
//
// The 3-screen planner tour teaches, but the very first Dashboard entry right
// after onboarding is a momentum moment, not a teaching moment — firing the
// tour there breaks the reveal→enter flow. So we defer it exactly one session:
// the tour never shows in the same app session the user finished onboarding,
// and reappears on the next cold start (in-memory flag, never persisted).
//
// Existing users are unaffected: `tourCompletedAt` still short-circuits, and a
// user whose onboarding happened in a prior session has the flag unset.

// In-memory only. A cold start (fresh JS runtime) resets it to false.
let onboardedThisSession = false;

/** Called once onboarding completes, so this session defers the tour. */
export function markOnboardedThisSession(): void {
  onboardedThisSession = true;
}

/** Was onboarding completed during THIS app session? */
export function isOnboardedThisSession(): boolean {
  return onboardedThisSession;
}

/** Test seam — reset the module flag between cases. */
export function resetOnboardedSessionFlag(): void {
  onboardedThisSession = false;
}

export interface PlannerTourGateInput {
  /** ISO timestamp once the tour was seen; null = never seen. */
  tourCompletedAt: string | null;
  /** Whether onboarding finished in the current app session. */
  onboardedThisSession: boolean;
}

/**
 * The tour shows at most once, and never in the session onboarding just
 * finished. Pure so it is unit-testable without React or the store.
 */
export function shouldShowPlannerTour({
  tourCompletedAt,
  onboardedThisSession: onboarded,
}: PlannerTourGateInput): boolean {
  if (tourCompletedAt != null) return false; // already seen (incl. existing users)
  if (onboarded) return false; // just onboarded — defer to the next launch
  return true;
}
