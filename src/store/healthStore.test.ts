import { describe, it, expect, beforeEach } from 'vitest';

// AsyncStorage's web fallback assumes `window` (same stub as
// onboardingCompletion.test.ts) — zustand persist flushes writes
// asynchronously after mutations. Must be set BEFORE the store module is
// evaluated: persist() kicks off its initial hydration read synchronously
// at import time, and a static `import` is hoisted ahead of this stub, so
// the dynamic import below is required to sequence it correctly.
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

const { useHealthStore } = await import('./healthStore');

function sample(date: string, hrvMs: number | null = 50, sleepHours: number | null = 7) {
  return { date, hrvMs, sleepHours };
}

beforeEach(() => {
  useHealthStore.setState({ samples: [], _hasHydrated: false });
});

describe('healthStore — recordSample', () => {
  it('appends a new sample', () => {
    useHealthStore.getState().recordSample(sample('2026-07-01'));
    expect(useHealthStore.getState().samples).toHaveLength(1);
  });

  it('upserts by date — recording the same day twice replaces, not duplicates', () => {
    useHealthStore.getState().recordSample(sample('2026-07-01', 50, 7));
    useHealthStore.getState().recordSample(sample('2026-07-01', 60, 8));
    const { samples } = useHealthStore.getState();
    expect(samples).toHaveLength(1);
    expect(samples[0].hrvMs).toBe(60);
    expect(samples[0].sleepHours).toBe(8);
  });

  it('keeps samples sorted oldest-first', () => {
    useHealthStore.getState().recordSample(sample('2026-07-03'));
    useHealthStore.getState().recordSample(sample('2026-07-01'));
    useHealthStore.getState().recordSample(sample('2026-07-02'));
    const dates = useHealthStore.getState().samples.map((s) => s.date);
    expect(dates).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });

  it('caps at 30 samples, evicting the oldest', () => {
    for (let i = 1; i <= 35; i++) {
      const d = `2026-01-${String(i).padStart(2, '0')}`;
      useHealthStore
        .getState()
        .recordSample(sample(i <= 31 ? d : `2026-02-${String(i - 31).padStart(2, '0')}`));
    }
    const { samples } = useHealthStore.getState();
    expect(samples).toHaveLength(30);
    expect(samples[0].date).not.toBe('2026-01-01'); // oldest evicted
  });
});
