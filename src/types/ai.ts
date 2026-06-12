// KAIROS — AI Types
// Light-weight chat types. The legacy `AIAction` discriminated union is gone:
// the agent now talks to the store via `lib/ai/tools` (tool calls), and any
// UI surface that wants to render progress imports the tool result directly.

import type { ToolResult } from '../lib/ai/tools/types';

// ======================== AI MESSAGE ========================

export type AIRole = 'user' | 'assistant' | 'tool_status';

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  /** Per-tool execution outcomes attached to an assistant turn (empty for user messages). */
  toolResults?: ToolResult[];
  /** Set on the assistant's final turn if a single block was created/affected. */
  affectedBlockId?: string;
  timestamp: number;
}

// ======================== SESSION CONTEXT ========================

export interface SessionContext {
  lastBlockId: string | null;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}
