// Content-node tools: text, divider, image, timer, spacer, dashboard,
// customField, columnSection wrapping, subBlock wrapping, plus generic
// move/update/delete operations.
//
// Every handler mutates a single block via the store actions in
// useWorkoutStore. They commit immediately so the UI re-renders mid-loop —
// the user watches Kai build the block.

import * as v from 'valibot';

import { useWorkoutStore } from '../../../store/workoutStore';
import {
  createColumnSectionNode,
  createCustomFieldNode,
  createDashboardNode,
  createDividerNode,
  createImageNode,
  createSpacerNode,
  createSubBlockNode,
  createTextNode,
  createTimerNode,
  type ContentNode,
  type DashboardMetric,
  type DashboardViz,
  type TextFormat,
} from '../../../types/content';
import { generateId } from '../../../types/core';
import {
  HexColor,
  IdString,
  NonEmptyString,
  NonNegativeInt,
  PositionSchema,
  PositiveInt,
  TextFormatSchema,
} from '../validation/schemas';
import {
  MAX_SUBBLOCK_DEPTH,
  ToolError,
  findNodeOrThrow,
  getBlockDepth,
  getBlockOrThrow,
} from './helpers';
import type { ToolDefinition } from './types';

// ======================== add_text ========================

const AddTextArgs = v.object({
  blockId: IdString,
  content: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)),
  format: v.optional(TextFormatSchema),
  position: PositionSchema,
});

type AddTextArgs = v.InferOutput<typeof AddTextArgs>;

export const addTextTool: ToolDefinition<AddTextArgs, { nodeId: string }> = {
  name: 'add_text',
  description:
    'Append (or insert at position) a text node — paragraph, heading (h1/h2/h3), bullet, numbered, or checklist. Use h2/h3 to label phases ("Calentamiento", "Bloque principal").',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      content: { type: 'string' },
      format: {
        type: 'string',
        enum: ['paragraph', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'checklist'],
      },
      position: {
        type: 'integer',
        minimum: 0,
        description: 'Optional. Index in the block content; omit to append.',
      },
    },
    required: ['blockId', 'content'],
    additionalProperties: false,
  },
  schema: AddTextArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const node = createTextNode(0, (args.format ?? 'paragraph') as TextFormat, args.content);
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== add_divider ========================

const AddDividerArgs = v.object({ blockId: IdString, position: PositionSchema });
type AddDividerArgs = v.InferOutput<typeof AddDividerArgs>;

export const addDividerTool: ToolDefinition<AddDividerArgs, { nodeId: string }> = {
  name: 'add_divider',
  description: 'Insert a horizontal divider — use it to separate phases (warmup, main, cooldown).',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId'],
    additionalProperties: false,
  },
  schema: AddDividerArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const node = createDividerNode(0);
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== add_image ========================

const AddImageArgs = v.object({
  blockId: IdString,
  uri: NonEmptyString,
  caption: v.optional(v.pipe(v.string(), v.maxLength(140))),
  position: PositionSchema,
});

type AddImageArgs = v.InferOutput<typeof AddImageArgs>;

export const addImageTool: ToolDefinition<AddImageArgs, { nodeId: string }> = {
  name: 'add_image',
  description: 'Insert an image with an optional caption.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      uri: { type: 'string', description: 'http(s) URL or local asset uri.' },
      caption: { type: 'string' },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId', 'uri'],
    additionalProperties: false,
  },
  schema: AddImageArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const base = createImageNode(0);
    const node: ContentNode = { ...base, data: { uri: args.uri, caption: args.caption ?? '' } };
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== add_timer ========================

const AddTimerArgs = v.object({
  blockId: IdString,
  mode: v.optional(v.picklist(['countdown', 'stopwatch'])),
  duration_sec: v.optional(NonNegativeInt),
  label: v.optional(v.pipe(v.string(), v.maxLength(40))),
  position: PositionSchema,
});

type AddTimerArgs = v.InferOutput<typeof AddTimerArgs>;

