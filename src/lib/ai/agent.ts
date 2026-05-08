// Kai agent loop.
//
// Drives a multi-turn conversation against Groq with tool calling enabled.
// Per turn:
//   1. Send messages (+ tools) to Groq.
//   2. If the model returned plain text → done. Return final text.
//   3. If the model returned tool_calls → for each:
//        a. Validate args via the tool's valibot schema.
//        b. On success: run handler. Append a `tool` message with the result.
//        c. On failure: append a `tool` message with `{ok:false, error}`.
//      Then loop back to step 1.
//   4. After MAX_TURNS without natural termination, force a final text turn.
//
// Important latency/UX choices:
//   - Tool handlers commit to the store synchronously on each call. The UI
//     re-renders mid-loop because Zustand is reactive.
//   - We surface progress via `onProgress` so the chat UI can show a live
//     "executing: add_exercise" badge per call.

import * as v from 'valibot';

import {
  chatCompletion,
  GroqError,
  type GroqMessage,
  type GroqAssistantMessage,
  type GroqAssistantToolCall,
  type GroqOptions,
} from './client';
import { TOOL_DEFINITIONS, TOOL_REGISTRY } from './tools';
import type { ToolCall, ToolResult } from './tools/types';

const DEFAULT_MAX_TURNS = 12;
const MAX_RETRIES_PER_TOOL = 2;

export type AgentProgressEvent =
  | { type: 'turn_start'; turn: number }
  | { type: 'tool_running'; call: ToolCall }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'final_text'; text: string };

export type AgentProgressFn = (e: AgentProgressEvent) => void;

export interface AgentRunOptions extends GroqOptions {
  maxTurns?: number;
  onProgress?: AgentProgressFn;
}

export interface AgentRunResult {
  /** Final assistant text (after the last turn, possibly empty). */
  text: string;
  /** Every tool result captured during the run, in order. */
  toolResults: ToolResult[];
  /** Total round-trips. */
  turns: number;
}

export class AgentError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AgentError';
  }
}

/**
 * Run the agent loop until the model returns a plain assistant message, or we
 * hit `maxTurns`. Throws AgentError on Groq failures or runaway loops.
 */
export async function runAgent(
  initialMessages: GroqMessage[],
  options: AgentRunOptions = {},
): Promise<AgentRunResult> {
  const { maxTurns = DEFAULT_MAX_TURNS, onProgress, ...groqOpts } = options;

  const messages: GroqMessage[] = [...initialMessages];
  const toolResults: ToolResult[] = [];
  // Track how many times we've handed back a validation failure for a given
  // (turnIndex, toolName) pair so we can give up gracefully.
  const retryBudget = new Map<string, number>();

  let turn = 0;
  while (turn < maxTurns) {
    turn += 1;
    onProgress?.({ type: 'turn_start', turn });

    let choice;
    try {
      choice = await chatCompletion(messages, {
        ...groqOpts,
        tools: TOOL_DEFINITIONS,
        toolChoice: groqOpts.toolChoice ?? 'auto',
      });
    } catch (e) {
      if (e instanceof GroqError) throw new AgentError(e.message, e);
      throw new AgentError('Groq call failed', e);
    }

    const assistantMsg = choice.message;
    // Always echo the assistant turn into history so subsequent tool messages
    // can reference its tool_call_ids.
    messages.push(stripUndefined(assistantMsg));

    const toolCalls = assistantMsg.tool_calls ?? [];
    // Fast path: no tool calls → final answer.
    if (toolCalls.length === 0) {
      const text = (assistantMsg.content ?? '').trim();
      onProgress?.({ type: 'final_text', text });
      return { text, toolResults, turns: turn };
    }

    // Execute every tool call in this assistant turn.
    for (const tc of toolCalls) {
      const call: ToolCall = {
        id: tc.id,
        name: tc.function.name,
        rawArguments: tc.function.arguments ?? '',
      };
      onProgress?.({ type: 'tool_running', call });

      const result = await executeToolCall(call, retryBudget);
      toolResults.push(result);
      onProgress?.({ type: 'tool_result', result });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result.ok
          ? { ok: true, data: result.data }
          : { ok: false, error: result.error }),
      });
    }
    // Loop continues — model gets the tool outputs in the next turn.
  }

  // Hit maxTurns without termination. Ask for a final summary in plain text.
  messages.push({
    role: 'user',
    content:
      'Resume brevemente lo que has hecho hasta ahora y propón un siguiente paso. Sin más tool calls.',
  });
  let final;
  try {
    final = await chatCompletion(messages, { ...groqOpts, toolChoice: 'none' });
  } catch (e) {
    throw new AgentError('Groq call failed during forced finalisation', e);
  }
  const text = (final.message.content ?? '').trim();
  onProgress?.({ type: 'final_text', text });
  return { text, toolResults, turns: turn };
}

// ======================== INTERNALS ========================

async function executeToolCall(
  call: ToolCall,
  retryBudget: Map<string, number>,
): Promise<ToolResult> {
  const tool = TOOL_REGISTRY[call.name];
  if (!tool) {
    return {
      toolCallId: call.id,
      name: call.name,
      ok: false,
      error: `unknown tool "${call.name}"`,
    };
  }

  // Parse arguments JSON.
  let parsed: unknown;
  try {
    parsed = call.rawArguments ? JSON.parse(call.rawArguments) : {};
  } catch (e) {
    return {
      toolCallId: call.id,
      name: call.name,
      ok: false,
      error: `arguments are not valid JSON (${(e as Error).message})`,
    };
  }

  // Validate against the tool's schema.
  const validation = v.safeParse(tool.schema, parsed);
  if (!validation.success) {
    const detail = validation.issues
      .map((i) => `${i.path?.map((p) => String(p.key)).join('.') ?? '<root>'}: ${i.message}`)
      .join('; ');
    const used = retryBudget.get(call.name) ?? 0;
    retryBudget.set(call.name, used + 1);
    if (used >= MAX_RETRIES_PER_TOOL) {
      return {
        toolCallId: call.id,
        name: call.name,
        ok: false,
        error: `validation failed (${detail}). Stopping retries — please pick a different approach.`,
      };
    }
    return {
      toolCallId: call.id,
      name: call.name,
      ok: false,
      error: `validation failed: ${detail}`,
    };
  }

  // Run the handler.
  try {
    const data = await tool.handler(validation.output);
    return { toolCallId: call.id, name: call.name, ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { toolCallId: call.id, name: call.name, ok: false, error: msg };
  }
}

/** Drop undefined fields so JSON.stringify doesn't emit them. */
function stripUndefined(msg: GroqAssistantMessage): GroqAssistantMessage {
  const out: GroqAssistantMessage = {
    role: 'assistant',
    content: msg.content ?? null,
  };
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    out.tool_calls = msg.tool_calls.map((c: GroqAssistantToolCall) => ({
      id: c.id,
      type: 'function',
      function: { name: c.function.name, arguments: c.function.arguments },
    }));
  }
  return out;
}
