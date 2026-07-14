// Pure keypad transforms for SetInput. Extracted so the edit rules (append,
// single decimal point, backspace, quick-deltas) are unit-tested independent
// of React Native. The component owns only the wiring + haptics.

import type { FieldValue } from '../../../types/core';

/**
 * Apply one keypad key to the current draft string and return the next draft.
 * - 'back' removes the last character.
 * - '.' is a no-op when the draft already holds a decimal point.
 * - any other key appends verbatim.
 */
export function applyNumpadKey(draft: string, key: string): string {
  if (key === 'back') return draft.slice(0, -1);
  if (key === '.') return draft.includes('.') ? draft : draft + '.';
  return draft + key;
}

/**
 * Coerce a keypad draft string into a stored FieldValue.
 * Empty → null (clears the field); a parseable number → number; otherwise the
 * raw string (e.g. a lone "." mid-entry) so typing never loses characters.
 */
export function toFieldValue(next: string): FieldValue {
  if (next === '') return null;
  const num = parseFloat(next);
  return isNaN(num) ? next : num;
}

/** Add a quick-delta (+2.5 / +5) to a numeric field's current value. */
export function applyDelta(current: FieldValue | undefined, delta: number): number {
  const base = typeof current === 'number' ? current : 0;
  return base + delta;
}
