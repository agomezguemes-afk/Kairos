// Block-level tools: create / update meta / delete a WorkoutBlock.
//
// All tool handlers run synchronously against `useWorkoutStore.getState()` so
// the UI re-renders as the agent works (the user sees Kai building the block
// in real time). Idempotency: deleting a missing block is a no-op success;
// updating a missing block is a hard error so the model can self-correct.

import * as v from 'valibot';

import { useWorkoutStore } from '../../../store/workoutStore';
import type { Discipline } from '../../../types/core';
import { DisciplineSchema, HexColor, IdString, NonEmptyString } from '../validation/schemas';
import { getBlockOrThrow } from './helpers';
import type { ToolDefinition } from './types';

// ======================== create_block ========================

const CreateBlockArgs = v.object({
  name: v.pipe(NonEmptyString, v.maxLength(80)),
  discipline: DisciplineSchema,
  icon: v.optional(NonEmptyString),
  color: v.optional(HexColor),
});

type CreateBlockArgs = v.InferOutput<typeof CreateBlockArgs>;

export const createBlockTool: ToolDefinition<CreateBlockArgs, { blockId: string }> = {
  name: 'create_block',
  description:
    'Create a new empty workout block. Returns its blockId. ALWAYS call this BEFORE adding any content when the user asks for a new block.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short human-readable title.' },
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
      icon: { type: 'string', description: 'Optional icon id.' },
      color: { type: 'string', description: 'Optional hex color #RRGGBB.' },
    },
    required: ['name', 'discipline'],
    additionalProperties: false,
  },
  schema: CreateBlockArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    const blockId = store.addBlock(args.discipline as Discipline, {
      name: args.name,
      icon: args.icon,
      color: args.color,
    });
    return { blockId };
  },
};

// ======================== set_block_meta ========================

const SetBlockMetaArgs = v.object({
  blockId: IdString,
  name: v.optional(v.pipe(NonEmptyString, v.maxLength(80))),
  description: v.optional(v.pipe(v.string(), v.maxLength(280))),
  icon: v.optional(NonEmptyString),
  color: v.optional(HexColor),
});

type SetBlockMetaArgs = v.InferOutput<typeof SetBlockMetaArgs>;

export const setBlockMetaTool: ToolDefinition<SetBlockMetaArgs, { ok: true }> = {
  name: 'set_block_meta',
  description:
    'Update metadata on an existing block (name, description, icon, color). Pass only the fields you want to change.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      color: { type: 'string' },
    },
    required: ['blockId'],
    additionalProperties: false,
  },
  schema: SetBlockMetaArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);

    const updates: Parameters<typeof store.updateBlock>[1] = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.color !== undefined) updates.color = args.color;
    if (Object.keys(updates).length === 0) {
      throw new Error('no fields to update');
    }
    store.updateBlock(args.blockId, updates);
    return { ok: true };
  },
};

// ======================== delete_block ========================

const DeleteBlockArgs = v.object({ blockId: IdString });
type DeleteBlockArgs = v.InferOutput<typeof DeleteBlockArgs>;

export const deleteBlockTool: ToolDefinition<DeleteBlockArgs, { ok: true }> = {
  name: 'delete_block',
  description: 'Delete a block by id. Idempotent — deleting a missing block is a no-op.',
  parameters: {
    type: 'object',
    properties: { blockId: { type: 'string' } },
    required: ['blockId'],
    additionalProperties: false,
  },
  schema: DeleteBlockArgs,
  handler: (args) => {
    useWorkoutStore.getState().deleteBlock(args.blockId);
    return { ok: true };
  },
};
