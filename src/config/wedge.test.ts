import { describe, expect, it } from 'vitest';
import { DEMOTED_SURFACES, WEDGE_MODE, isSurfaceVisible, type DemotedSurface } from './wedge';

describe('wedge flag', () => {
  it('ships the beta wedge on (premise P3)', () => {
    // The beta launch runs with the demoted surfaces hidden. This test is the
    // canary: if someone flips WEDGE_MODE it fails loudly rather than silently
    // shipping the full OS to 10 beta users.
    expect(WEDGE_MODE).toBe(true);
  });

  it('names exactly the surfaces P3 demotes', () => {
    expect(DEMOTED_SURFACES).toEqual(['gamification', 'aiLab']);
  });

  it('hides every demoted surface while wedge mode is on', () => {
    for (const surface of DEMOTED_SURFACES) {
      expect(isSurfaceVisible(surface)).toBe(false);
    }
  });

  it('mirrors WEDGE_MODE — visibility is the inverse of the flag', () => {
    // Guards the invariant flipping WEDGE_MODE relies on: every demoted surface
    // reappears together, so restoring the full OS is a one-line change.
    for (const surface of DEMOTED_SURFACES) {
      expect(isSurfaceVisible(surface)).toBe(!WEDGE_MODE);
    }
  });

  it('treats gamification and aiLab identically under the shared gate', () => {
    const surfaces: DemotedSurface[] = ['gamification', 'aiLab'];
    const [gamification, aiLab] = surfaces.map(isSurfaceVisible);
    expect(gamification).toBe(aiLab);
  });
});
