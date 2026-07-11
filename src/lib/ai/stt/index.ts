// KAIROS — Speech-to-text: public surface (M2, voz de entrada).
//
// One utterance in, typed result out. Consumers branch on `result.ok`
// and fall back to tactile input on any error — never on a caught throw.

export {
  transcribeAudio,
  isSttAvailable,
  GROQ_STT_ENDPOINT,
  DEFAULT_STT_MODEL,
  DEFAULT_STT_LANGUAGE,
  DEFAULT_STT_TIMEOUT_MS,
} from './transcribe';
export {
  STT_QUOTA_COST,
  sttQuotaUnits,
  createSttUsageTracker,
  sharedSttUsageTracker,
} from './quota';
export type {
  TranscribeInput,
  TranscribeOptions,
  TranscribeResult,
  TranscribeSuccess,
  SttError,
  SttErrorKind,
  SttUsageTracker,
} from './types';
