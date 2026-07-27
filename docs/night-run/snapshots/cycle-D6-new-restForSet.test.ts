import { describe, expect, it } from 'vitest';
import { DEFAULT_REST_SECONDS, WARMUP_REST_SECONDS, restForSet } from './restForSet';

describe('restForSet', () => {
  it('working keeps the exercise work rest', () => {
    expect(restForSet('working', 120)).toBe(120);
  });

  it('warmup caps at the short ramp rest', () => {
    expect(restForSet('warmup', 120)).toBe(WARMUP_REST_SECONDS);
  });

  it('warmup never exceeds a work rest already shorter than the cap', () => {
    expect(restForSet('warmup', 30)).toBe(30);
  });

  it('working with no configured rest falls back to the default', () => {
    expect(restForSet('working', undefined)).toBe(DEFAULT_REST_SECONDS);
  });

  it('working with 0 (falsy) falls back to the default, mirroring `|| 90`', () => {
    expect(restForSet('working', 0)).toBe(DEFAULT_REST_SECONDS);
  });

  it('drop and failure behave like working (full work rest)', () => {
    expect(restForSet('drop', 120)).toBe(120);
    expect(restForSet('failure', 120)).toBe(120);
  });

  it('warmup with no configured rest uses the ramp cap (min(90, 45))', () => {
    expect(restForSet('warmup', undefined)).toBe(WARMUP_REST_SECONDS);
  });
});
