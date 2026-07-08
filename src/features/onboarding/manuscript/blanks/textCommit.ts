// KAIROS — Commit resolution for TextBlank (pure, node-testable).
//
// The «Alvaro»→«A» P0: with fast typing + return, the parent's render-time
// state lags behind the native field, so any commit that reads React state
// can truncate. The committed value must ALWAYS come from the freshest
// source: the submit/blur event's own `nativeEvent.text` when present,
// otherwise the per-keystroke ref mirror.

export function resolveSubmitText(nativeText: string | null | undefined, latest: string): string {
  // An empty native string is authoritative too (the user cleared the field);
  // only a missing payload falls back to the keystroke mirror.
  return typeof nativeText === 'string' ? nativeText : latest;
}
