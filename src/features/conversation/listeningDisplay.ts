// KAIROS — Listening-state display logic (Design v2, pattern 3).
//
// Pure view-model for the full-screen listening canvas: given whatever the STT
// layer has transcribed so far, decide what the giant text should read. Kept
// framework-free so it's unit-testable and so M3 (real push-to-talk) only has
// to feed it a growing `transcript` string. "Confianza mediante vacío": before
// a word arrives we show a calm invitation, not a spinner.

export interface ListeningDisplay {
  /** The text to render in the giant Fraunces block. */
  text: string;
  /** True while nothing intelligible has arrived yet → render `text` muted. */
  isPlaceholder: boolean;
}

/** The calm invitation shown before the first transcribed word. */
export const LISTENING_PLACEHOLDER = 'Te escucho…';

export function listeningDisplay(transcript: string): ListeningDisplay {
  const trimmed = transcript.trim();
  if (trimmed.length === 0) {
    return { text: LISTENING_PLACEHOLDER, isPlaceholder: true };
  }
  return { text: trimmed, isPlaceholder: false };
}
