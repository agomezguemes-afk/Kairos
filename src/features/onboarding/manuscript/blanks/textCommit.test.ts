import { describe, expect, it } from 'vitest';
import { resolveSubmitText } from './textCommit';

describe('resolveSubmitText', () => {
  it('prefers the submit event text over a stale mirror (the «Alvaro»→«A» race)', () => {
    expect(resolveSubmitText('Alvaro', 'A')).toBe('Alvaro');
  });

  it('falls back to the keystroke mirror when the event carries no text', () => {
    expect(resolveSubmitText(undefined, 'Alvaro')).toBe('Alvaro');
    expect(resolveSubmitText(null, 'Alvaro')).toBe('Alvaro');
  });

  it('respects an authoritative empty native text (cleared field → skip path)', () => {
    expect(resolveSubmitText('', 'Alvaro')).toBe('');
  });

  it('keeps whitespace intact — trimming is the caller’s decision', () => {
    expect(resolveSubmitText('  Álvaro  ', '')).toBe('  Álvaro  ');
  });
});
