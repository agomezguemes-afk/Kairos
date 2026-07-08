// KAIROS — El Manuscrito: pure sentence specs for the "first page of your Book"
// onboarding. See docs/ONBOARDING_MANUSCRITO.md.
//
// This module is presentation-agnostic: it defines WHAT the page says (Kai's
// ink, the blanks, the skip rewrites) and how filled values map back onto the
// OnboardingDraft. No RN imports — unit-testable like onboardingFlow.ts.

import type { ExperienceLevel, OnboardingDraft, OnboardingGoal } from '../flow/onboardingFlow';
import {
  DEFAULT_DAYS_PER_WEEK,
  MAX_NAME_LEN,
  normalizeAiPrompt,
  normalizeName,
} from '../flow/onboardingFlow';

export type BlankKind = 'text' | 'choice' | 'scrubber' | 'chips' | 'prompt';

export interface ChoiceOption {
  /** The word as it reads inside the sentence. */
  word: string;
  value: string;
}

export interface SentenceSpec {
  id: 'name' | 'goal' | 'experience' | 'days' | 'equipment' | 'prompt';
  /** Kai's ink before the blank. */
  before: string;
  /** Kai's ink after the blank (usually the final period). */
  after: string;
  kind: BlankKind;
  options?: readonly ChoiceOption[];
  /** Label of the quiet skip action for this blank. */
  skipLabel: string;
  /**
   * When skipped, the whole sentence is rewritten to this (Kai keeps the page
   * dignified — a skipped answer is never an empty slot).
   */
  skipRewrite: string;
}

// Human words only — the goal/experience vocabulary is the user's, not the
// gym's (NUCLEO_DETERMINISTA §0.5: zero jargon in UI).
export const GOAL_OPTIONS: readonly ChoiceOption[] = [
  { word: 'fuerza', value: 'strength' },
  { word: 'aguantar más', value: 'endurance' },
  { word: 'moverme mejor', value: 'flexibility' },
  { word: 'encontrarme mejor', value: 'health' },
];

export const EXPERIENCE_OPTIONS: readonly ChoiceOption[] = [
  { word: 'hace nada', value: 'beginner' },
  { word: 'hace un tiempo', value: 'intermediate' },
  { word: 'hace años', value: 'advanced' },
];

// Equipment ids mirror the classic step so the draft stays compatible with
// generateStarterRoutine. Words are chosen to read as prose when composed.
export const EQUIPMENT_OPTIONS: readonly ChoiceOption[] = [
  { word: 'mi cuerpo', value: 'bodyweight' },
  { word: 'mancuernas', value: 'dumbbells' },
  { word: 'una barra', value: 'barbell_plates' },
  { word: 'kettlebell', value: 'kettlebell' },
  { word: 'bandas', value: 'resistance_bands' },
  { word: 'dominadas', value: 'pull_up_bar' },
  { word: 'un gimnasio', value: 'machines_full_gym' },
  { word: 'esterilla', value: 'yoga_mat' },
];

/** Kai's opening line — the meet-the-character beat, folded into the page. */
export const OPENING_LINE = 'Soy Kai. Este libro es tuyo; yo solo lo cuido.';

/** Kai's closing line, written after the last blank settles. */
export const CLOSING_LINE = 'El resto se escribe entrenando.';

/** The signature Kai puts under the page. */
export const SIGNATURE = '— Kai';

export const SENTENCES: readonly SentenceSpec[] = [
  {
    id: 'name',
    before: 'Este libro es de ',
    after: '.',
    kind: 'text',
    skipLabel: 'me lo callo',
    skipRewrite: 'Este libro es mío.',
  },
  {
    id: 'goal',
    before: 'Ahora mismo busco ',
    after: '.',
    kind: 'choice',
    options: GOAL_OPTIONS,
    skipLabel: 'aún no lo sé',
    skipRewrite: 'Ahora mismo busco encontrarme mejor.',
  },
  {
    id: 'experience',
    before: 'Entreno desde ',
    after: '.',
    kind: 'choice',
    options: EXPERIENCE_OPTIONS,
    skipLabel: 'da igual',
    skipRewrite: 'Entreno a mi manera.',
  },
  {
    id: 'days',
    before: 'Puedo darle ',
    after: ' días a la semana.',
    kind: 'scrubber',
    skipLabel: 'ya veré',
    skipRewrite: 'Le daré los días que pueda.',
  },
  {
    id: 'equipment',
    before: 'A mano tengo ',
    after: '.',
    kind: 'chips',
    options: EQUIPMENT_OPTIONS,
    skipLabel: 'poca cosa',
    skipRewrite: 'A mano tengo mi propio cuerpo.',
  },
  {
    id: 'prompt',
    before: 'Y en mis palabras: ',
    after: '',
    kind: 'prompt',
    skipLabel: 'nada que añadir',
    skipRewrite: 'Y el resto, en persona.',
  },
];

/** "a, b y c" — composes chosen equipment words into serial prose. */
export function serialList(words: readonly string[]): string {
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}`;
}

/** One filled (or skipped) blank, as recorded by the page. */
export interface FilledBlank {
  id: SentenceSpec['id'];
  skipped: boolean;
  /** Raw value(s) — meaning depends on the blank kind. */
  value: string | number | readonly string[] | null;
}

/** Fold the page's answers onto a draft. Skipped blanks leave the field null
    so applySmartDefaults keeps owning the fallback semantics. */
export function applyPage(draft: OnboardingDraft, filled: readonly FilledBlank[]): OnboardingDraft {
  const next: OnboardingDraft = { ...draft };
  for (const f of filled) {
    if (f.skipped) continue;
    switch (f.id) {
      case 'name':
        next.name = normalizeName(typeof f.value === 'string' ? f.value : null);
        break;
      case 'goal':
        next.goal = (f.value as OnboardingGoal) ?? null;
        break;
      case 'experience':
        next.experience = (f.value as ExperienceLevel) ?? null;
        break;
      case 'days':
        next.daysPerWeek = typeof f.value === 'number' ? f.value : DEFAULT_DAYS_PER_WEEK;
        break;
      case 'equipment':
        next.equipment = Array.isArray(f.value) ? [...f.value] : [];
        break;
      case 'prompt':
        next.aiPrompt = normalizeAiPrompt(typeof f.value === 'string' ? f.value : null);
        break;
    }
  }
  return next;
}

export { MAX_NAME_LEN };
