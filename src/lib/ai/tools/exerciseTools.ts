// Exercise + set tools. Cover everything the model might need to author or
// adjust an ExerciseCard inside a block:
//   - add_exercise: create a new ExerciseCard inside a block (with optional
//     pre-built sets and custom fields).
//   - add_exercise_field / update_exercise_field / remove_exercise_field:
//     custom metric authoring per exercise.
//   - add_set / remove_set / update_set_value: tweak the set table.
//
// All handlers go through the store actions (addExercise, updateExercise,
// updateSetValue, addSet, removeSet) so persistence/reactivity stay coherent.

import * as v from 'valibot';

import { useWorkoutStore } from '../../../store/workoutStore';
import {
  createEmptySet,
  type Discipline,
  type ExerciseCard,
  type ExerciseSet,
  type FieldDefinition,
  type FieldValue,
} from '../../../types/core';
import {
  DisciplineSchema,
  FieldDefinitionInputSchema,
  HexColor,
  IdString,
  NonEmptyString,
  NonNegativeInt,
  NonNegativeNumber,
  PositionSchema,
  PositiveInt,
  RepsSchema,
  SetValuesSchema,
} from '../validation/schemas';
import {
  ToolError,
  defaultFieldsFor,
  findExerciseOrThrow,
  getBlockOrThrow,
  materializeFieldDef,
} from './helpers';
import type { ToolDefinition } from './types';

// ======================== add_exercise ========================

const AddExerciseArgs = v.object({
  blockId: IdString,
  name: v.pipe(NonEmptyString, v.maxLength(80)),
  discipline: v.optional(DisciplineSchema),
  icon: v.optional(NonEmptyString),
  color: v.optional(HexColor),
  fields: v.optional(v.array(FieldDefinitionInputSchema)),
  sets_count: v.optional(v.pipe(PositiveInt, v.maxValue(20))),
  reps: RepsSchema,
  weight: v.optional(NonNegativeNumber),
  rest_seconds: v.optional(v.pipe(NonNegativeInt, v.maxValue(900))),
  notes: v.optional(v.pipe(v.string(), v.maxLength(280))),
  position: PositionSchema,
});

type AddExerciseArgs = v.InferOutput<typeof AddExerciseArgs>;

export const addExerciseTool: ToolDefinition<
  AddExerciseArgs,
  { nodeId: string; exerciseId: string }
