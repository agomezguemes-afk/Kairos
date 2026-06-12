import { describe, expect, it } from 'vitest';
import {
  assertWithinImportLimits,
  countLines,
  InputTooLargeError,
  type InputLimits,
} from './inputLimits';

const SMALL: InputLimits = { maxChars: 100, maxLines: 5 };

describe('countLines', () => {
  it('counts newline-delimited lines, no trailing newline needed', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\nb\n')).toBe(3);
  });
});

describe('assertWithinImportLimits', () => {
  it('passes input within both bounds', () => {
    expect(() => assertWithinImportLimits('a\nb\nc', SMALL)).not.toThrow();
  });

  it('throws on too many characters', () => {
    try {
      assertWithinImportLimits('x'.repeat(101), SMALL);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(InputTooLargeError);
      expect((e as InputTooLargeError).kind).toBe('chars');
    }
  });

  it('throws on too many lines', () => {
    try {
      assertWithinImportLimits('a\nb\nc\nd\ne\nf', SMALL);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(InputTooLargeError);
      expect((e as InputTooLargeError).kind).toBe('lines');
    }
  });

  it('checks chars before lines (cheap guard first)', () => {
    // Over both limits → reports chars (the first/cheapest check).
    const huge = 'a\n'.repeat(60); // 120 chars, 61 lines — both exceed SMALL
    try {
      assertWithinImportLimits(huge, SMALL);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as InputTooLargeError).kind).toBe('chars');
    }
  });
});
