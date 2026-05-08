// Reusable valibot building blocks for tool-call argument validation.
//
// Goals:
//   - Enforce Kairos invariants (Discipline values, non-empty ids, sane numbers).
//   - Coerce gently where the model often slips (numeric strings → numbers).
//   - Stay thin — every schema either ships in a tool's `schema` or is composed
//     into one. No business logic here.

import * as v from 'valibot';

import type { Discipline, FieldType } from '../../../types/core';

// ======================== PRIMITIVES ========================

export const NonEmptyString = v.pipe(v.string(), v.trim(), v.minLength(1));

/** Block / node / exercise ids are opaque strings produced by `generateId()`. */
export const IdString = NonEmptyString;

const DISCIPLINES = [
  'strength',
  'running',
  'calisthenics',
  'mobility',
  'team_sport',
  'cycling',
  'swimming',
  'general',
] as const satisfies readonly Discipline[];

export const DisciplineSchema = v.picklist(DISCIPLINES);

export const TextFormatSchema = v.picklist([
  'paragraph',
  'h1',
  'h2',
  'h3',
  'bullet',
  'numbered',
  'checklist',
]);

/** Position within a block's content. `undefined` means append. */
export const PositionSchema = v.optional(
  v.pipe(v.number(), v.integer(), v.minValue(0)),
);

/** A reps value: number for counted, "40s" / "5m" for timed. */
export const RepsSchema = v.optional(
  v.union([
    v.pipe(v.number(), v.minValue(0)),
    v.pipe(v.string(), v.trim(), v.minLength(1)),
  ]),
);

export const PositiveInt = v.pipe(v.number(), v.integer(), v.minValue(1));
export const NonNegativeInt = v.pipe(v.number(), v.integer(), v.minValue(0));
export const NonNegativeNumber = v.pipe(v.number(), v.minValue(0));

export const HexColor = v.pipe(
  v.string(),
  v.regex(/^#[0-9a-fA-F]{6}$/, 'expected #RRGGBB'),
);

const FIELD_TYPES = [
  'number',
  'text',
  'boolean',
  'rating',
  'time',
] as const satisfies readonly FieldType[];

export const FieldTypeSchema = v.picklist(FIELD_TYPES);

// ======================== EXERCISE FIELD ========================
//
// We don't expose the full FieldDefinition schema to the model in Fase 1 — the
// 7-tool palette only takes a *list of field names* and we map them through the
// discipline default. Authoring custom metrics arrives in Fase 1.5.

export const ExerciseFieldShortcutSchema = v.picklist([
  'weight',
  'reps',
  'rir',
  'distance',
  'duration',
  'pace',
  'heartRate',
  'calories',
  'perceivedEffort',
  'progression',
]);

/**
 * Loose FieldDefinition for tool args. Keeps the input ergonomic: model
 * supplies a name + type and we fill the rest with defaults at handler time.
 */
export const FieldDefinitionInputSchema = v.object({
  id: v.optional(NonEmptyString),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
  type: v.optional(FieldTypeSchema),
  unit: v.optional(v.union([v.string(), v.null()])),
  isPrimary: v.optional(v.boolean()),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
  step: v.optional(v.number()),
  defaultValue: v.optional(
    v.union([v.number(), v.string(), v.boolean(), v.null()]),
  ),
});

export type FieldDefinitionInput = v.InferOutput<typeof FieldDefinitionInputSchema>;

/** A single set value bag {fieldId: value}. */
export const SetValuesSchema = v.record(
  NonEmptyString,
  v.union([v.number(), v.string(), v.boolean(), v.null()]),
);
