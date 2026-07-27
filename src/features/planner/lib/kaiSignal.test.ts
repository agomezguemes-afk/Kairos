import { describe, it, expect } from 'vitest';
import { kaiSignal, type KaiInputs } from './kaiSignal';

const BASE: KaiInputs = {
  selectedDate: '2026-07-24',
  isToday: true,
  isPast: false,
  resolved: null,
  streak: 0,
  blocksCount: 1,
  hasActiveWorkout: false,
  lastSession: null,
};

describe('kaiSignal — recovery-adjust rule', () => {
  it('fires when adaptation is confident and strongly negative', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: -0.7, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('recovery-adjust');
    expect(signal?.tone).toBe('focus');
  });

  it('fires with a progress tone when adaptation is strongly positive', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: 0.8, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('recovery-adjust');
    expect(signal?.tone).toBe('progress');
  });

  it('does not fire below the 0.5 magnitude threshold', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: 0.3, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).not.toBe('recovery-adjust');
  });

  it('does not fire when confidence is low, even if the value is strong', () => {
    const signal = kaiSignal({
      ...BASE,
      adaptation: { value: -0.9, confidence: 'low', dominant: 'recovery' },
    });
    expect(signal?.id).not.toBe('recovery-adjust');
  });

  it('does not shadow the higher-priority "resume" rule', () => {
    const signal = kaiSignal({
      ...BASE,
      hasActiveWorkout: true,
      adaptation: { value: -0.9, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('resume');
  });

  it('does not shadow the higher-priority "done" rule', () => {
    const signal = kaiSignal({
      ...BASE,
      resolved: { status: 'completed' } as KaiInputs['resolved'],
      adaptation: { value: -0.9, confidence: 'high', dominant: 'recovery' },
    });
    expect(signal?.id).toBe('done');
  });

  it('omitting adaptation entirely falls through to the existing rules unchanged', () => {
    const signal = kaiSignal(BASE);
    expect(signal?.id).toBe('no-plan');
  });
});