export const addTimerTool: ToolDefinition<AddTimerArgs, { nodeId: string }> = {
  name: 'add_timer',
  description:
    'Insert a timer (countdown for fixed work intervals, stopwatch for self-paced). Pair with text labels for HIIT / Tabata blocks.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      mode: { type: 'string', enum: ['countdown', 'stopwatch'] },
      duration_sec: { type: 'integer', minimum: 0 },
      label: { type: 'string' },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId'],
    additionalProperties: false,
  },
  schema: AddTimerArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const node = createTimerNode(
      0,
      args.mode ?? 'countdown',
      args.duration_sec ?? 60,
      args.label ?? '',
    );
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== add_spacer ========================

const AddSpacerArgs = v.object({
  blockId: IdString,
  height: v.optional(v.pipe(v.number(), v.minValue(4), v.maxValue(120))),
  position: PositionSchema,
});

type AddSpacerArgs = v.InferOutput<typeof AddSpacerArgs>;

export const addSpacerTool: ToolDefinition<AddSpacerArgs, { nodeId: string }> = {
  name: 'add_spacer',
  description: 'Insert vertical spacing (4-120px) for visual breathing room.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      height: { type: 'number', minimum: 4, maximum: 120 },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId'],
    additionalProperties: false,
  },
  schema: AddSpacerArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const node = createSpacerNode(0, args.height ?? 24);
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== add_dashboard ========================

const DashboardMetricSchema = v.picklist([
  'total_volume',
  'completed_sets',
  'total_exercises',
  'completion_pct',
  'estimated_duration',
] as const satisfies readonly DashboardMetric[]);

const DashboardVizSchema = v.picklist([
  'counter',
  'progress',
  'list',
] as const satisfies readonly DashboardViz[]);

const AddDashboardArgs = v.object({
  blockId: IdString,
  metric: DashboardMetricSchema,
  viz: v.optional(DashboardVizSchema),
  label: v.optional(v.pipe(v.string(), v.maxLength(40))),
  color: v.optional(HexColor),
  position: PositionSchema,
});

type AddDashboardArgs = v.InferOutput<typeof AddDashboardArgs>;

export const addDashboardTool: ToolDefinition<AddDashboardArgs, { nodeId: string }> = {
  name: 'add_dashboard',
  description:
    'Insert a live metric card (volume, completed sets, completion %, etc.). Use it on training plans where the user wants a glance at progress.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      metric: {
        type: 'string',
        enum: [
          'total_volume',
          'completed_sets',
          'total_exercises',
          'completion_pct',
          'estimated_duration',
        ],
      },
      viz: { type: 'string', enum: ['counter', 'progress', 'list'] },
      label: { type: 'string' },
      color: { type: 'string', description: '#RRGGBB' },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId', 'metric'],
    additionalProperties: false,
  },
  schema: AddDashboardArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const node = createDashboardNode(
      0,
      args.metric,
      args.viz ?? 'counter',
      args.label,
      args.color ?? '#D4AF37',
    );
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== add_custom_field ========================

const AddCustomFieldArgs = v.object({
  blockId: IdString,
  label: v.pipe(NonEmptyString, v.maxLength(40)),
  value: v.optional(v.union([v.number(), v.string(), v.boolean(), v.null()])),
  unit: v.optional(v.string()),
  position: PositionSchema,
});

type AddCustomFieldArgs = v.InferOutput<typeof AddCustomFieldArgs>;

export const addCustomFieldTool: ToolDefinition<AddCustomFieldArgs, { nodeId: string }> = {
  name: 'add_custom_field',
  description:
    'Add a key/value field at block level (e.g. "Energía: 8/10", "Sleep: 7h"). For per-exercise metrics use add_exercise_field.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      label: { type: 'string' },
      value: {
        oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }, { type: 'null' }],
      },
      unit: { type: 'string' },
      position: { type: 'integer', minimum: 0 },
    },
    required: ['blockId', 'label'],
    additionalProperties: false,
  },
  schema: AddCustomFieldArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    getBlockOrThrow(args.blockId);
    const guessedType: 'number' | 'text' | 'boolean' =
      typeof args.value === 'number'
        ? 'number'
        : typeof args.value === 'boolean'
          ? 'boolean'
          : 'text';
    const node = createCustomFieldNode(
      0,
      {
        id: `cf_${generateId()}`,
        name: args.label,
        type: guessedType,
        unit: args.unit ?? null,
        isBase: false,
        isPrimary: false,
        order: 0,
      },
      args.value ?? null,
    );
    store.insertContentNode(args.blockId, node, args.position);
    return { nodeId: node.id };
  },
};

