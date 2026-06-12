// KAIROS — chunking helpers for SecureStore-backed storage (pure).
//
// expo-secure-store maps to the iOS Keychain / Android Keystore, which warn or
// fail on values much above ~2KB. A persisted Supabase session (access +
// refresh token + user) is a few KB, so we split it into bounded chunks stored
// under derived keys, with a tiny meta record holding the chunk count.
//
// These functions are pure (no native imports) so the chunk/reassemble math is
// unit-tested directly; the native adapter that calls SecureStore lives in
// secureSessionStorage.ts.

/** Max chars per chunk. JWT/session payloads are ASCII, so chars ≈ bytes; 1536
 *  keeps each Keychain item comfortably under the ~2KB soft limit. */
export const SECURE_CHUNK_SIZE = 1536;

// SecureStore keys must match [A-Za-z0-9._-]+ — anything else throws.
const INVALID_KEY_CHARS = /[^A-Za-z0-9._-]/g;

/** Make an arbitrary storage key safe for SecureStore. */
export function sanitizeKey(key: string): string {
  const cleaned = key.replace(INVALID_KEY_CHARS, '_');
  return cleaned.length > 0 ? cleaned : '_';
}

/** Key holding the chunk count for `base`. */
export function metaKey(base: string): string {
  return `${sanitizeKey(base)}__meta`;
}

/** Key holding chunk `i` of `base`. */
export function chunkKey(base: string, i: number): string {
  return `${sanitizeKey(base)}__${i}`;
}

/**
 * Split a string into chunks of at most `size` chars. An empty string yields a
 * single empty chunk so round-tripping '' is preserved.
 */
export function chunk(value: string, size: number = SECURE_CHUNK_SIZE): string[] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('chunk size must be a positive integer');
  }
  if (value.length === 0) return [''];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    out.push(value.slice(i, i + size));
  }
  return out;
}

/**
 * Reassemble chunks read back from storage. Returns null if any part is missing
 * (null/undefined) — a partial write or corrupt manifest must read as "no
 * value", never a silently truncated session.
 */
export function reassemble(parts: readonly (string | null | undefined)[]): string | null {
  for (const p of parts) {
    if (p === null || p === undefined) return null;
  }
  return parts.join('');
}

/** Parse a meta record into a valid non-negative chunk count, or null. */
export function parseChunkCount(meta: string | null | undefined): number | null {
  if (typeof meta !== 'string') return null;
  const n = Number(meta);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
