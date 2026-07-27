// The giant target declared as MEMORY: compare the current (draft-aware)
// objective against the last performance and say it in one sober line —
// "Sugerido · +2.5 kg" / "igual que la última". All copy lives here so the
// screen only renders text and the whole thing is unit-testable. Primary axis
// is weight (kg); falls back to reps when weight isn't comparable on both
// sides. Spec: docs/night-run/BRIEF-04.md.

import type { FieldValue } from '../../../types/core';
import { stripZero } from './format';

export type DeltaDirection = 'up' | 'down' | 'same';

export interface ProgressionDelta {
  field: 'weight' | 'reps';
  direction: DeltaDirection;
  /** Signed. +2.5, -1, 0. */
  delta: number;
  /** Visual: "+2.5 kg" | "−1 rep" | "igual que la última". */
  label: string;
  /** VoiceOver: "2.5 kilos más que la última" | "1 repetición menos que la última" | "igual que la última vez". */
  spoken: string;
}

const MINUS = '−'; // typographic minus, not hyphen — aligns with tabular numerals

// "1 kilo" vs "2.5 kilos" — decimals take the plural in Spanish.
function kiloWord(abs: number): string {
  return abs === 1 ? 'kilo' : 'kilos';
}

function buildWeightDelta(delta: number): ProgressionDelta {
  const abs = Math.abs(delta);
  if (delta === 0) {
    return {
      field: 'weight',
      direction: 'same',
      delta: 0,
      label: 'igual que la última',
      spoken: 'igual que la última vez',
    };
  }
  const up = delta > 0;
  return {
    field: 'weight',
    direction: up ? 'up' : 'down',
    delta,
    label: up ? `+${stripZero(abs)} kg` : `${MINUS}${stripZero(abs)} kg`,
    spoken: `${stripZero(abs)} ${kiloWord(abs)} ${up ? 'más' : 'menos'} que la última`,
  };
}

function buildRepsDelta(delta: number): ProgressionDelta {
  const abs = Math.abs(delta);
  if (delta === 0) {
    return {
      field: 'reps',
      direction: 'same',
      delta: 0,
      label: 'igual que la última',
      spoken: 'igual que la última vez',
    };
  }
  const up = delta > 0;
  const short = abs === 1 ? 'rep' : 'reps';
  const long = abs === 1 ? 'repetición' : 'repeticiones';
  return {
    field: 'reps',
    direction: up ? 'up' : 'down',
    delta,
    label: up ? `+${stripZero(abs)} ${short}` : `${MINUS}${stripZero(abs)} ${short}`,
    spoken: `${stripZero(abs)} ${long} ${up ? 'más' : 'menos'} que la última`,
  };
}

/**
 * Delta of the current target vs the last time. Primary axis = weight (kg);
 * if weight isn't comparable on both sides, falls back to reps. Returns null
 * when there is no previous reference or nothing comparable. `previous`
 * accepts the shape of PreviousReference (weight/reps).
 */
export function computeProgressionDelta(
  current: Record<string, FieldValue>,
  previous: { weight: number | null; reps: number | null } | null,
): ProgressionDelta | null {
  if (previous == null) return null;

  const curWeight = current['weight'];
  if (previous.weight != null && typeof curWeight === 'number') {
    return buildWeightDelta(curWeight - previous.weight);
  }

  const curReps = current['reps'];
  if (previous.reps != null && typeof curReps === 'number') {
    return buildRepsDelta(curReps - previous.reps);
  }

  return null;
}

/**
 * Composes the line the user sees/hears. `edited=false` → the target is the
 * memory's suggestion untouched; `edited=true` → the user already corrected
 * it (never say "Sugerido" about a value the user typed).
 */
export function progressionCaption(
  delta: ProgressionDelta | null,
  opts: { edited: boolean },
): { text: string; spoken: string } | null {
  if (!opts.edited) {
    if (delta == null) {
      return { text: 'Sugerido', spoken: 'Objetivo sugerido por tu progresión' };
    }
    if (delta.direction === 'same') {
      return {
        text: 'Sugerido · igual que la última',
        spoken: 'Objetivo sugerido, igual que la última vez',
      };
    }
    return {
      text: `Sugerido · ${delta.label}`,
      spoken: `Objetivo sugerido, ${delta.spoken}`,
    };
  }

  if (delta == null) return null;
  if (delta.direction === 'same') {
    return { text: 'Igual que la última', spoken: 'Igual que la última vez' };
  }
  return { text: `${delta.label} vs la última`, spoken: delta.spoken };
}
