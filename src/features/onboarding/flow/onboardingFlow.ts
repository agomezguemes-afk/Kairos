// KAIROS — Onboarding flow logic (pure, framework-agnostic).
//
// The screens drive this instead of ad-hoc useState so the onboarding has a
// single, testable source of truth for the one thing that matters most:
// Time-To-First-Value. See docs/ONBOARDING_BEST_IN_CLASS.md for the rationale.
//
// Design rule: the GOAL is the only answer required to generate a personalized
// starter space. Name and equipment are deferrable and have smart defaults, so
// a user can reach a ready space in a single tap ("skip to value") and finish
// profiling later. No imports of the store / RN here — this module is pure so
// it can be unit-tested directly.

export type OnboardingGoal = 'strength' | 'endurance' | 'flexibility' | 'health';

/** Self-reported training experience — shapes starter intensity/volume. */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
];

export const DEFAULT_EXPERIENCE: ExperienceLevel = 'beginner';

/** Sessions per week the user wants to commit to. */
export const MIN_DAYS_PER_WEEK = 1;
export const MAX_DAYS_PER_WEEK = 7;
export const DEFAULT_DAYS_PER_WEEK = 3;

/**
 * Hard cap on the free-text prompt the user writes to Kai (the AI copilot).
 * This is an untrusted-input boundary that gets forwarded to an LLM, so the cap
 * is a real guard (token cost + prompt-abuse surface), not just a UI nicety.
 */
export const MAX_AI_PROMPT_LEN = 500;

// Mirrors the union accepted by src/lib/routines/generateStarterRoutine.ts.
// Kept local (not imported) so this module pulls in no native dependencies.
export const ONBOARDING_GOALS: readonly OnboardingGoal[] = [
  'strength',
  'endurance',
  'flexibility',
  'health',
];

/** Broadest starter routine — applied when the user skips goal selection. */
export const DEFAULT_GOAL: OnboardingGoal = 'health';

/** Default equipment when the user picks none. The app is never empty. */
export const DEFAULT_EQUIPMENT = 'bodyweight';

/** Hard cap on the display name, matching the onboarding TextInput maxLength. */
export const MAX_NAME_LEN = 32;

export interface OnboardingDraft {
  goal: OnboardingGoal | null;
  name: string | null;
  equipment: readonly string[];
  /** Deeper profile (collected after the goal) — all optional, all defaulted. */
  experience: ExperienceLevel | null;
  daysPerWeek: number | null;
  /** Free-text context the user hands to Kai to shape their starter space. */
  aiPrompt: string | null;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  goal: null,
  name: null,
  equipment: [],
  experience: null,
  daysPerWeek: null,
  aiPrompt: null,
};

export type OnboardingStepId = 'welcome' | 'goal' | 'name' | 'equipment';

export interface OnboardingStep {
  id: OnboardingStepId;
  /** Whether this step is required to reach first value (a ready space). */
  required: boolean;
}

// Goal-first ordering: the value-driver comes before personalization, and only
// `goal` gates first value. Welcome is a brand moment, not a question.
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { id: 'welcome', required: false },
  { id: 'goal', required: true },
  { id: 'name', required: false },
  { id: 'equipment', required: false },
];

export function isValidGoal(value: unknown): value is OnboardingGoal {
  return typeof value === 'string' && (ONBOARDING_GOALS as readonly string[]).includes(value);
}

export function isValidExperience(value: unknown): value is ExperienceLevel {
  return typeof value === 'string' && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

/** Round + clamp to [1, 7]; null for non-finite/non-number input. */
export function clampDaysPerWeek(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(MAX_DAYS_PER_WEEK, Math.max(MIN_DAYS_PER_WEEK, Math.round(value)));
}

/**
 * Trim, collapse whitespace, cap at MAX_AI_PROMPT_LEN. Returns null for empty /
 * non-string input. This is the sanitizer for the untrusted Kai prompt.
 */
export function normalizeAiPrompt(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, MAX_AI_PROMPT_LEN);
}

