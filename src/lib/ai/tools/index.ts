// Tool registry. Single source of truth for what Kai can do.
//
// `ALL_TOOLS` ships to Groq as the `tools` array; the loop dispatches by name
// against `TOOL_REGISTRY`. Adding a new capability = drop a `ToolDefinition`
// here and the rest of the agent picks it up automatically.

import { createBlockTool, deleteBlockTool, setBlockMetaTool } from './blockTools';
import {
  addCustomFieldTool,
  addDashboardTool,
  addDividerTool,
  addImageTool,
  addSpacerTool,
  addTextTool,
  addTimerTool,
  deleteNodeTool,
  moveNodeTool,
  updateNodeTool,
  wrapInColumnsTool,
  wrapInSubBlockTool,
} from './contentTools';
import {
  addExerciseFieldTool,
  addExerciseTool,
  addSetTool,
  removeExerciseFieldTool,
  removeSetTool,
  updateExerciseFieldTool,
  updateSetValueTool,
} from './exerciseTools';
import type { GroqToolDefinition } from '../client';
import type { ToolDefinition, ToolRegistry } from './types';

 
const ALL: ToolDefinition<any, any>[] = [
  // Block-level
  createBlockTool,
  setBlockMetaTool,
  deleteBlockTool,
  // Content nodes (non-exercise)
  addTextTool,
  addDividerTool,
  addImageTool,
  addTimerTool,
  addSpacerTool,
  addDashboardTool,
  addCustomFieldTool,
  wrapInColumnsTool,
  wrapInSubBlockTool,
  moveNodeTool,
  updateNodeTool,
  deleteNodeTool,
  // Exercises + fields + sets
  addExerciseTool,
  addExerciseFieldTool,
  updateExerciseFieldTool,
  removeExerciseFieldTool,
  updateSetValueTool,
  addSetTool,
  removeSetTool,
];

export const TOOL_REGISTRY: ToolRegistry = Object.fromEntries(ALL.map((t) => [t.name, t]));

/** Groq-shaped definitions (the `tools` array sent in every request). */
export const TOOL_DEFINITIONS: GroqToolDefinition[] = ALL.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));

export type { ToolDefinition, ToolCall, ToolResult } from './types';
