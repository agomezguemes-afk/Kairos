/**
 * Persisted coach state from any earlier version. Every shape change so far
 * is additive, so the stored fields carry over and missing ones fall back to
 * their defaults in the persist merge. A breaking change adds its step here,
 * keyed on `fromVersion`; it must never return less than it was given.
 *
 * Without this, zustand hydrates `undefined` on any version bump and the
 * next write saves an empty state over the person's whole history.
 */
export function migrateCoachState<T extends object>(persisted: unknown, _fromVersion: number): T {
  if (!persisted || typeof persisted !== 'object') return {} as T;
  return persisted as T;
}
