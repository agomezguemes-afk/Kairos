// Our provider request ↔ llama.rn completion, kept free of native imports
// so it can be tested off-device.

import type { ChatRequest, ChatResult, ToolCall } from '../providers/types';

/** The slice of llama.rn's completion params this app sets. */
/** OpenAI-style message as llama.rn takes it: content is never null. */
export type LlamaMessage = { role: string; content?: string } & Record<string, unknown>;

export interface LlamaCompletionParams {
  messages: LlamaMessage[];
  n_predict: number;
  temperature: number;
  /** Qwen3 thinks by default and llama.rn enables it: hundreds of hidden tokens per answer. */
  enable_thinking: false;
  jinja: true;
  response_format?: {
    type: 'json_object' | 'json_schema';
    json_schema?: { strict: boolean; schema: object };
  };
  tools?: object;
  tool_choice?: string;
}

/** The slice of llama.rn's completion result this app reads. */
export interface LlamaCompletionResult {
  text: string;
  content?: string;
  tool_calls?: { type?: string; id?: string; function: { name: string; arguments: string } }[];
  interrupted?: boolean;
  context_full?: boolean;
  timings?: { prompt_per_second?: number; predicted_per_second?: number; predicted_n?: number };
}

export const LOCAL_DEFAULT_MAX_TOKENS = 512;

export function toCompletionParams(req: ChatRequest): LlamaCompletionParams {
  const params: LlamaCompletionParams = {
    // Tool messages keep tool_call_id and assistant turns keep tool_calls:
    // the model's own chat template (jinja) reads them.
    messages: req.messages.map((m) => ({ ...m, content: m.content ?? '' })),
    n_predict: req.maxTokens ?? LOCAL_DEFAULT_MAX_TOKENS,
    temperature: req.temperature ?? 0.6,
    enable_thinking: false,
    jinja: true,
  };
  if (req.schema)
    params.response_format = {
      type: 'json_schema',
      json_schema: { strict: true, schema: req.schema },
    };
  else if (req.json) params.response_format = { type: 'json_object' };
  if (req.tools?.length) {
    params.tools = req.tools;
    params.tool_choice = 'auto';
  }
  return params;
}

/** Leftover reasoning markup some templates emit even with thinking off. */
const THINK = /<think>[\s\S]*?<\/think>\s*/g;

export function fromCompletionResult(res: LlamaCompletionResult): ChatResult {
  if (res.context_full) throw new Error('el contexto del modelo local se llenó');
  if (res.interrupted) throw new Error('generación interrumpida');
  const raw = (res.content ?? res.text ?? '').replace(THINK, '').trim();
  const toolCalls: ToolCall[] | undefined = res.tool_calls?.length
    ? res.tool_calls.map((c, i) => ({
        id: c.id ?? `local-${i}`,
        type: 'function',
        function: { name: c.function.name, arguments: c.function.arguments },
      }))
    : undefined;
  return { content: raw.length ? raw : null, toolCalls };
}
