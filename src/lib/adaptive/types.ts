// Adaptive training engine — domain types.
// Everything here is plain data so the engine stays pure, testable and
// serialisable (persisted in the coach store, sent to an LLM for narration).

export type Sport =
  | 'padel'
  | 'tennis'
  | 'climbing'
  | 'hiking'
  | 'running'
  | 'cycling'
  | 'football'
  | 'basketball'
  | 'swimming'
  | 'strength'
  | 'general';

export type Quality = 'endurance' | 'strength' | 'power' | 'speed' | 'mobility' | 'technique';

export type MovementKind = 'strength' | 'steady' | 'interval' | 'mobility' | 'skill';

export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export interface ParsedGoal {
  raw: string;
  sports: Sport[];
  qualities: Quality[];
  daysPerWeek: number;
  horizonWeeks: number;
  /** 0–1. Below ~0.4 the UI should ask the user to confirm what it understood. */
  confidence: number;
  /** Words that drove the interpretation — shown so the user sees why. */
  matched: string[];
  /** 'ai' only when an LLM refined the deterministic parse and passed validation. */
  source?: 'rules' | 'ai';
  /** One-line restatement of the goal in the user's language (AI only). */
  summary?: string;
  /** A single follow-up question when something decisive is missing (AI only). */
  question?: string;
}

/** Targets are ranges, not orders: the user can always override in session. */
export interface MovementTarget {
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  /** Null = unknown yet; first session calibrates it from what the user lifts. */
  loadKg?: number | null;
  /** Reps in reserve the set should end at. */
  rir?: number;
  durationMin?: number;
  distanceKm?: number;
  zone?: HeartRateZone;
  intervals?: { reps: number; workSec: number; restSec: number };
  /** Bike cadence target, for RPM sensors. */
  cadenceRpm?: number;
}

export interface Movement {
  id: string;
  name: string;
  kind: MovementKind;
  sports: Sport[];
  qualities: Quality[];
  /** Load increment for this movement when progressing (kg). */
  incrementKg?: number;
  defaults: MovementTarget;
  cue: string;
}

export interface PlannedMovement {
  movementId: string;
  target: MovementTarget;
}

export type DraftStatus = 'pending' | 'accepted' | 'rejected';

export interface DraftSession {
  id: string;
  title: string;
  focus: Quality;
  sport: Sport;
  /** Suggested slot in the week (0 = first training day). */
  slot: number;
  durationMin: number;
  movements: PlannedMovement[];
  rationale: string;
  status: DraftStatus;
}

export interface PlanDraft {
  id: string;
  goal: ParsedGoal;
  createdAt: string;
  sessions: DraftSession[];
}

export interface SetLog {
  reps?: number;
  loadKg?: number;
  rir?: number;
  durationSec?: number;
  distanceKm?: number;
  completed: boolean;
}

export interface MovementLog {
  movementId: string;
  target: MovementTarget;
  sets: SetLog[];
}

export interface SensorSummary {
  hrAvg?: number;
  hrMax?: number;
  /** Seconds spent in each HR zone, index 0 = Z1. */
  zoneSeconds?: [number, number, number, number, number];
  cadenceAvg?: number;
  powerAvg?: number;
  sources: string[];
}

export interface SessionLog {
  id: string;
  draftSessionId?: string;
  title: string;
  sport: Sport;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  /** Whole-session effort, 0–10 (Foster session-RPE). */
  rpe: number;
  movements: MovementLog[];
  sensors?: SensorSummary;
}

export type SuggestionKind =
  | 'increase_load'
  | 'add_reps'
  | 'add_set'
  | 'extend_duration'
  | 'extend_distance'
  | 'add_interval'
  | 'new_movement'
  | 'deload'
  | 'hold';

export type Confidence = 'early' | 'emerging' | 'solid';

/** Rarity reflects how significant the change is, so the reveal feels earned. */
export type Rarity = 'common' | 'rare' | 'epic';

export type SuggestionStatus = 'locked' | 'revealed' | 'accepted' | 'adjusted' | 'dismissed';

export interface ValueSnapshot {
  label: string;
  value: number;
  unit: string;
}

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  movementId: string;
  sessionId: string;
  /** Plan session the change applies to; absent for free sessions. */
  draftSessionId?: string;
  /** For new_movement: what replaces movementId in the plan. */
  replacementMovementId?: string;
  /** The exact target patch applied to the plan on accept. */
  patch?: Partial<MovementTarget>;
  title: string;
  from?: ValueSnapshot;
  to?: ValueSnapshot;
  rationale: string;
  evidence: string[];
  confidence: Confidence;
  rarity: Rarity;
  createdAt: string;
  status: SuggestionStatus;
}
