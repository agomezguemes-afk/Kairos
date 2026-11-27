// The downloaded model as a provider. No native imports: the runtime and
// the persisted selection are injected, so the policy is testable.

import { LOCAL_CONTEXT_TOKENS, type LocalModel } from './catalog';
import { fromCompletionResult, toCompletionParams } from './mapping';
import type { LocalRuntime } from './runtimeTypes';
import type { ChatRequest, ChatResult, LlmProvider } from '../providers/types';

export interface LocalProviderDeps {
  runtime: LocalRuntime | null;
  /** The model the person chose in settings or the lab, if any. */
  activeModel(): LocalModel | undefined;
  /** Whether that model's file was complete the last time it was checked. */
  isDownloaded(modelId: string): boolean;
  /** The file vanished (iOS purged Caches): stop offering this model. */
  markMissing(modelId: string): void;
}

export const LOCAL_PROVIDER_ID = 'llama';

export function createLocalProvider(deps: LocalProviderDeps): LlmProvider {
  // One context runs one completion at a time; queue the rest.
  let queue: Promise<unknown> = Promise.resolve();

  async function run(req: ChatRequest): Promise<ChatResult> {
    const runtime = deps.runtime;
    const model = deps.activeModel();
    if (!runtime || !model) throw new Error('sin modelo local');
    if (!(await runtime.isDownloaded(model))) {
      deps.markMissing(model.id);
      throw new Error('el modelo local ya no está en el iPhone');
    }
    if (req.signal?.aborted) throw new Error('cancelado');
    await runtime.load(model);
    const onAbort = () => void runtime.stop();
    req.signal?.addEventListener('abort', onAbort);
    try {
      return fromCompletionResult(await runtime.complete(toCompletionParams(req)));
    } finally {
      req.signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    id: LOCAL_PROVIDER_ID,
    kind: 'local',
    capabilities: { json: true, tools: true, contextTokens: LOCAL_CONTEXT_TOKENS },
    suits: (task) => !!deps.activeModel()?.tasks.includes(task),
    status() {
      if (!deps.runtime) return { available: false, reason: 'Solo en la app de iPhone.' };
      const model = deps.activeModel();
      if (!model) return { available: false, reason: 'No has elegido un modelo local.' };
      if (!deps.isDownloaded(model.id))
        return { available: false, reason: `${model.name} no está descargado.` };
      return { available: true };
    },
    complete(req) {
      const next = queue.then(
        () => run(req),
        () => run(req),
      );
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
