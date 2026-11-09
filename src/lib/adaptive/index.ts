export * from './types';
export { MOVEMENTS, getMovement, findMovements } from './catalog';
export { parseGoal, normalize, SPORT_LABEL, QUALITY_LABEL } from './goalParser';
export { draftPlan, estimateMovementMinutes, distributeFocus } from './planDrafter';
export {
  sessionLoad,
  hrZone,
  edwardsTrimp,
  estimateHrMax,
  loadTrend,
  estimateOneRepMax,
  bestSetE1rm,
  theilSenSlope,
  roundTo,
} from './metrics';
export type { LoadBand, LoadTrend } from './metrics';
export {
  generateSuggestions,
  applySuggestion,
  calibratePlan,
  fatigueSignals,
  confidenceFor,
} from './suggestions';
export type { EngineInput, FatigueSignals } from './suggestions';
export {
  startExperiment,
  objectiveCheck,
  isDueForReview,
  resolveExperiment,
  revertPatch,
  responseProfile,
  affinityOf,
  isUnresponsive,
  REVIEW_DAYS,
  MIN_EXPOSURES,
} from './experiments';
export type {
  Experiment,
  ExperimentAnswers,
  ExperimentStatus,
  ObjectiveResult,
  ResponseProfile,
  KindStats,
  Verdict,
  Feel,
} from './experiments';
export { readiness, needsWeeklyCheckIn, weeklySuggestions } from './checkins';
export type { CheckIn, WeekFeel, Readiness, ReadinessBand, WeeklyInput } from './checkins';