// ======================== wrap_in_columns ========================

const WrapInColumnsArgs = v.object({
  blockId: IdString,
  nodeIds: v.pipe(v.array(IdString), v.minLength(1)),
  columns: v.picklist([2, 3]),
});

type WrapInColumnsArgs = v.InferOutput<typeof WrapInColumnsArgs>;

export const wrapInColumnsTool: ToolDefinition<WrapInColumnsArgs, { sectionId: string }> = {
  name: 'wrap_in_columns',
  description:
    'Group existing nodes inside a 2- or 3-column section. Use it when items should sit side-by-side (e.g. warmup pairs, complementary mobility cues, push/pull supersets).',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      nodeIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Existing node ids to group. Order is preserved across columns.',
      },
      columns: { type: 'integer', enum: [2, 3] },
    },
    required: ['blockId', 'nodeIds', 'columns'],
    additionalProperties: false,
  },
  schema: WrapInColumnsArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    const block = getBlockOrThrow(args.blockId);
    for (const id of args.nodeIds) findNodeOrThrow(block, id);
    const sectionId = store.wrapNodesInColumns(args.blockId, args.nodeIds, args.columns);
    if (!sectionId) throw new ToolError('failed to create column section');
    return { sectionId };
  },
};

// ======================== wrap_in_subblock ========================
//
// Creates a brand-new sub-block, moves the requested nodes there, and inserts
// a `subBlock` reference node in the parent at the position of the first
// target. Refuses to wrap if the resulting nesting depth exceeds the cap.

const WrapInSubBlockArgs = v.object({
  blockId: IdString,
  nodeIds: v.pipe(v.array(IdString), v.minLength(1)),
  subBlockName: v.pipe(NonEmptyString, v.maxLength(60)),
});

type WrapInSubBlockArgs = v.InferOutput<typeof WrapInSubBlockArgs>;

export const wrapInSubBlockTool: ToolDefinition<
  WrapInSubBlockArgs,
  { subBlockId: string; nodeId: string }
> = {
  name: 'wrap_in_subblock',
  description:
    'Move nodes into a new nested sub-block (a mini block displayed inline). Ideal for "phases" of a session — warmup, main, cooldown — when each phase has its own structure.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      nodeIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
      subBlockName: { type: 'string', maxLength: 60 },
    },
    required: ['blockId', 'nodeIds', 'subBlockName'],
    additionalProperties: false,
  },
  schema: WrapInSubBlockArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    const parent = getBlockOrThrow(args.blockId);
    const targets = args.nodeIds.map((id) => findNodeOrThrow(parent, id));
    if (targets.some((n) => n.type === 'columnSection')) {
      throw new ToolError('cannot wrap a columnSection inside a sub-block');
    }
    const parentDepth = getBlockDepth(parent.id);
    if (parentDepth + 1 >= MAX_SUBBLOCK_DEPTH) {
      throw new ToolError(
        `nesting limit (${MAX_SUBBLOCK_DEPTH}) reached — cannot create deeper sub-block`,
      );
    }

    // 1. Create the empty sub-block.
    const subBlockId = store.addBlock(parent.discipline, { name: args.subBlockName });

    // 2. Append each target node into the sub-block, then drop it from the parent.
    for (const node of targets) {
      // Clone with a fresh id to avoid id collisions across blocks.
      const cloned = JSON.parse(JSON.stringify(node)) as ContentNode;
      cloned.id = generateId();
      cloned.section = undefined;
      cloned.column = 0;
      store.addContentNode(subBlockId, cloned);
    }

    // 3. Replace the first target's slot with the subBlock reference, then
    //    remove the rest of the targets.
    const firstTargetId = targets[0].id;
    const subBlockRef = createSubBlockNode(0, subBlockId);
    const sortedParent = [...parent.content].sort((a, b) => a.order - b.order);
    const refIndex = sortedParent.findIndex((n) => n.id === firstTargetId);
    store.insertContentNode(args.blockId, subBlockRef, refIndex >= 0 ? refIndex : undefined);
    for (const t of targets) store.deleteContentNode(args.blockId, t.id);

    return { subBlockId, nodeId: subBlockRef.id };
  },
};

