// KAIROS — Reveal view-model: the seeded week + featured block Kai built.
//
// The presentation step needs a store-free, native-free description of what
// generation produced: the N days it seeded (from weekAssignments) and the
// featured block to show in full. The host (PremiumOnboardingScreen) builds
// this from the real OnboardingSpaceResult; the presentational fallback below
// keeps deep-linked previews/tests honest without touching the store.

import { Colors } from '../../../theme/tokens';
import { weekdaysForFrequency } from '../../../lib/routines/weekAssignments';
import type { OnboardingDraft, OnboardingGoal } from '../flow/onboardingFlow';
import { previewStarterBlock } from '../flow/starterPreview';
import { weekdayLabelES } from './weekdayLabels';

export { weekdayLabelES };

export interface RevealExercise {
  name: string;
  /** Human detail, e.g. "4 series". */
  detail: string;
}

export interface RevealFeatured {
  name: string;
  /** Accent hex for the block tag (discipline color). */
  accent: string;
  exercises: RevealExercise[];
}

export interface RevealDay {
  /** 0=domingo … 6=sábado (weekAssignments convention). */
  weekday: number;
  /** Short Spanish label, e.g. "Lun". */
  label: string;
  /** Name of the block seeded on this day. */
  blockName: string;
  accent: string;
}

export interface RevealPlan {
  featured: RevealFeatured;
  /** The seeded week — one entry per declared training day. */
  week: RevealDay[];
  source: 'ai' | 'template';
}

/**
 * Presentational fallback for deep-linked previews / tests where the host does
 * not supply a real reveal. Mirrors the curated starter preview + the canonical
 * weekday spread, so the reveal is coherent even without generation.
 */
export function localRevealFromDraft(draft: OnboardingDraft): RevealPlan {
  return buildLocalReveal(draft.goal, draft.daysPerWeek ?? 3);
}

function buildLocalReveal(goal: OnboardingGoal | null, days: number): RevealPlan {
  const preview = previewStarterBlock(goal);
  const accent = Colors.discipline[preview.discipline] ?? Colors.gold.base;
  const week: RevealDay[] = weekdaysForFrequency(days).map((weekday) => ({
    weekday,
    label: weekdayLabelES(weekday),
    blockName: preview.name,
    accent,
  }));
  return {
    featured: { name: preview.name, accent, exercises: preview.exercises },
    week,
    source: 'template',
  };
}
