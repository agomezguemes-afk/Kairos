// KAIROS — bounds for untrusted bulk text input (pure).
//
// Importing a file (Strong/Hevy CSV) parses user-supplied text synchronously on
// the JS thread. With no upper bound, a crafted or accidentally huge file
// exhausts memory and freezes or crashes the app — a denial-of-service at an
// untrusted-input boundary. Call assertWithinImportLimits() BEFORE parsing to
// fail fast with a clear, typed error the UI can show ("file too large").
//
// General-purpose (not import-specific) so any future untrusted-text boundary
// can reuse it. Pure — unit-tested directly.

export class InputTooLargeError extends Error {
  constructor(
    readonly kind: 'chars' | 'lines',
    readonly limit: number,
    readonly actual: number,
  ) {
    super(`Imported input exceeds the ${kind} limit (${actual} > ${limit})`);
    this.name = 'InputTooLargeError';
  }
}

export const IMPORT_LIMITS = {
  // ~5M chars (≈5 MB ASCII). A very large multi-year workout export is far
  // below this; legitimate imports never hit it.
  maxChars: 5_000_000,
  // Row-count guard independent of line width.
  maxLines: 100_000,
} as const;

export interface InputLimits {
  maxChars: number;
  maxLines: number;
}

/**
 * Throw InputTooLargeError if `text` exceeds the size/line bounds. The cheap
 * char check runs first and bounds the cost of the line scan that follows.
 */
export function assertWithinImportLimits(text: string, limits: InputLimits = IMPORT_LIMITS): void {
  if (text.length > limits.maxChars) {
    throw new InputTooLargeError('chars', limits.maxChars, text.length);
  }
  const lines = countLines(text);
  if (lines > limits.maxLines) {
    throw new InputTooLargeError('lines', limits.maxLines, lines);
  }
}

/** Count newline-delimited lines without allocating a split array. */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) n++;
  }
  return n;
}
