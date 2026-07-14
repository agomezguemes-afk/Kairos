// Pure formatting for the scoreboard — the giant target (peso × reps or
// distancia · ritmo) and the Spanish VoiceOver announcement strings. Kept out
// of the component so the display logic is unit-tested and disciplines beyond
// strength (running, mobility, hybrid) get the same treatment for free.

import type { FieldDefinition, FieldValue } from '../../../types/core';

// Mirrors SetInput's numeric field predicate so the giant target reads the same
// fields the numpad edits.
const NUMERIC_TYPES = new Set(['number', 'time']);

export interface TargetSegment {
  value: string;
  /** null → no unit shown (e.g. reps). */
  unit: string | null;
}

export interface FormattedTarget {
  segments: TargetSegment[];
  /** '×' for the weight×reps idiom; '·' for everything else. */
  separator: '×' | '·';
  /** Spanish spoken form for VoiceOver, e.g. "60 kilos por 8". */
  spoken: string;
}

/** "60" from 60, "62.5" from 62.5 — trims trailing zeros without exponent noise. */
export function stripZero(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

const UNIT_SPOKEN: Record<string, string> = {
  kg: 'kilos',
  km: 'kilómetros',
  m: 'metros',
  min: 'minutos',
  sec: 'segundos',
  'min/km': 'minutos por kilómetro',
  bpm: 'pulsaciones',
  kcal: 'calorías',
  '/10': 'sobre 10',
};

function spokenUnit(unit: string | null): string {
  if (!unit) return '';
  return UNIT_SPOKEN[unit] ?? unit;
}

/**
 * Build the giant target from an exercise's fields + a set's values. Takes the
 * first two numeric fields (order-sorted) that carry a value. Returns null when
 * nothing numeric is filled — a bodyweight/no-target set, where the scoreboard
 * shows the exercise alone and HECHO still confirms.
 */
export function formatScoreboardTarget(
  fields: FieldDefinition[],
  values: Record<string, FieldValue>,
): FormattedTarget | null {
  const numeric = fields.filter((f) => NUMERIC_TYPES.has(f.type)).sort((a, b) => a.order - b.order);

  const picked: { field: FieldDefinition; value: string }[] = [];
  for (const f of numeric) {
    const v = values[f.id];
    if (v == null || v === '') continue;
    const value = typeof v === 'number' ? stripZero(v) : String(v);
    picked.push({ field: f, value });
    if (picked.length === 2) break;
  }
  if (picked.length === 0) return null;

  const isWeightReps =
    picked.length === 2 && picked[0].field.id === 'weight' && picked[1].field.id === 'reps';
  const separator: '×' | '·' = isWeightReps ? '×' : '·';

  const segments: TargetSegment[] = picked.map((p) => ({ value: p.value, unit: p.field.unit }));

  // A lone unit-less number is unreadable at two metres: "6" — reps? kilos?
  // minutes? Paired with a weight the × idiom disambiguates it ("60 kg × 6"),
  // but alone it must name itself, so fall back to the field's own label.
  if (segments.length === 1 && !segments[0].unit) {
    segments[0] = { ...segments[0], unit: picked[0].field.name.toLowerCase() };
  }

  const spoken = picked
    .map((p, i) => {
      const u = spokenUnit(segments[i].unit);
      return u ? `${p.value} ${u}` : p.value;
    })
    .join(separator === '×' ? ' por ' : ', ');

  return { segments, separator, spoken };
}

// ── VoiceOver announcement builders (state-change speech) ────────────────────

export function announceSetActive(args: {
  setIndex: number;
  setTotal: number;
  exerciseName: string;
  target: FormattedTarget | null;
}): string {
  const base = `Set ${args.setIndex} de ${args.setTotal}. ${args.exerciseName}.`;
  return args.target ? `${base} Objetivo ${args.target.spoken}.` : base;
}

export function announceRest(nextLabel: string | null): string {
  return nextLabel ? `Descanso. Siguiente: ${nextLabel}.` : 'Descanso.';
}

export function announceExerciseChange(
  exerciseName: string,
  target: FormattedTarget | null,
): string {
  const base = `Nuevo ejercicio: ${exerciseName}.`;
  return target ? `${base} Objetivo ${target.spoken}.` : base;
}

export function announceFinished(): string {
  return 'Sesión completada.';
}
