// KAIROS — Wedge mode flag.
//
// WHY (premise P3, feat/night-run design doc): the beta product is the loop
// hablar → bloque → entrenar → memoria. Nothing else. Gamification (badges,
// PR cards, progress tree) and the AI Lab as a separate surface are hedging
// in front of 10 beta users, so they are HIDDEN — never deleted. Every hide
// branch in the app routes through this one constant; flip WEDGE_MODE to false
// and the full OS comes back instantly, no other edits required.
export const WEDGE_MODE = true;

/**
 * Surfaces demoted out of the beta wedge (premise P3). Named so every hide
 * branch reads self-documenting at the call site.
 *   - 'gamification' → badges / PR cards / progress tree
 *   - 'aiLab'        → the AI Lab as a standalone destination
 */
export const DEMOTED_SURFACES = ['gamification', 'aiLab'] as const;
export type DemotedSurface = (typeof DEMOTED_SURFACES)[number];

/**
 * Whether a demoted surface should be reachable from the UI. In wedge mode
 * every demoted surface is hidden; with WEDGE_MODE off they all return.
 * The screens themselves stay registered in navigation regardless — this
 * only gates the entry points, so deep links and dev navigation never crash.
 */
export function isSurfaceVisible(surface: DemotedSurface): boolean {
  // `surface` is accepted (and validated by the type) so call sites read
  // intent-first; today all demoted surfaces share the same gate.
  void surface;
  return !WEDGE_MODE;
}
