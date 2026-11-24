import { describe, expect, it } from 'vitest';

import { fitOnDevice, formatBytes, LOCAL_MODELS, type LocalModel } from './catalog';
import { formatLabReport, LAB_GOALS, runLab } from './lab';
import { createLocalProvider } from './llamaProvider';
import { fromCompletionResult, toCompletionParams, type LlamaCompletionResult } from './mapping';
import type { LocalRuntime } from './runtimeTypes';

const GB = 1024 ** 3;
const [small, mid, large] = LOCAL_MODELS;

describe('model catalogue', () => {
  it('every entry has a pinned size and SHA-256', () => {
    for (const m of LOCAL_MODELS) {
      expect(m.sizeBytes).toBeGreaterThan(100 * 1024 ** 2);
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.url).toMatch(/^https:\/\/huggingface\.co\/.+\/resolve\/main\/.+\.gguf$/);
      expect(m.url.endsWith(m.file)).toBe(true);
    }
  });

  // iOS reports less than the nominal RAM: a "4 GB" iPhone 13 says ~3.8e9 bytes.
  const IPHONE_13 = 3.8e9;

  it('a 4 GB phone fits the small model, not the 1.7B one', () => {
    expect(fitOnDevice(small, IPHONE_13)).toBe('ok');
    expect(fitOnDevice(large, IPHONE_13)).toBe('too-big');
    expect(fitOnDevice(large, 6 * GB)).toBe('ok');
    expect(fitOnDevice(mid, null)).toBe('unknown');
  });
});

describe('llama.rn mapping', () => {
  const messages = [
    { role: 'system' as const, content: 'Eres Kai.' },
    { role: 'user' as const, content: 'Quiero correr 10 km' },
  ];

  it('turns thinking off and constrains JSON with the schema when there is one', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    const p = toCompletionParams({ messages, schema, maxTokens: 300, temperature: 0.2 });
    expect(p.enable_thinking).toBe(false);
    expect(p.response_format).toEqual({
      type: 'json_schema',
      json_schema: { strict: true, schema },
    });
    expect(p.n_predict).toBe(300);
    expect(toCompletionParams({ messages, json: true }).response_format).toEqual({
      type: 'json_object',
    });
    expect(toCompletionParams({ messages }).response_format).toBeUndefined();
  });

  it('never sends null content to the native side', () => {
    const p = toCompletionParams({
      messages: [{ role: 'assistant', content: null, tool_calls: [] }],
    });
    expect(p.messages[0].content).toBe('');
  });

  it('strips leftover reasoning and maps tool calls', () => {
    const r = fromCompletionResult({
      text: '<think>hmm</think>\n{"ok":true}',
      tool_calls: [{ function: { name: 'add_set', arguments: '{"reps":8}' } }],
    });
    expect(r.content).toBe('{"ok":true}');
    expect(r.toolCalls).toEqual([
      { id: 'local-0', type: 'function', function: { name: 'add_set', arguments: '{"reps":8}' } },
    ]);
  });

  it('a full context or an interruption is a failure, not an answer', () => {
    expect(() => fromCompletionResult({ text: 'a medias', context_full: true })).toThrow();
    expect(() => fromCompletionResult({ text: 'a medias', interrupted: true })).toThrow();
  });
});

function fakeRuntime(
  opts: { onDisk?: boolean; reply?: () => Promise<LlamaCompletionResult> } = {},
) {
  const log: string[] = [];
  const runtime: LocalRuntime = {
    device: () => ({ modelName: 'iPhone 13', totalMemoryBytes: 4 * GB }),
    isDownloaded: async () => opts.onDisk ?? true,
    download: async () => {},
    cancelDownload: async () => {},
    remove: async () => {},
    load: async (m) => {
      log.push(`load ${m.id}`);
      return 0;
    },
    loadedModelId: () => null,
    complete: async (p) => {
      log.push(`complete ${String(p.messages[0]?.content)}`);
      return opts.reply ? opts.reply() : { text: 'vale' };
    },
    stop: async () => {
      log.push('stop');
    },
    bench: async () => ({ promptPerSecond: 0, generatePerSecond: 0 }),
    release: async () => {},
  };
  return { runtime, log };
}