/**
 * Trim, collapse internal whitespace, and cap length. Returns null for empty /
 * non-string input so callers can treat "no name" uniformly.
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, MAX_NAME_LEN);
}

function dedupe(xs: readonly string[]): string[] {
  return Array.from(new Set(xs.filter((x) => typeof x === 'string' && x.length > 0)));
}

/**
 * True when a personalized starter space can be generated right now. The goal
 * is the only value-driver; with it (or its default) the user can be dropped
 * into a ready app.
 */
export function firstValueReady(draft: OnboardingDraft): boolean {
  return isValidGoal(draft.goal);
}

/**
 * Fill every deferrable field with its smart default. Goal falls back to the
 * broadest routine, equipment to bodyweight; name stays optional.
 */
export function applySmartDefaults(draft: OnboardingDraft): OnboardingDraft {
  const equipment = dedupe(draft.equipment);
  return {
    goal: isValidGoal(draft.goal) ? draft.goal : DEFAULT_GOAL,
    name: normalizeName(draft.name),
    equipment: equipment.length > 0 ? equipment : [DEFAULT_EQUIPMENT],
    experience: isValidExperience(draft.experience) ? draft.experience : DEFAULT_EXPERIENCE,
    daysPerWeek: clampDaysPerWeek(draft.daysPerWeek) ?? DEFAULT_DAYS_PER_WEEK,
    // The Kai prompt stays optional — null is a valid "no extra context".
    aiPrompt: normalizeAiPrompt(draft.aiPrompt),
  };
}

/**
 * The one-tap path. Returns a draft that is guaranteed first-value-ready, so
 * the welcome screen's primary CTA can drop the user straight into the app.
 */
export function skipToValue(draft: OnboardingDraft = EMPTY_DRAFT): OnboardingDraft {
  const result = applySmartDefaults(draft);
  // Invariant: skip-to-value must always produce a generatable space.
  return result;
}

/**
 * Progress toward first value: 0 until the required step (goal) is satisfied,
 * then 1. Only required steps count, so optional steps never make the "can I
 * get in?" bar feel longer than it is.
 */
export function requiredProgress(draft: OnboardingDraft): number {
  return firstValueReady(draft) ? 1 : 0;
}

/**
 * Richness progress across all answerable steps [0, 1] — for a secondary
 * "how personalized is my setup" indicator, never a gate.
 */
export function fullProgress(draft: OnboardingDraft): number {
  const checks = [
    isValidGoal(draft.goal),
    normalizeName(draft.name) !== null,
    dedupe(draft.equipment).length > 0,
    isValidExperience(draft.experience),
    clampDaysPerWeek(draft.daysPerWeek) !== null,
    normalizeAiPrompt(draft.aiPrompt) !== null,
  ];
  const done = checks.filter(Boolean).length;
  return done / checks.length;
}

// ── Time-To-First-Value instrumentation ────────────────────────────────────

/** The promise: a usable, personalized space in under two minutes. */
export const MAX_TTFV_MS = 120_000;
/** The design target via skip-to-value. */
export const TARGET_TTFV_MS = 30_000;

export interface TtfvSample {
  elapsedMs: number;
  /** Hit the ~30s skip-to-value target. */
  withinTarget: boolean;
  /** Hit the 2-minute promise. */
  withinMax: boolean;
}

export interface TtfvTracker {
  /** Record the moment first value is reached (starter space generated). */
  reached(now?: number): TtfvSample;
}

/**
 * Pure, injectable-clock tracker so callers (and tests) control time. In the
 * app: `makeTtfvTracker(Date.now())` when onboarding mounts, `.reached()` when
 * the starter space is generated.
 */
export function makeTtfvTracker(startedAt: number): TtfvTracker {
  return {
    reached(now = Date.now()): TtfvSample {
      const elapsedMs = Math.max(0, now - startedAt);
      return {
        elapsedMs,
        withinTarget: elapsedMs <= TARGET_TTFV_MS,
        withinMax: elapsedMs <= MAX_TTFV_MS,
      };
    },
  };
}