> = {
  name: 'add_exercise',
  description:
    'Add an exercise to a block. Optionally specify custom fields (overriding the discipline default) and pre-fill values like reps/weight in every set.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      name: { type: 'string' },
      discipline: {
        type: 'string',
        enum: [
          'strength',
          'running',
          'calisthenics',
          'mobility',
          'team_sport',
          'cycling',
          'swimming',
          'general',
        ],
      },
      icon: { type: 'string' },
      color: { type: 'string' },
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['number', 'text', 'boolean', 'rating', 'time'] },
            unit: { type: ['string', 'null'] },
            isPrimary: { type: 'boolean' },
            min: { type: 'number' },
            max: { type: 'number' },
            step: { type: 'number' },
          },
          required: ['name'],
        },
      },
      sets_count: { type: 'integer', minimum: 1, maximum: 20 },
      reps: { oneOf: [{ type: 'number' }, { type: 'string' }] },
      weight: { type: 'number', minimum: 0 },
      rest_seconds: { type: 'integer', minimum: 0, maximum: 900 },
      notes: { type: 'string' },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId', 'name'],
    additionalProperties: false,
  },
  schema: AddExerciseArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    const block = getBlockOrThrow(args.blockId);
    const disc: Discipline = args.discipline ?? block.discipline;

    const fields: FieldDefinition[] | undefined = args.fields
      ? args.fields.map((f, i) => materializeFieldDef(f, i))
      : undefined;

    // 1. Create the exercise (which appends a node at the end of content).
    store.addExercise(args.blockId, {
      name: args.name,
      discipline: disc,
      icon: args.icon,
      color: args.color,
      fields,
    });

    // 2. Find the just-created exercise — last exercise in the block.
    const fresh = store.blocks.find((b) => b.id === args.blockId);
    if (!fresh) throw new ToolError('block disappeared after add');
    const exerciseNodes = fresh.content.filter((n) => n.type === 'exercise');
    const lastNode = exerciseNodes[exerciseNodes.length - 1];
    if (!lastNode || lastNode.type !== 'exercise') {
      throw new ToolError('addExercise did not create an exercise node');
    }
    const ex = lastNode.data.exercise;

    // 3. Apply optional notes / rest / sets configuration.
    const updates: Partial<ExerciseCard> = {};
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.rest_seconds !== undefined) updates.rest_seconds = args.rest_seconds;
    if (args.sets_count !== undefined) updates.default_sets_count = args.sets_count;
    if (Object.keys(updates).length > 0) {
      store.updateExercise(args.blockId, ex.id, updates);
    }

    // 4. Adjust the number of sets to match sets_count if provided.
    if (args.sets_count !== undefined) {
      const current = ex.sets.length;
      if (args.sets_count > current) {
        for (let i = 0; i < args.sets_count - current; i += 1) {
          store.addSet(args.blockId, ex.id);
        }
      } else if (args.sets_count < current) {
        const refreshed = store.blocks
          .find((b) => b.id === args.blockId)
          ?.content.find((n) => n.type === 'exercise' && n.data.exercise.id === ex.id);
        if (refreshed && refreshed.type === 'exercise') {
          const setsToDrop = refreshed.data.exercise.sets.slice(args.sets_count);
          for (const s of setsToDrop) store.removeSet(args.blockId, ex.id, s.id);
        }
      }
    }

    // 5. Pre-fill set values (reps, weight) in every set.
    const fillAllSets = (fieldId: string, value: FieldValue): void => {
      const refreshed = useWorkoutStore
        .getState()
        .blocks.find((b) => b.id === args.blockId)
        ?.content.find((n) => n.type === 'exercise' && n.data.exercise.id === ex.id);
      if (!refreshed || refreshed.type !== 'exercise') return;
      for (const s of refreshed.data.exercise.sets) {
        store.updateSetValue(args.blockId, ex.id, s.id, fieldId, value);
      }
    };
    if (args.reps !== undefined) fillAllSets('reps', args.reps);
    if (args.weight !== undefined) fillAllSets('weight', args.weight);

    // 6. Move into requested position if requested.
    if (args.position !== undefined) {
      const refreshed = useWorkoutStore
        .getState()
        .blocks.find((b) => b.id === args.blockId);
      if (refreshed) {
        const sorted = [...refreshed.content].sort((a, b) => a.order - b.order);
        const ordered = sorted.map((n) => n.id).filter((id) => id !== lastNode.id);
        const clamped = Math.max(0, Math.min(args.position, ordered.length));
        ordered.splice(clamped, 0, lastNode.id);
        store.reorderContentNodes(args.blockId, ordered);
      }
    }

    return { nodeId: lastNode.id, exerciseId: ex.id };
  },
};

// ======================== add_exercise_field ========================

const AddExerciseFieldArgs = v.object({
  exerciseId: IdString,
  field: FieldDefinitionInputSchema,
});

type AddExerciseFieldArgs = v.InferOutput<typeof AddExerciseFieldArgs>;

export const addExerciseFieldTool: ToolDefinition<
  AddExerciseFieldArgs,
  { fieldId: string }
> = {
  name: 'add_exercise_field',
  description:
    'Add a custom metric to an exercise (e.g. RPE, distance, cadence). Existing sets get a null value for the new field.',
  parameters: {
    type: 'object',
    properties: {
      exerciseId: { type: 'string' },
      field: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['number', 'text', 'boolean', 'rating', 'time'] },
          unit: { type: ['string', 'null'] },
          isPrimary: { type: 'boolean' },
          min: { type: 'number' },
          max: { type: 'number' },
          step: { type: 'number' },
        },
        required: ['name'],
      },
    },
    required: ['exerciseId', 'field'],
    additionalProperties: false,
  },
  schema: AddExerciseFieldArgs,
  handler: (args) => {
    const { block, exercise } = findExerciseOrThrow(args.exerciseId);
    const store = useWorkoutStore.getState();
    if (exercise.fields.some((f) => f.id === args.field.id || f.name === args.field.name)) {
      throw new ToolError(`field "${args.field.name}" already exists on this exercise`);
    }
    const next = materializeFieldDef(args.field, exercise.fields.length);
    const fields: FieldDefinition[] = [...exercise.fields, next];
    const sets: ExerciseSet[] = exercise.sets.map((s) => ({
      ...s,
      values: { ...s.values, [next.id]: next.defaultValue ?? null },
    }));
    store.updateExercise(block.id, exercise.id, { fields, sets });
    return { fieldId: next.id };
  },
};

