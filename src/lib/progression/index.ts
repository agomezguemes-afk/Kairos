// KAIROS — Progression engine: public surface.
//
// "Memoria que compone" — the honest addiction mechanic. Pure functions the
// conversation build paths call to make the next session open visibly smarter,
// and that the M4-UI pass will read for PR moments + suggestion chips.
//
// Pinned v1 (do not exceed): strength = carry-forward last weight + RPE nudge
// (±2.5 kg); endurance = carry-forward last pace/distance/calories, no nudge;
// PR = beat the historical best per exercise+field. No ML, no recommendations.

export { classifyModality, prFieldDirection, normalizeExerciseName } from './modality';
export { readExerciseHistory } from './readExerciseHistory';
export {
  suggestNextValues,
  rpeNudgeKg,
  WEIGHT_NUDGE_KG,
  RPE_EASY_MAX,
  RPE_HARD_MIN,
} from './suggestNextValues';
export { inSessionWeightNudge } from './inSessionNudge';
export type { InSessionNudge } from './inSessionNudge';
export { detectPR } from './detectPR';
export { applyProgression } from './applyProgression';

export type {
  Modality,
  ExerciseRef,
  HistoricalSet,
  HistoricalSession,
  ExerciseHistory,
  SuggestionBasis,
  SuggestedValues,
  PRDirection,
  PRDetection,
} from './types';
