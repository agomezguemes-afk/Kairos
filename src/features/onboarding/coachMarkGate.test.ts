import { describe, expect, it } from 'vitest';
import { shouldShowBlockCoachMark } from './coachMarkGate';

describe('shouldShowBlockCoachMark', () => {
  it('shows on first arrival when a real block exists', () => {
    expect(shouldShowBlockCoachMark({ tourCompletedAt: null, hasBlock: true })).toBe(true);
  });

  it('does not show without a block to anchor to', () => {
    expect(shouldShowBlockCoachMark({ tourCompletedAt: null, hasBlock: false })).toBe(false);
  });

  it('never shows once taught — existing users are unaffected', () => {
    expect(
      shouldShowBlockCoachMark({ tourCompletedAt: '2026-01-01T00:00:00.000Z', hasBlock: true }),
    ).toBe(false);
  });

  it('is not deferred a session (shows on the very first entry)', () => {
    // No session flag exists anymore — the only gate is tourCompletedAt.
    expect(shouldShowBlockCoachMark({ tourCompletedAt: null, hasBlock: true })).toBe(true);
  });
});
