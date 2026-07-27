import { describe, it, expect, beforeEach } from 'vitest';

// AsyncStorage's web fallback assumes `window` (same stub as
// healthStore.test.ts) — zustand persist flushes writes asynchronously
// after mutations. Must be set BEFORE the store module is evaluated:
// persist() kicks off its initial hydration read synchronously at import
// time, and a static `import` is hoisted ahead of this stub, so the
// dynamic import below is required to sequence it correctly. Without this,
// `npx vitest run src/lib/health/dailySync.test.ts` run in isolation exits
// 1 on an unhandled "window is not defined" rejection even though both
// assertions pass.
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

const { syncDailyBiometricSample } = await import('./dailySync');
const { useHealthStore } = await import('../../store/healthStore');

beforeEach(() => {
  useHealthStore.setState({ samples: [], _hasHydrated: false });
});

describe('syncDailyBiometricSample', () => {
  it('does nothing when HealthKit is unavailable (native module absent in test env)', async () => {
    await syncDailyBiometricSample();
    expect(useHealthStore.getState().samples).toHaveLength(0);
  });

  it('never throws', async () => {
    await expect(syncDailyBiometricSample()).resolves.toBeUndefined();
  });
});
