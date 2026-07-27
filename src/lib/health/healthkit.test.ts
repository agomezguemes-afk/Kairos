import { describe, it, expect } from 'vitest';
import { readHRV, readSleepHours, isHealthKitAvailable } from './healthkit';

describe('HealthKit — biometric reads (native module absent in test env)', () => {
  it('isHealthKitAvailable is false without the native module', () => {
    expect(isHealthKitAvailable()).toBe(false);
  });

  it('readHRV resolves null, never throws, when native is unavailable', async () => {
    await expect(readHRV()).resolves.toBeNull();
  });

  it('readSleepHours resolves null, never throws, when native is unavailable', async () => {
    await expect(readSleepHours()).resolves.toBeNull();
  });
});
