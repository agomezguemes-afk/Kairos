export {
  runFitnessFatigue,
  fitTaus,
  strengthObservations,
  dailyImpulses,
  normCdf,
  dayIndex,
  DEFAULT_TAUS,
  OBS_VAR,
} from './fitnessFatigue';
export type { FFParams, FFResult, DayState, Observation } from './fitnessFatigue';
export { readinessV2, loadPattern } from './readiness';
export type {
  ReadinessV2,
  ReadinessBandV2,
  Evidence,
  LoadPattern,
  ReadinessOptions,
} from './readiness';
export {
  sleepDebt,
  sleepNights,
  debtEffect,
  scaleFromHours,
  SLEEP_SHAPE,
  SORENESS_SHAPE,
} from './sleep';
export type { SleepDebt, SleepNight } from './sleep';
export { learnSensitivity, checkInEffect, SENSITIVITY_PRIOR } from './personal';
export type { Sensitivity } from './personal';
export {
  recoveryStatus,
  recoveryRate,
  recoveredAt,
  regionHits,
  sessionRegions,
  sorenessLikelihood,
  MOVEMENT_REGIONS,
  REGION_LABEL,
} from './recovery';
export type { Region, RegionStatus, RatePosterior } from './recovery';
export { progressionState, increments, isPlateau, PLATEAU_RATE, HAZARD } from './changepoint';
export type { ProgressionState, NIG } from './changepoint';
export {
  chooseLoad,
  capacityOf,
  thompsonChoice,
  armPosterior,
  sampleBeta,
  seededRng,
  LOSS_RATIO,
  lossRatioFor,
} from './decision';
export type { LoadChoice, Arm, ArmContext, ArmOutcome } from './decision';
export { brainSnapshot } from './brain';
export { dSeparated, safeCovariates, backdoorSet, descendants, PHYSIO_DAG, OBSERVED } from './dag';
export type { CausalVar, Dag } from './dag';
export {
  fitWeibull,
  survivalAt,
  riskWithin,
  hazardRatio,
  adherence,
  painRecurrence,
  painEpisodes,
  painActiveAt,
  PAIN_NOW_MS,
  LAPSE_DAYS,
} from './survival';
export type { Adherence, PainRecurrence, SurvivalObs, WeibullPosterior } from './survival';
export {
  abSchedule,
  analyseTrial,
  createTrial,
  nextCondition,
  trialPoints,
  trialExposures,
  winnerPatch,
  TRIAL_TEMPLATES,
  TRIAL_SWC,
} from './trial';
export type { Trial, TrialAnalysis, TrialPoint, TrialVerdict, Condition } from './trial';
export {
  consolidate,
  nextDraftSession,
  trimTargets,
  shapeSession,
  sessionAdjustment,
  dayPlanAt,
  planCoversNow,
  forecastDate,
} from './consolidate';
export type { Consolidation, DayPlan, PanelContext, Signals } from './consolidate';
export {
  buildBioDays,
  mergeBioDays,
  sleepByNight,
  measuredNights,
  hrvSignal,
  rhrSignal,
  autonomicEvidence,
  nightOf,
} from './biometrics';
export type { BioDay, Biometrics, BioSignal, SleepSample, ValueSample } from './biometrics';
export type { BrainNode, BrainSnapshot, BrainGroup, BrainOrigin } from './brain';
export {
  calibrationReport,
  fitRecalibration,
  intervalReport,
  recalibrate,
  reliability,
  CALIBRATION_MIN,
  IDENTITY,
} from './calibration';
export type {
  CalibrationReport,
  CalibrationVerdict,
  Forecast,
  IntervalForecast,
  IntervalReport,
  Recalibration,
  ReliabilityBin,
} from './calibration';
export { calibrate, replayAdherence, replayLoads, replayPain, replayReadiness } from './backtest';
export type { CalibrationSet, ForecastFamily } from './backtest';
export { expertPanel, trackRecord, weeklySets, lowIntensityShare, LENS_TITLE } from './lenses';
export type {
  Finding,
  Lens,
  LensId,
  Panel,
  PanelInput,
  PanelVerdict,
  Stance,
  TrackRecord,
} from './lenses';
export { buildEpisodes, completionOf, decisionContext, recall, similarity } from './memory';
export type { Advice, DecisionContext, Episode, Recall } from './memory';
export { replayCases, timelines, readinessForecasts, REPLAY_MAX } from './backtest';
export type {
  CaseRecord,
  CachedForecast,
  CalibrationRun,
  ReplayContext,
  Timelines,
} from './backtest';
export { Memo, Timeline, hash, fingerprint, decay, HALF_LIFE_DAYS, CACHE_VERSION } from './cache';
export type { EngineCache } from './cache';
export {
  emptyArchive,
  foldEpisodes,
  foldForecasts,
  archivedForecasts,
  prototypeEpisodes,
} from './archive';
export type { Archive, FamilyArchive, Prototype } from './archive';
export { PASS_BUDGET } from './consolidate';
export {
  applyDose,
  eventDate,
  layoutWeeks,
  readFatigue,
  reviewBlock,
  weekAt,
  weekIndex,
  weekNote,
  LOADING_WEEKS,
  MAX_LOADING_WEEKS,
} from './block';
export type {
  Block,
  BlockChange,
  BlockWeek,
  Emphasis,
  FatigueRead,
  WeekDose,
  WeekPhase,
} from './block';
