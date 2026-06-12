import { describe, expect, it } from 'vitest';
import {
  chunk,
  chunkKey,
  metaKey,
  parseChunkCount,
  reassemble,
  sanitizeKey,
  SECURE_CHUNK_SIZE,
} from './secureChunk';

describe('sanitizeKey', () => {
  it('passes valid keys and replaces invalid chars', () => {
    expect(sanitizeKey('sb-abc123-auth-token')).toBe('sb-abc123-auth-token');
    expect(sanitizeKey('a b/c:d')).toBe('a_b_c_d');
    expect(sanitizeKey('')).toBe('_');
  });
});

describe('derived keys', () => {
  it('are stable and namespaced', () => {
    expect(metaKey('k')).toBe('k__meta');
    expect(chunkKey('k', 0)).toBe('k__0');
    expect(chunkKey('k', 3)).toBe('k__3');
  });
});

describe('chunk / reassemble round-trip', () => {
  it('round-trips a multi-chunk value exactly', () => {
    const value = 'x'.repeat(SECURE_CHUNK_SIZE * 2 + 17);
    const parts = chunk(value);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(SECURE_CHUNK_SIZE);
    expect(parts[2]).toHaveLength(17);
    expect(reassemble(parts)).toBe(value);
  });

  it('preserves the empty string as a single empty chunk', () => {
    expect(chunk('')).toEqual(['']);
    expect(reassemble([''])).toBe('');
  });

  it('respects a custom size', () => {
    expect(chunk('abcdef', 2)).toEqual(['ab', 'cd', 'ef']);
  });

  it('rejects a non-positive size', () => {
    expect(() => chunk('x', 0)).toThrow();
    expect(() => chunk('x', -4)).toThrow();
  });
});

describe('reassemble integrity', () => {
  it('returns null if any part is missing (partial/corrupt read)', () => {
    expect(reassemble(['a', null, 'c'])).toBeNull();
    expect(reassemble(['a', undefined])).toBeNull();
  });
});

describe('parseChunkCount', () => {
  it('accepts non-negative integers, rejects the rest', () => {
    expect(parseChunkCount('0')).toBe(0);
    expect(parseChunkCount('5')).toBe(5);
    expect(parseChunkCount(null)).toBeNull();
    expect(parseChunkCount('-1')).toBeNull();
    expect(parseChunkCount('2.5')).toBeNull();
    expect(parseChunkCount('abc')).toBeNull();
  });
});
