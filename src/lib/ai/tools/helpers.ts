// Shared utilities for tool handlers.
//
// Every handler runs against the live store via `useWorkoutStore.getState()`.
// These helpers centralise the lookup + error-throwing patterns so handler
// bodies stay focused on the actual mutation.

import { useWorkoutStore } from '../../../store/workoutStore';
import type {
  ContentNode,
  ExerciseContentNode,
  SubBlockContentNode,
} from '../../../types/content';
import type {
  Discipline,
  ExerciseCard,
  FieldDefinition,
  WorkoutBlock,
} from '../../../types/core';
import { DISCIPLINE_CONFIGS } from '../../../types/core';

import type { FieldDefinitionInput } from '../validation/schemas';

export const MAX_SUBBLOCK_DEPTH = 20;

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

export function getBlockOrThrow(blockId: string): WorkoutBlock {
  const block = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
  if (!block) throw new ToolError(`block "${blockId}" not found`);
  return block;
}

export function findNodeOrThrow(
  block: WorkoutBlock,
  nodeId: string,
): ContentNode {
  const node = block.content.find((n) => n.id === nodeId);
  if (!node) throw new ToolError(`node "${nodeId}" not found in block "${block.id}"`);
  return node;
}

/** Locate the (block, exercise) pair given just an exercise id. */
export function findExerciseOrThrow(exerciseId: string): {
  block: WorkoutBlock;
  exercise: ExerciseCard;
} {
  const blocks = useWorkoutStore.getState().blocks;
  for (const block of blocks) {
    for (const node of block.content) {
      if (node.type === 'exercise' && node.data.exercise.id === exerciseId) {
        return { block, exercise: node.data.exercise };
      }
    }
  }
  throw new ToolError(`exercise "${exerciseId}" not found`);
}

/**
 * Compute the nesting depth of a candidate parent block. A block referenced as
 * a `subBlock` content node inside another block deepens that ancestor's
 * effective depth. We refuse to wrap any sub-block whose new depth would
 * exceed MAX_SUBBLOCK_DEPTH (default 20).
 */
export function getBlockDepth(blockId: string, visited = new Set<string>()): number {
  if (visited.has(blockId)) return 0;
  visited.add(blockId);
  const block = useWorkoutStore.getState().blocks.find((b) => b.id === blockId);
  if (!block) return 0;
  let max = 0;
  for (const node of block.content) {
    if (node.type === 'subBlock') {
      const childDepth = 1 + getBlockDepth(node.data.blockId, visited);
      if (childDepth > max) max = childDepth;
    }
  }
  return max;
}

export function isExerciseNode(node: ContentNode): node is ExerciseContentNode {
  return node.type === 'exercise';
}

export function isSubBlockNode(node: ContentNode): node is SubBlockContentNode {
  return node.type === 'subBlock';
}

/**
 * Convert the loose FieldDefinitionInput from a tool call into a concrete
 * FieldDefinition the store accepts. Picks sensible defaults for the model.
 */
export function materializeFieldDef(
  input: FieldDefinitionInput,
  order = 0,
): FieldDefinition {
  const id = input.id?.trim() ?? slugify(input.name);
  return {
    id,
    name: input.name,
    type: input.type ?? 'number',
    unit: input.unit ?? null,
    isBase: false,
    isPrimary: input.isPrimary ?? false,
    order,
    ...(input.min !== undefined ? { min: input.min } : {}),
    ...(input.max !== undefined ? { max: input.max } : {}),
    ...(input.step !== undefined ? { step: input.step } : {}),
    ...(input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
  };
}

/** Default fields for a discipline — used when the model doesn't specify. */
export function defaultFieldsFor(discipline: Discipline): FieldDefinition[] {
  return DISCIPLINE_CONFIGS[discipline].defaultFields.map((f, i) => ({
    ...f,
    order: i,
  }));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || `field_${Date.now().toString(36)}`;
}
