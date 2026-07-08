import { afterEach, describe, expect, it } from 'vitest';
import { isDevFallbackAllowed, readDevGroqKey } from './devFallback';

// These tests pin the security boundary: the direct-Groq key is only ever
// readable in a development build. In vitest (node) `__DEV__` is undefined
// by default, which must behave like a release build (no key).

const KEY = 'EXPO_PUBLIC_GROQ_API_KEY';

function setDev(value: boolean | undefined): void {
  if (value === undefined) {
    delete (globalThis as Record<string, unknown>).__DEV__;
  } else {
    (globalThis as Record<string, unknown>).__DEV__ = value;
  }
}

afterEach(() => {
  setDev(undefined);
  delete process.env[KEY];
});

describe('devFallback security gate', () => {
  it('treats an undefined __DEV__ (release-like) as not allowed', () => {
    setDev(undefined);
    expect(isDevFallbackAllowed()).toBe(false);
  });

  it('never returns the key when __DEV__ is false, even if the env var is set', () => {
    setDev(false);
    process.env[KEY] = 'gsk_secret_should_never_leak';
    expect(isDevFallbackAllowed()).toBe(false);
    expect(readDevGroqKey()).toBeNull();
  });

  it('never returns the key when __DEV__ is undefined, even if the env var is set', () => {
    setDev(undefined);
    process.env[KEY] = 'gsk_secret_should_never_leak';
    expect(readDevGroqKey()).toBeNull();
  });

  it('returns the trimmed key only in a dev build', () => {
    setDev(true);
    process.env[KEY] = '  gsk_dev_key  ';
    expect(isDevFallbackAllowed()).toBe(true);
    expect(readDevGroqKey()).toBe('gsk_dev_key');
  });

  it('returns null in a dev build when the env var is missing or blank', () => {
    setDev(true);
    expect(readDevGroqKey()).toBeNull();
    process.env[KEY] = '   ';
    expect(readDevGroqKey()).toBeNull();
  });
});