// ======================== update_exercise_field ========================

const UpdateExerciseFieldArgs = v.object({
  exerciseId: IdString,
  fieldId: IdString,
  patch: v.object({
    name: v.optional(NonEmptyString),
    unit: v.optional(v.union([v.string(), v.null()])),
    isPrimary: v.optional(v.boolean()),
    min: v.optional(v.number()),
    max: v.optional(v.number()),
    step: v.optional(v.number()),
  }),
});

type UpdateExerciseFieldArgs = v.InferOutput<typeof UpdateExerciseFieldArgs>;

export const updateExerciseFieldTool: ToolDefinition<
  UpdateExerciseFieldArgs,
  { ok: true }
> = {
  name: 'update_exercise_field',
  description: 'Change attributes (name, unit, primary flag, bounds) of an exercise field.',
  parameters: {
    type: 'object',
    properties: {
      exerciseId: { type: 'string' },
      fieldId: { type: 'string' },
      patch: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unit: { type: ['string', 'null'] },
          isPrimary: { type: 'boolean' },
          min: { type: 'number' },
          max: { type: 'number' },
          step: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    required: ['exerciseId', 'fieldId', 'patch'],
    additionalProperties: false,
  },
  schema: UpdateExerciseFieldArgs,
  handler: (args) => {
    const { block, exercise } = findExerciseOrThrow(args.exerciseId);
    const store = useWorkoutStore.getState();
    const idx = exercise.fields.findIndex((f) => f.id === args.fieldId);
    if (idx < 0) throw new ToolError(`field "${args.fieldId}" not found`);
    const fields = exercise.fields.map((f, i) =>
      i === idx ? { ...f, ...args.patch } : f,
    );
    store.updateExercise(block.id, exercise.id, { fields });
    return { ok: true };
  },
};

// ======================== remove_exercise_field ========================

const RemoveExerciseFieldArgs = v.object({
  exerciseId: IdString,
  fieldId: IdString,
});

type RemoveExerciseFieldArgs = v.InferOutput<typeof RemoveExerciseFieldArgs>;

export const removeExerciseFieldTool: ToolDefinition<
  RemoveExerciseFieldArgs,
  { ok: true }
> = {
  name: 'remove_exercise_field',
  description: 'Remove a custom metric from an exercise. Strips the value from every set too.',
  parameters: {
    type: 'object',
    properties: {
      exerciseId: { type: 'string' },
      fieldId: { type: 'string' },
    },
    required: ['exerciseId', 'fieldId'],
    additionalProperties: false,
  },
  schema: RemoveExerciseFieldArgs,
  handler: (args) => {
    const { block, exercise } = findExerciseOrThrow(args.exerciseId);
    const store = useWorkoutStore.getState();
    const target = exercise.fields.find((f) => f.id === args.fieldId);
    if (!target) throw new ToolError(`field "${args.fieldId}" not found`);
    if (target.isBase) {
      throw new ToolError(
        `cannot remove base field "${target.name}" — use update_exercise_field to rename it`,
      );
    }
    const fields = exercise.fields
      .filter((f) => f.id !== args.fieldId)
      .map((f, i) => ({ ...f, order: i }));
    const sets: ExerciseSet[] = exercise.sets.map((s) => {
      const next = { ...s.values };
      delete next[args.fieldId];
      return { ...s, values: next };
    });
    store.updateExercise(block.id, exercise.id, { fields, sets });
    return { ok: true };
  },
};

// ======================== update_set_value ========================

const UpdateSetValueArgs = v.object({
  exerciseId: IdString,
  setIndex: NonNegativeInt,
  fieldId: IdString,
  value: v.union([v.number(), v.string(), v.boolean(), v.null()]),
});

type UpdateSetValueArgs = v.InferOutput<typeof UpdateSetValueArgs>;

export const updateSetValueTool: ToolDefinition<UpdateSetValueArgs, { ok: true }> = {
  name: 'update_set_value',
  description: 'Set a single field value for one set inside an exercise (e.g. set #2, weight = 70).',
  parameters: {
    type: 'object',
    properties: {
      exerciseId: { type: 'string' },
      setIndex: { type: 'integer', minimum: 0 },
      fieldId: { type: 'string' },
      value: {
        oneOf: [
          { type: 'number' },
          { type: 'string' },
          { type: 'boolean' },
          { type: 'null' },
        ],
      },
    },
    required: ['exerciseId', 'setIndex', 'fieldId', 'value'],
    additionalProperties: false,
  },
  schema: UpdateSetValueArgs,
  handler: (args) => {
    const { block, exercise } = findExerciseOrThrow(args.exerciseId);
    const store = useWorkoutStore.getState();
    const set = exercise.sets[args.setIndex];
    if (!set) throw new ToolError(`set index ${args.setIndex} out of range (have ${exercise.sets.length})`);
    if (!exercise.fields.some((f) => f.id === args.fieldId)) {
      throw new ToolError(`field "${args.fieldId}" not on exercise`);
    }
    store.updateSetValue(block.id, exercise.id, set.id, args.fieldId, args.value);
    return { ok: true };
  },
};

// ======================== add_set ========================

const AddSetArgs = v.object({
  exerciseId: IdString,
  values: v.optional(SetValuesSchema),
});

type AddSetArgs = v.InferOutput<typeof AddSetArgs>;

export const addSetTool: ToolDefinition<AddSetArgs, { setIndex: number }> = {
  name: 'add_set',
  description: 'Append a new set to an exercise. Optionally pre-fill values keyed by fieldId.',
  parameters: {
    type: 'object',
    properties: {
      exerciseId: { type: 'string' },
      values: {
        type: 'object',
        description: 'Optional initial values keyed by fieldId.',
        additionalProperties: true,
      },
    },
    required: ['exerciseId'],
    additionalProperties: false,
  },
  schema: AddSetArgs,
  handler: (args) => {
    const { block, exercise } = findExerciseOrThrow(args.exerciseId);
    const store = useWorkoutStore.getState();
    store.addSet(block.id, exercise.id);
    if (args.values) {
      const refreshed = useWorkoutStore
        .getState()
        .blocks.find((b) => b.id === block.id)
        ?.content.find((n) => n.type === 'exercise' && n.data.exercise.id === exercise.id);
      if (refreshed && refreshed.type === 'exercise') {
        const newSet = refreshed.data.exercise.sets[refreshed.data.exercise.sets.length - 1];
        if (newSet) {
          for (const [fieldId, value] of Object.entries(args.values)) {
            if (refreshed.data.exercise.fields.some((f) => f.id === fieldId)) {
              store.updateSetValue(block.id, exercise.id, newSet.id, fieldId, value);
            }
          }
        }
      }
    }
    const after = useWorkoutStore
      .getState()
      .blocks.find((b) => b.id === block.id)
      ?.content.find((n) => n.type === 'exercise' && n.data.exercise.id === exercise.id);
    const setIndex =
      after && after.type === 'exercise' ? after.data.exercise.sets.length - 1 : 0;
    return { setIndex };
  },
};

// ======================== remove_set ========================

const RemoveSetArgs = v.object({
  exerciseId: IdString,
  setIndex: NonNegativeInt,
});

type RemoveSetArgs = v.InferOutput<typeof RemoveSetArgs>;

export const removeSetTool: ToolDefinition<RemoveSetArgs, { ok: true }> = {
  name: 'remove_set',
  description: 'Delete one set from an exercise by 0-based index.',
  parameters: {
    type: 'object',
    properties: {
      exerciseId: { type: 'string' },
      setIndex: { type: 'integer', minimum: 0 },
    },
    required: ['exerciseId', 'setIndex'],
    additionalProperties: false,
  },
  schema: RemoveSetArgs,
  handler: (args) => {
    const { block, exercise } = findExerciseOrThrow(args.exerciseId);
    const store = useWorkoutStore.getState();
    const target = exercise.sets[args.setIndex];
    if (!target) throw new ToolError(`set index ${args.setIndex} out of range`);
    store.removeSet(block.id, exercise.id, target.id);
    return { ok: true };
  },
};

// Stop unused-import warnings in some ts configs.
void createEmptySet;
void defaultFieldsFor;