// ======================== move_node ========================

const MoveNodeArgs = v.object({
  blockId: IdString,
  nodeId: IdString,
  direction: v.optional(v.picklist(['up', 'down'])),
  toIndex: v.optional(NonNegativeInt),
});

type MoveNodeArgs = v.InferOutput<typeof MoveNodeArgs>;

export const moveNodeTool: ToolDefinition<MoveNodeArgs, { ok: true }> = {
  name: 'move_node',
  description:
    'Reorder a node within its block. Either pass `direction` ("up"/"down" by one slot) or `toIndex` (absolute target index).',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      nodeId: { type: 'string' },
      direction: { type: 'string', enum: ['up', 'down'] },
      toIndex: { type: 'integer', minimum: 0 },
    },
    required: ['blockId', 'nodeId'],
    additionalProperties: false,
  },
  schema: MoveNodeArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    const block = getBlockOrThrow(args.blockId);
    findNodeOrThrow(block, args.nodeId);

    if (args.direction) {
      store.moveContentNode(args.blockId, args.nodeId, args.direction);
      return { ok: true };
    }

    if (args.toIndex !== undefined) {
      const sorted = [...block.content].sort((a, b) => a.order - b.order);
      const ordered = sorted.map((n) => n.id).filter((id) => id !== args.nodeId);
      const clamped = Math.max(0, Math.min(args.toIndex, ordered.length));
      ordered.splice(clamped, 0, args.nodeId);
      store.reorderContentNodes(args.blockId, ordered);
      return { ok: true };
    }

    throw new ToolError('either `direction` or `toIndex` must be provided');
  },
};

// ======================== update_node ========================
//
// Generic shallow update for the .data of a content node. We keep it strict —
// the model can only patch primitives the renderer expects (text content,
// timer label/duration, image caption, divider has none). For exercise-level
// edits use the dedicated exercise tools.

const UpdateNodeArgs = v.object({
  blockId: IdString,
  nodeId: IdString,
  data: v.record(NonEmptyString, v.union([v.number(), v.string(), v.boolean(), v.null()])),
});

type UpdateNodeArgs = v.InferOutput<typeof UpdateNodeArgs>;

export const updateNodeTool: ToolDefinition<UpdateNodeArgs, { ok: true }> = {
  name: 'update_node',
  description:
    'Patch the data of a non-exercise node (text content, timer settings, image caption, dashboard label). Pass only the fields you want to change. NOT for exercises.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      nodeId: { type: 'string' },
      data: {
        type: 'object',
        description: 'Partial replacement for node.data. Field names depend on node type.',
        additionalProperties: true,
      },
    },
    required: ['blockId', 'nodeId', 'data'],
    additionalProperties: false,
  },
  schema: UpdateNodeArgs,
  handler: (args) => {
    const store = useWorkoutStore.getState();
    const block = getBlockOrThrow(args.blockId);
    const node = findNodeOrThrow(block, args.nodeId);
    if (node.type === 'exercise') {
      throw new ToolError('use update_exercise / set tools for exercise nodes');
    }
    const merged = { ...(node as { data: Record<string, unknown> }).data, ...args.data };
    store.updateContentNode(args.blockId, args.nodeId, { data: merged } as Partial<ContentNode>);
    return { ok: true };
  },
};

// ======================== delete_node ========================

const DeleteNodeArgs = v.object({ blockId: IdString, nodeId: IdString });
type DeleteNodeArgs = v.InferOutput<typeof DeleteNodeArgs>;

export const deleteNodeTool: ToolDefinition<DeleteNodeArgs, { ok: true }> = {
  name: 'delete_node',
  description: 'Delete a content node from a block. Idempotent — deleting a missing node is OK.',
  parameters: {
    type: 'object',
    properties: {
      blockId: { type: 'string' },
      nodeId: { type: 'string' },
    },
    required: ['blockId', 'nodeId'],
    additionalProperties: false,
  },
  schema: DeleteNodeArgs,
  handler: (args) => {
    useWorkoutStore.getState().deleteContentNode(args.blockId, args.nodeId);
    return { ok: true };
  },
};

// Re-export non-content primitives that other modules might want.
export { PositionSchema, PositiveInt };
