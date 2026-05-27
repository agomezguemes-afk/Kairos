// Tool-calling primitives for the Kai agent loop.
//
// Each Kairos capability the AI can invoke is a `ToolDefinition`:
//   - `name`: the function name advertised to Groq (snake_case).
//   - `description`: short imperative sentence — what the tool DOES, not what it returns.
//   - `parameters`: JSON Schema shipped to Groq verbatim.
//   - `schema`: a valibot schema used to validate the model's `arguments` BEFORE we
//     ever touch the store. JSON Schema is for the model; valibot is for us.
//   - `handler`: pure side-effect over `useWorkoutStore`. Idempotent where it can
//     be (delete on a missing id is a no-op success). Returns the data the model
//     needs to keep working (newly created ids, mostly).
//
// `ToolCall` and `ToolResult` mirror the OpenAI/Groq tool-calling shape so the
// loop can shovel them straight into the next chat turn.

import type { BaseSchema, BaseIssue } from 'valibot';

export interface ToolCall {
  /** Echoed back to Groq via the matching `tool` message. */
  id: string;
  name: string;
  /** Raw JSON string from the model. Validate with the tool's schema before use. */
  rawArguments: string;
}

export interface ToolResult {
  toolCallId: string;
  /** The tool name — handy for UI status bubbles. */
  name: string;
  ok: boolean;
  /** Set when ok=true. JSON-serializable. */
  data?: unknown;
  /** Set when ok=false. Surfaced both to the model AND the user. */
  error?: string;
}

export type ToolHandler<TArgs, TResult> = (args: TArgs) => Promise<TResult> | TResult;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolSchema = BaseSchema<unknown, any, BaseIssue<any>>;

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  /** JSON Schema sent to Groq. Keep it tight — the model uses it as documentation. */
  parameters: Record<string, unknown>;
  /**
   * valibot schema. Inputs that fail this never reach the handler — the loop
   * sends the validation error back to the model so it can self-correct.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: BaseSchema<unknown, TArgs, BaseIssue<any>>;
  handler: ToolHandler<TArgs, TResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolRegistry = Record<string, ToolDefinition<any, any>>;