describe('local provider', () => {
  const req = (content: string) => ({ messages: [{ role: 'user' as const, content }] });
  const deps = (runtime: LocalRuntime | null, model?: LocalModel, downloaded = true) => {
    const missing: string[] = [];
    return {
      missing,
      deps: {
        runtime,
        activeModel: () => model,
        isDownloaded: () => downloaded,
        markMissing: (id: string) => missing.push(id),
      },
    };
  };

  it('is unavailable without a runtime, a chosen model, or the file', () => {
    expect(createLocalProvider(deps(null, small).deps).status().available).toBe(false);
    expect(createLocalProvider(deps(fakeRuntime().runtime).deps).status().available).toBe(false);
    expect(
      createLocalProvider(deps(fakeRuntime().runtime, small, false).deps).status().available,
    ).toBe(false);
    expect(createLocalProvider(deps(fakeRuntime().runtime, small).deps).status().available).toBe(
      true,
    );
  });

  it('loads the chosen model before answering', async () => {
    const { runtime, log } = fakeRuntime();
    const p = createLocalProvider(deps(runtime, small).deps);
    expect(await p.complete(req('hola'))).toEqual({ content: 'vale', toolCalls: undefined });
    expect(log).toEqual([`load ${small.id}`, 'complete hola']);
  });

  it('a purged file marks the model missing and fails so the router moves on', async () => {
    const { runtime } = fakeRuntime({ onDisk: false });
    const d = deps(runtime, small);
    await expect(createLocalProvider(d.deps).complete(req('hola'))).rejects.toThrow();
    expect(d.missing).toEqual([small.id]);
  });

  it('runs one completion at a time, in order, even after a failure', async () => {
    let calls = 0;
    const { runtime, log } = fakeRuntime({
      reply: async () => {
        calls++;
        if (calls === 1) throw new Error('boom');
        return { text: `r${calls}` };
      },
    });
    const p = createLocalProvider(deps(runtime, small).deps);
    const a = p.complete(req('a'));
    const b = p.complete(req('b'));
    await expect(a).rejects.toThrow('boom');
    expect((await b).content).toBe('r2');
    expect(log.filter((l) => l.startsWith('complete'))).toEqual(['complete a', 'complete b']);
  });

  it('cancelling stops the native generation', async () => {
    let release: () => void = () => {};
    const { runtime, log } = fakeRuntime({
      reply: () =>
        new Promise((resolve) => {
          release = () => resolve({ text: '', interrupted: true });
        }),
    });
    const controller = new AbortController();
    const pending = createLocalProvider(deps(runtime, small).deps).complete({
      ...req('largo'),
      signal: controller.signal,
    });
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    release();
    await expect(pending).rejects.toThrow();
    expect(log).toContain('stop');
  });
});

describe('AI lab run', () => {
  const answering = (body: (prompt: string) => string) => {
    const { runtime } = fakeRuntime();
    runtime.complete = async (p) => ({ text: body(String(p.messages[1]?.content)) });
    runtime.bench = async () => ({ promptPerSecond: 140, generatePerSecond: 22.5 });
    return runtime;
  };

  it('scores a model that answers every goal right', async () => {
    const runtime = answering((text) => {
      const sport = LAB_GOALS.find((g) => g.text === text)!.sport;
      return JSON.stringify({
        sports: [sport],
        qualities: ['endurance'],
        daysPerWeek: null,
        horizonWeeks: null,
        confidence: 0.8,
        summary: 'Quieres mejorar.',
        question: null,
      });
    });
    const r = await runLab(runtime, small);
    expect(r.error).toBeUndefined();
    expect(r.generatePerSecond).toBe(22.5);
    expect(r.goals.every((g) => g.ok)).toBe(true);
    const report = formatLabReport(r, small);
    expect(report).toContain('4/4 correctos');
    expect(report).toContain('Escritura: 22,5 tok/s');
  });

  it('counts broken JSON as a miss instead of failing the run', async () => {
    const r = await runLab(
      answering(() => '{"sports": ["padel"'),
      small,
    );
    expect(r.goals).toHaveLength(LAB_GOALS.length);
    expect(r.goals.every((g) => !g.validJson && !g.ok)).toBe(true);
    expect(formatLabReport(r, small)).toContain('JSON no válido');
  });

  it('keeps what was measured when the model fails to load', async () => {
    const { runtime } = fakeRuntime();
    runtime.load = async () => {
      throw new Error('memoria insuficiente');
    };
    const r = await runLab(runtime, large);
    expect(r.error).toBe('memoria insuficiente');
    expect(formatLabReport(r, large)).toContain('Se detuvo: memoria insuficiente');
  });
});

describe('formatBytes', () => {
  it('uses the decimal units iOS shows', () => {
    expect(formatBytes(396_705_472)).toBe('397 MB');
    expect(formatBytes(1_107_409_472)).toBe('1,1 GB');
  });
});
