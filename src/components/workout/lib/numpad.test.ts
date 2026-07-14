import { describe, expect, it } from 'vitest';
import { applyNumpadKey, toFieldValue, applyDelta } from './numpad';

describe('applyNumpadKey', () => {
  it('appends a digit to an empty draft', () => {
    expect(applyNumpadKey('', '6')).toBe('6');
  });

  it('appends digits in sequence', () => {
    expect(applyNumpadKey('6', '0')).toBe('60');
  });

  it('adds a decimal point once', () => {
    expect(applyNumpadKey('60', '.')).toBe('60.');
  });

  it('ignores a second decimal point', () => {
    expect(applyNumpadKey('60.5', '.')).toBe('60.5');
  });

  it('appends digits after the decimal', () => {
    expect(applyNumpadKey('60.', '5')).toBe('60.5');
  });

  it('backspaces the last character', () => {
    expect(applyNumpadKey('60', 'back')).toBe('6');
  });

  it('backspacing an empty draft stays empty', () => {
    expect(applyNumpadKey('', 'back')).toBe('');
  });

  it('backspacing removes a trailing decimal point', () => {
    expect(applyNumpadKey('60.', 'back')).toBe('60');
  });
});

describe('toFieldValue', () => {
  it('maps an empty draft to null (clears the field)', () => {
    expect(toFieldValue('')).toBeNull();
  });

  it('maps a whole number', () => {
    expect(toFieldValue('60')).toBe(60);
  });

  it('maps a decimal number', () => {
    expect(toFieldValue('62.5')).toBe(62.5);
  });

  it('keeps a lone decimal point as a string mid-entry (no character loss)', () => {
    expect(toFieldValue('.')).toBe('.');
  });

  it('keeps a trailing decimal point as a string mid-entry', () => {
    // parseFloat('60.') === 60, so it coerces to a number — acceptable, the
    // draft string in the component still shows "60." until the next key.
    expect(toFieldValue('60.')).toBe(60);
  });
});

describe('applyDelta', () => {
  it('adds to an existing numeric value', () => {
    expect(applyDelta(60, 2.5)).toBe(62.5);
  });

  it('treats an undefined current value as zero', () => {
    expect(applyDelta(undefined, 5)).toBe(5);
  });

  it('treats a non-numeric current value as zero', () => {
    expect(applyDelta('abc', 5)).toBe(5);
  });

  it('treats null as zero', () => {
    expect(applyDelta(null, 2.5)).toBe(2.5);
  });
});
