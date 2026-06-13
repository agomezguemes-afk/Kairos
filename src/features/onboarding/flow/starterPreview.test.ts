import { describe, expect, it } from 'vitest';
import { ONBOARDING_GOALS } from './onboardingFlow';
import { previewStarterBlock } from './starterPreview';

describe('previewStarterBlock', () => {
  it('returns a populated block for every goal', () => {
    for (const goal of ONBOARDING_GOALS) {
      const block = previewStarterBlock(goal);
      expect(block.name.length).toBeGreaterThan(0);
      expect(block.exercises.length).toBeGreaterThanOrEqual(3);
      for (const ex of block.exercises) {
        expect(ex.name.length).toBeGreaterThan(0);
        expect(ex.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the broad "health" block for a null goal', () => {
    expect(previewStarterBlock(null)).toEqual(previewStarterBlock('health'));
  });

  it('maps each goal to a discipline accent key', () => {
    expect(previewStarterBlock('strength').discipline).toBe('strength');
    expect(previewStarterBlock('flexibility').discipline).toBe('mobility');
  });
});
